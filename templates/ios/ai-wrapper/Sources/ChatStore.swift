// ChatStore.swift — {{APP_NAME}}
// Observable store managing conversations and message history.

import Foundation
import SwiftUI

// MARK: - Models

struct ChatMessage: Identifiable, Codable, Equatable {
    enum Role: String, Codable {
        case user
        case assistant
        case error
    }

    let id: UUID
    let role: Role
    var text: String
    let timestamp: Date
    var isStreaming: Bool

    init(id: UUID = UUID(), role: Role, text: String, timestamp: Date = .now, isStreaming: Bool = false) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.isStreaming = isStreaming
    }

    var geminiRole: String {
        switch role {
        case .user: return "user"
        case .assistant, .error: return "model"
        }
    }
}

struct Conversation: Identifiable, Codable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), title: String = "New Conversation") {
        self.id = id
        self.title = title
        self.messages = []
        self.createdAt = .now
        self.updatedAt = .now
    }

    var preview: String {
        messages.last?.text.prefix(60).description ?? "No messages yet"
    }
}

// MARK: - Chat Store

@MainActor
final class ChatStore: ObservableObject {
    @Published private(set) var conversations: [Conversation] = []
    @Published private(set) var activeConversation: Conversation?
    @Published var isGenerating = false
    @Published var errorMessage: String?

    private let storageKey = "{{BUNDLE_ID}}.conversations"
    private let gemini = GeminiService.shared
    private var streamTask: Task<Void, Never>?

    init() {
        load()
        if conversations.isEmpty {
            startNewConversation()
        } else {
            activeConversation = conversations.first
        }
    }

    // MARK: - Conversation Management

    func startNewConversation() {
        let conv = Conversation()
        conversations.insert(conv, at: 0)
        activeConversation = conv
        save()
    }

    func selectConversation(_ conversation: Conversation) {
        activeConversation = conversations.first(where: { $0.id == conversation.id })
    }

    func deleteConversation(_ conversation: Conversation) {
        conversations.removeAll { $0.id == conversation.id }
        if activeConversation?.id == conversation.id {
            activeConversation = conversations.first
        }
        if activeConversation == nil {
            startNewConversation()
        }
        save()
    }

    /// Seeds the input field with a prompt from the library (does not send yet).
    func seedPrompt(_ prompt: String) {
        // Handled by ChatView via binding — this is a pass-through signal.
        NotificationCenter.default.post(name: .seedPrompt, object: prompt)
    }

    // MARK: - Messaging

    func sendMessage(_ text: String, systemPrompt: String? = nil) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard var conv = activeConversation else { return }

        errorMessage = nil

        let userMsg = ChatMessage(role: .user, text: text)
        conv.messages.append(userMsg)

        // Auto-title from first message
        if conv.title == "New Conversation" {
            conv.title = String(text.prefix(40))
        }
        conv.updatedAt = .now
        updateActive(conv)

        // Build history for API
        let history: [GeminiMessage] = conv.messages
            .filter { $0.role != .error }
            .map { GeminiMessage(role: $0.geminiRole, parts: [.init(text: $0.text)]) }

        AnalyticsService.shared.trackEvent("message_sent", properties: [
            "conversation_id": conv.id.uuidString
        ])

        streamTask?.cancel()
        streamTask = Task { await streamResponse(history: history, systemPrompt: systemPrompt) }
    }

    func cancelGeneration() {
        streamTask?.cancel()
        streamTask = nil
        if var conv = activeConversation,
           let lastIdx = conv.messages.indices.last,
           conv.messages[lastIdx].isStreaming {
            conv.messages[lastIdx].isStreaming = false
            updateActive(conv)
        }
        isGenerating = false
    }

    // MARK: - Streaming

    private func streamResponse(history: [GeminiMessage], systemPrompt: String?) async {
        guard var conv = activeConversation else { return }

        var assistantMsg = ChatMessage(role: .assistant, text: "", isStreaming: true)
        conv.messages.append(assistantMsg)
        updateActive(conv)
        isGenerating = true

        do {
            for try await chunk in gemini.generateStream(messages: history, systemPrompt: systemPrompt) {
                guard !Task.isCancelled else { break }
                assistantMsg.text += chunk
                updateLastMessage(assistantMsg)
            }
        } catch {
            if !Task.isCancelled {
                assistantMsg.text = error.localizedDescription
                assistantMsg = ChatMessage(id: assistantMsg.id, role: .error, text: error.localizedDescription)
                updateLastMessage(assistantMsg)
                errorMessage = error.localizedDescription
            }
        }

        assistantMsg.isStreaming = false
        updateLastMessage(assistantMsg)
        isGenerating = false
        save()
    }

    // MARK: - Helpers

    private func updateActive(_ conv: Conversation) {
        activeConversation = conv
        if let idx = conversations.firstIndex(where: { $0.id == conv.id }) {
            conversations[idx] = conv
        }
    }

    private func updateLastMessage(_ message: ChatMessage) {
        guard var conv = activeConversation,
              let idx = conv.messages.lastIndex(where: { $0.id == message.id })
        else { return }
        conv.messages[idx] = message
        updateActive(conv)
    }

    // MARK: - Persistence

    private func save() {
        guard let data = try? JSONEncoder().encode(conversations) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([Conversation].self, from: data)
        else { return }
        conversations = decoded
    }
}

// MARK: - Notification Name

extension Notification.Name {
    static let seedPrompt = Notification.Name("{{BUNDLE_ID}}.seedPrompt")
}
