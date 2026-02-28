// AppEntry.swift — {{APP_NAME}}
// Generated from ZeroClaw iOS ai-wrapper archetype.
// Replace all {{VARIABLE}} placeholders before building.

import SwiftUI

@main
struct {{APP_NAME}}App: App {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @StateObject private var chatStore = ChatStore()

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                ChatRootView()
                    .environmentObject(chatStore)
            } else {
                OnboardingView(onComplete: {
                    hasCompletedOnboarding = true
                })
            }
        }
    }
}

// MARK: - Chat Root View

struct ChatRootView: View {
    @EnvironmentObject private var chatStore: ChatStore
    @State private var showingPaywall = false
    @State private var showingSettings = false
    @State private var showingPromptLibrary = false

    var body: some View {
        NavigationStack {
            ChatView()
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showingPromptLibrary = true
                        } label: {
                            Image(systemName: "text.book.closed")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        HStack(spacing: 12) {
                            Button {
                                chatStore.startNewConversation()
                            } label: {
                                Image(systemName: "square.and.pencil")
                            }
                            Button {
                                showingSettings = true
                            } label: {
                                Image(systemName: "gearshape")
                            }
                        }
                    }
                }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showingPaywall) {
            PaywallView()
        }
        .sheet(isPresented: $showingPromptLibrary) {
            PromptLibraryView { prompt in
                chatStore.seedPrompt(prompt)
                showingPromptLibrary = false
            }
        }
    }
}
