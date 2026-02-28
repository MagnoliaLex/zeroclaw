// GeminiService.swift — {{APP_NAME}}
import Foundation

actor GeminiService {
    static let shared = GeminiService()
    private let apiKey: String
    private let endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

    private init() {
        self.apiKey = ProcessInfo.processInfo.environment["GEMINI_API_KEY"] ?? ""
    }

    func generate(prompt: String) async throws -> String {
        guard !apiKey.isEmpty else { return "[Gemini API key not configured]" }
        var request = URLRequest(url: URL(string: "\(endpoint)?key=\(apiKey)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["contents": [["parts": [["text": prompt]]]]]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let candidates = json["candidates"] as? [[String: Any]],
           let content = candidates.first?["content"] as? [String: Any],
           let parts = content["parts"] as? [[String: Any]],
           let text = parts.first?["text"] as? String { return text }
        return "[No response]"
    }
}
