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

    // MARK: - Single-turn convenience

    func generate(prompt: String, systemPrompt: String? = nil, temperature: Double = 0.7) async throws -> String {
        let message = GeminiMessage(role: "user", parts: [.init(text: prompt)])
        return try await generate(messages: [message], systemPrompt: systemPrompt, temperature: temperature)
    }

    // MARK: - Multi-turn generation

    func generate(
        messages: [GeminiMessage],
        systemPrompt: String? = nil,
        temperature: Double = 0.7
    ) async throws -> String {
        let key = resolvedAPIKey()
        guard !key.isEmpty else { throw GeminiError.missingAPIKey }
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

    // MARK: - Private

    private func resolvedAPIKey() -> String {
        let key = GeminiConfig.apiKey
        if key.isEmpty || key == "{{GEMINI_API_KEY}}" {
            return ProcessInfo.processInfo.environment["GEMINI_API_KEY"] ?? ""
        }
        return key
    }
}
