// ChatView.swift — {{APP_NAME}}
// Main chat interface with streaming message display.

import SwiftUI

struct ChatView: View {
    @EnvironmentObject private var chatStore: ChatStore
    @State private var inputText = ""
    @State private var showingSystemPromptEditor = false
    @AppStorage("systemPrompt") private var systemPrompt = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Message list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if chatStore.activeConversation?.messages.isEmpty ?? true {
                            EmptyStateView()
                        } else {
                            ForEach(chatStore.activeConversation?.messages ?? []) { message in
                                ChatMessageView(message: message)
                                    .id(message.id)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .onChange(of: chatStore.activeConversation?.messages.count) { _, _ in
                    if let lastID = chatStore.activeConversation?.messages.last?.id {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo(lastID, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Input bar
            InputBarView(
                inputText: $inputText,
                isGenerating: chatStore.isGenerating,
                isFocused: $inputFocused,
                onSend: {
                    let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return }
                    inputText = ""
                    chatStore.sendMessage(text, systemPrompt: systemPrompt.isEmpty ? nil : systemPrompt)
                },
                onCancel: {
                    chatStore.cancelGeneration()
                }
            )
        }
        .navigationTitle(chatStore.activeConversation?.title ?? "{{APP_NAME}}")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showingSystemPromptEditor = true
                    } label: {
                        Label("System Prompt", systemImage: "text.badge.plus")
                    }
                    Button(role: .destructive) {
                        chatStore.startNewConversation()
                    } label: {
                        Label("New Chat", systemImage: "square.and.pencil")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingSystemPromptEditor) {
            SystemPromptEditorView(systemPrompt: $systemPrompt)
        }
        .onReceive(NotificationCenter.default.publisher(for: .seedPrompt)) { note in
            if let prompt = note.object as? String {
                inputText = prompt
                inputFocused = true
            }
        }
        .onAppear {
            AnalyticsService.shared.trackScreen("ChatView")
        }
    }
}

// MARK: - Empty State

private struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 60)
            Image(systemName: "sparkles")
                .font(.system(size: 56))
                .foregroundStyle(.purple)
                .symbolRenderingMode(.hierarchical)
            Text("Start a conversation")
                .font(.title3.bold())
            Text("Ask anything or choose a prompt from the library.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer(minLength: 40)
        }
    }
}

// MARK: - Input Bar

private struct InputBarView: View {
    @Binding var inputText: String
    let isGenerating: Bool
    var isFocused: FocusState<Bool>.Binding
    let onSend: () -> Void
    let onCancel: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Message…", text: $inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1 ... 6)
                .focused(isFocused)
                .padding(10)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                .onSubmit {
                    if !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        onSend()
                    }
                }

            if isGenerating {
                Button(action: onCancel) {
                    Image(systemName: "stop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.red)
                }
                .buttonStyle(.plain)
            } else {
                Button(action: onSend) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .accentColor)
                }
                .buttonStyle(.plain)
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.systemBackground))
    }
}

// MARK: - System Prompt Editor

private struct SystemPromptEditorView: View {
    @Binding var systemPrompt: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $systemPrompt)
                        .frame(minHeight: 150)
                } header: {
                    Text("System Prompt")
                } footer: {
                    Text("Define the AI's behavior and persona. Applied to all new messages in the current session.")
                }
            }
            .navigationTitle("System Prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear") { systemPrompt = "" }
                        .foregroundStyle(.red)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ChatView()
            .environmentObject(ChatStore())
    }
}
