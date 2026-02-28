// GeminiService.swift — {{APP_NAME}}
// Gemini Flash API wrapper for runtime AI features.
// Requires a valid Gemini API key. Never hard-code keys in production;
// inject via environment variable or secure config.

import Foundation

// MARK: - Configuration

private enum GeminiConfig {
    // Replace with your key or load from a secure source at runtime.
    static let apiKey = "{{GEMINI_API_KEY}}"
    static let model = "gemini-1.5-flash-latest"
    static let baseURL = "https://generativelanguage.googleapis.com/v1beta/models"
    static let maxOutputTokens = 512
}

// MARK: - Request / Response models

private struct GeminiRequest: Encodable {
    struct Content: Encodable {
        struct Part: Encodable {
            let text: String
        }
        let parts: [Part]
        let role: String
    }

    struct GenerationConfig: Encodable {
        let maxOutputTokens: Int
        let temperature: Double
    }

    let contents: [Content]
    let generationConfig: GenerationConfig
}

private struct GeminiResponse: Decodable {
    struct Candidate: Decodable {
        struct Content: Decodable {
            struct Part: Decodable {
                let text: String
            }
            let parts: [Part]
        }
        let content: Content
    }
    let candidates: [Candidate]
}

// MARK: - Error

enum GeminiError: LocalizedError {
    case missingAPIKey
    case networkError(Error)
    case invalidResponse
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .missingAPIKey: return "Gemini API key is not configured."
        case .networkError(let e): return "Network error: \(e.localizedDescription)"
        case .invalidResponse: return "Received an unexpected response from Gemini."
        case .emptyResponse: return "Gemini returned an empty response."
        }
    }
}

// MARK: - Service

@MainActor
final class GeminiService: ObservableObject {
    static let shared = GeminiService()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()

    private init() {}

    /// Sends a single prompt and returns the model's text response.
    func generate(prompt: String, temperature: Double = 0.7) async throws -> String {
        guard !GeminiConfig.apiKey.isEmpty, GeminiConfig.apiKey != "{{GEMINI_API_KEY}}" else {
            throw GeminiError.missingAPIKey
        }

        let urlString = "\(GeminiConfig.baseURL)/\(GeminiConfig.model):generateContent?key=\(GeminiConfig.apiKey)"
        guard let url = URL(string: urlString) else {
            throw GeminiError.invalidResponse
        }

        let body = GeminiRequest(
            contents: [
                .init(parts: [.init(text: prompt)], role: "user")
            ],
            generationConfig: .init(maxOutputTokens: GeminiConfig.maxOutputTokens, temperature: temperature)
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw GeminiError.networkError(error)
        }

        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw GeminiError.invalidResponse
        }

        let decoded = try JSONDecoder().decode(GeminiResponse.self, from: data)
        guard let text = decoded.candidates.first?.content.parts.first?.text else {
            throw GeminiError.emptyResponse
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Suggest context-aware tips or explanations for a utility result.
    func suggestForResult(input: String, result: String) async throws -> String {
        let prompt = """
        The user used a utility tool with the following input: "\(input)"
        The result was: "\(result)"

        Provide a brief (2-3 sentence) explanation or helpful tip related to this result. Be concise and practical.
        """
        return try await generate(prompt: prompt, temperature: 0.5)
    }
}
