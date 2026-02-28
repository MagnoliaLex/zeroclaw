// AISuggestionView.swift — {{APP_NAME}}
// Inline card showing an AI-generated suggestion or explanation for a tool result.

import SwiftUI

struct AISuggestionView: View {
    let isLoading: Bool
    let suggestion: String?
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("AI Suggestion", systemImage: "sparkles")
                    .font(.caption.bold())
                    .foregroundStyle(.purple)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            if isLoading {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Generating suggestion…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else if let text = suggestion {
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            } else {
                Text("No suggestion available.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color.purple.opacity(0.08), Color.blue.opacity(0.06)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.purple.opacity(0.2), lineWidth: 1)
        )
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .animation(.spring(duration: 0.35), value: isLoading)
    }
}

#Preview {
    VStack(spacing: 16) {
        AISuggestionView(isLoading: true, suggestion: nil, onDismiss: {})
        AISuggestionView(
            isLoading: false,
            suggestion: "3.28084 feet equals one meter. This conversion is commonly used when reading height specifications in US building codes.",
            onDismiss: {}
        )
    }
    .padding()
}
