// GeminiService.swift — {{APP_NAME}}
// Gemini Flash API wrapper with streaming support.
// Never hard-code API keys. Load from secure config or keychain at runtime.

import Foundation

// MARK: - Configuration

private enum GeminiConfig {
    static let apiKey = "{{GEMINI_API_KEY}}"
    static let model = "gemini-1.5-flash-latest"
    static let streamModel = "gemini-1.5-flash-latest"
    static let baseURL = "https://generativelanguage.googleapis.com/v1beta/models"
    static let maxOutputTokens = 2048
}

// MARK: - Request / Response Models

struct GeminiMessage: Codable, Equatable {
    let role: String  // "user" or "model"
    let parts: [Part]

    struct Part: Codable, Equatable {
        let text: String
    }
}

private struct GeminiRequest: Encodable {
    let contents: [GeminiMessage]
    let generationConfig: GenerationConfig
    let systemInstruction: SystemInstruction?

    struct GenerationConfig: Encodable {
        let maxOutputTokens: Int
        let temperature: Double
    }

    struct SystemInstruction: Encodable {
        let parts: [GeminiMessage.Part]
    }
}

private struct GeminiResponse: Decodable {
    struct Candidate: Decodable {
        let content: GeminiMessage
        let finishReason: String?
    }
    let candidates: [Candidate]
}

private struct GeminiStreamChunk: Decodable {
    struct Candidate: Decodable {
        struct Content: Decodable {
            let parts: [GeminiMessage.Part]
        }
        let content: Content?
        let finishReason: String?
    }
    let candidates: [Candidate]
}

// MARK: - Error

enum GeminiError: LocalizedError {
    case missingAPIKey
    case networkError(Error)
    case invalidResponse(Int)
    case emptyResponse
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Gemini API key is not configured. Set {{GEMINI_API_KEY}} before building."
        case .networkError(let e):
            return "Network error: \(e.localizedDescription)"
        case .invalidResponse(let code):
            return "Unexpected HTTP status: \(code)"
        case .emptyResponse:
            return "The model returned an empty response."
        case .decodingError(let e):
            return "Failed to decode response: \(e.localizedDescription)"
        }
    }
}

// MARK: - Service

@MainActor
final class GeminiService: ObservableObject {
    static let shared = GeminiService()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        return URLSession(configuration: config)
    }()

    private init() {}

    // MARK: - Non-streaming generation

    func generate(
        messages: [GeminiMessage],
        systemPrompt: String? = nil,
        temperature: Double = 0.7
    ) async throws -> String {
        let key = apiKey()
        let urlString = "\(GeminiConfig.baseURL)/\(GeminiConfig.model):generateContent?key=\(key)"
        guard let url = URL(string: urlString) else { throw GeminiError.emptyResponse }

        let body = GeminiRequest(
            contents: messages,
            generationConfig: .init(maxOutputTokens: GeminiConfig.maxOutputTokens, temperature: temperature),
            systemInstruction: systemPrompt.map { .init(parts: [.init(text: $0)]) }
        )

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw GeminiError.networkError(error)
        }

        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard statusCode == 200 else { throw GeminiError.invalidResponse(statusCode) }

        do {
            let decoded = try JSONDecoder().decode(GeminiResponse.self, from: data)
            guard let text = decoded.candidates.first?.content.parts.first?.text else {
                throw GeminiError.emptyResponse
            }
            return text.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch let err as DecodingError {
            throw GeminiError.decodingError(err)
        }
    }

    // MARK: - Streaming generation (AsyncStream of text chunks)

    func generateStream(
        messages: [GeminiMessage],
        systemPrompt: String? = nil,
        temperature: Double = 0.7
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let key = self.apiKey()
                    let urlString = "\(GeminiConfig.baseURL)/\(GeminiConfig.streamModel):streamGenerateContent?alt=sse&key=\(key)"
                    guard let url = URL(string: urlString) else {
                        continuation.finish(throwing: GeminiError.emptyResponse)
                        return
                    }

                    let body = GeminiRequest(
                        contents: messages,
                        generationConfig: .init(maxOutputTokens: GeminiConfig.maxOutputTokens, temperature: temperature),
                        systemInstruction: systemPrompt.map { .init(parts: [.init(text: $0)]) }
                    )

                    var req = URLRequest(url: url)
                    req.httpMethod = "POST"
                    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    req.httpBody = try JSONEncoder().encode(body)

                    let (bytes, response) = try await self.session.bytes(for: req)
                    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                    guard statusCode == 200 else {
                        continuation.finish(throwing: GeminiError.invalidResponse(statusCode))
                        return
                    }

                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let jsonStr = String(line.dropFirst(6))
                        guard jsonStr != "[DONE]",
                              let data = jsonStr.data(using: .utf8),
                              let chunk = try? JSONDecoder().decode(GeminiStreamChunk.self, from: data),
                              let text = chunk.candidates.first?.content?.parts.first?.text
                        else { continue }
                        continuation.yield(text)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Private

    private func apiKey() throws -> String {
        let key = GeminiConfig.apiKey
        guard !key.isEmpty, key != "{{GEMINI_API_KEY}}" else {
            // In release builds, load from keychain or secure config.
            // For development, set GEMINI_API_KEY in your scheme environment variables.
            if let envKey = ProcessInfo.processInfo.environment["GEMINI_API_KEY"], !envKey.isEmpty {
                return envKey
            }
            throw GeminiError.missingAPIKey
        }
        return key
    }

    private func apiKey() -> String {
        let key = GeminiConfig.apiKey
        if key.isEmpty || key == "{{GEMINI_API_KEY}}" {
            return ProcessInfo.processInfo.environment["GEMINI_API_KEY"] ?? ""
        }
        return key
    }
}
