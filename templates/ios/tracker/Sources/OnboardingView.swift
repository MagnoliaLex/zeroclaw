// OnboardingView.swift — {{APP_NAME}}
// 5-screen onboarding flow using PageTabViewStyle.

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
        systemImage: "chart.bar.doc.horizontal.fill",
        imageColor: Color("{{PRIMARY_COLOR}}"),
        title: "Welcome to {{APP_NAME}}",
        body: "Track your daily habits and goals in one place. Visualize progress and stay motivated every day."
    ),
    OnboardingPage(
        systemImage: "plus.circle.fill",
        imageColor: .blue,
        title: "Quick Logging",
        body: "Log entries in seconds. Tap a category card on the dashboard to record your progress instantly."
    ),
    OnboardingPage(
        systemImage: "chart.line.uptrend.xyaxis",
        imageColor: .green,
        title: "Trend Charts",
        body: "See weekly and monthly trends at a glance. Understand your patterns and beat your personal bests."
    ),
    OnboardingPage(
        systemImage: "sparkles",
        imageColor: .purple,
        title: "AI Insights",
        body: "Get personalized tips and motivational insights powered by Gemini AI based on your actual data."
    ),
    OnboardingPage(
        systemImage: "lock.shield.fill",
        imageColor: .orange,
        title: "Private by Default",
        body: "All your data stays on your device. No account required. Your habits are yours alone."
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
                    Button("Start Tracking") {
                        AnalyticsService.shared.trackEvent(AnalyticsEvent.onboardingCompleted)
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
