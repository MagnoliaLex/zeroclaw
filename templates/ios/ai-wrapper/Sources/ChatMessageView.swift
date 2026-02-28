// ChatMessageView.swift — {{APP_NAME}}
// Renders a single chat message bubble with role-aware styling.

import SwiftUI

struct ChatMessageView: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 60)
                userBubble
            } else {
                assistantBubble
                Spacer(minLength: 60)
            }
        }
    }

    // MARK: - User Bubble

    private var userBubble: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(message.text)
                .font(.body)
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .textSelection(.enabled)

            Text(message.timestamp, style: .time)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Assistant Bubble

    private var assistantBubble: some View {
        HStack(alignment: .bottom, spacing: 8) {
            // Avatar
            Image(systemName: "sparkles")
                .font(.caption)
                .foregroundStyle(.purple)
                .frame(width: 28, height: 28)
                .background(Color.purple.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                if message.role == .error {
                    errorContent
                } else {
                    assistantContent
                }

                HStack(spacing: 6) {
                    if message.isStreaming {
                        TypingIndicator()
                    }
                    Text(message.timestamp, style: .time)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    if !message.isStreaming {
                        CopyButton(text: message.text)
                    }
                }
            }
        }
    }

    private var assistantContent: some View {
        Text(message.text)
            .font(.body)
            .foregroundStyle(.primary)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .textSelection(.enabled)
    }

    private var errorContent: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message.text)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

// MARK: - Typing Indicator

private struct TypingIndicator: View {
    @State private var dotOffset: CGFloat = 0

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0 ..< 3, id: \.self) { index in
                Circle()
                    .frame(width: 5, height: 5)
                    .foregroundStyle(.secondary)
                    .offset(y: dotOffset * (index % 2 == 0 ? -1 : 1))
                    .animation(
                        .easeInOut(duration: 0.5)
                        .repeatForever()
                        .delay(Double(index) * 0.15),
                        value: dotOffset
                    )
            }
        }
        .onAppear { dotOffset = 3 }
        .onDisappear { dotOffset = 0 }
    }
}

// MARK: - Copy Button

private struct CopyButton: View {
    let text: String
    @State private var copied = false

    var body: some View {
        Button {
            UIPasteboard.general.string = text
            copied = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
        } label: {
            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                .font(.caption2)
                .foregroundStyle(copied ? .green : .secondary)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    VStack(spacing: 12) {
        ChatMessageView(message: ChatMessage(role: .user, text: "What is the capital of France?"))
        ChatMessageView(message: ChatMessage(role: .assistant, text: "The capital of France is Paris."))
        ChatMessageView(message: ChatMessage(role: .error, text: "Network error: connection timed out."))
        ChatMessageView(message: ChatMessage(role: .assistant, text: "", isStreaming: true))
    }
    .padding()
}
