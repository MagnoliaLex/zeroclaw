// OnboardingView.swift — {{APP_NAME}}
// 4-screen onboarding flow using PageTabViewStyle.

import SwiftUI

private struct OnboardingPage: Identifiable {
    let id = UUID()
    let systemImage: String
    let imageColor: Color
    let title: String
    let body: String
}

private let pages: [OnboardingPage] = [
    OnboardingPage(
        systemImage: "sparkles.rectangle.stack.fill",
        imageColor: .purple,
        title: "Welcome to {{APP_NAME}}",
        body: "Your AI-powered assistant. Ask anything, generate content, and get intelligent answers instantly."
    ),
    OnboardingPage(
        systemImage: "bubble.left.and.bubble.right.fill",
        imageColor: .blue,
        title: "Natural Conversations",
        body: "Chat naturally. {{APP_NAME}} remembers your conversation context and responds with nuance."
    ),
    OnboardingPage(
        systemImage: "text.book.closed.fill",
        imageColor: .orange,
        title: "Prompt Library",
        body: "Start quickly with ready-made prompts for writing, coding, analysis, and creative tasks."
    ),
    OnboardingPage(
        systemImage: "lock.shield.fill",
        imageColor: .green,
        title: "Your Data, Your Control",
        body: "Conversations are stored locally on your device. AI requests are sent directly to Gemini — no middleman."
    )
]

struct OnboardingView: View {
    var onComplete: () -> Void
    @State private var currentPage = 0

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    OnboardingPageView(page: page).tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: currentPage)

            HStack(spacing: 8) {
                ForEach(0 ..< pages.count, id: \.self) { index in
                    Circle()
                        .fill(index == currentPage ? Color.accentColor : Color.secondary.opacity(0.4))
                        .frame(width: 8, height: 8)
                        .animation(.easeInOut, value: currentPage)
                }
            }
            .padding(.top, 16)

            HStack {
                if currentPage > 0 {
                    Button("Back") { currentPage -= 1 }
                        .buttonStyle(.bordered)
                }
                Spacer()
                if currentPage < pages.count - 1 {
                    Button("Next") { currentPage += 1 }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button("Start Chatting") { onComplete() }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
        }
        .background(Color(.systemGroupedBackground))
    }
}

private struct OnboardingPageView: View {
    let page: OnboardingPage

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            Image(systemName: page.systemImage)
                .font(.system(size: 80))
                .foregroundStyle(page.imageColor)
                .symbolRenderingMode(.hierarchical)
            VStack(spacing: 12) {
                Text(page.title)
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                Text(page.body)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            Spacer()
        }
    }
}

#Preview {
    OnboardingView(onComplete: {})
}
