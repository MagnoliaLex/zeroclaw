// OnboardingView.swift — {{APP_NAME}}
// 4-screen onboarding flow using PageTabViewStyle.

import SwiftUI

struct OnboardingPage: Identifiable {
    let id = UUID()
    let systemImage: String
    let imageColor: Color
    let title: String
    let body: String
}

private let pages: [OnboardingPage] = [
    OnboardingPage(
        systemImage: "wrench.and.screwdriver.fill",
        imageColor: .blue,
        title: "Welcome to {{APP_NAME}}",
        body: "A powerful utility tool built for speed and simplicity."
    ),
    OnboardingPage(
        systemImage: "clock.arrow.circlepath",
        imageColor: .orange,
        title: "Track Your History",
        body: "Every calculation or conversion is saved so you can review and reuse past results."
    ),
    OnboardingPage(
        systemImage: "sparkles",
        imageColor: .purple,
        title: "AI-Powered Suggestions",
        body: "Tap the sparkle icon to get smart suggestions and explanations powered by Gemini."
    ),
    OnboardingPage(
        systemImage: "lock.shield.fill",
        imageColor: .green,
        title: "Privacy First",
        body: "Your data stays on your device. AI features are opt-in and use only the input you provide."
    )
]

struct OnboardingView: View {
    var onComplete: () -> Void
    @State private var currentPage = 0

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    OnboardingPageView(page: page)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: currentPage)

            // Page dots
            HStack(spacing: 8) {
                ForEach(0 ..< pages.count, id: \.self) { index in
                    Circle()
                        .fill(index == currentPage ? Color.accentColor : Color.secondary.opacity(0.4))
                        .frame(width: 8, height: 8)
                        .animation(.easeInOut, value: currentPage)
                }
            }
            .padding(.top, 16)

            // Navigation buttons
            HStack {
                if currentPage > 0 {
                    Button("Back") {
                        currentPage -= 1
                    }
                    .buttonStyle(.bordered)
                }

                Spacer()

                if currentPage < pages.count - 1 {
                    Button("Next") {
                        currentPage += 1
                    }
                    .buttonStyle(.borderedProminent)
                } else {
                    Button("Get Started") {
                        onComplete()
                    }
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
