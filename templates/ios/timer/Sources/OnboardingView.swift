// OnboardingView.swift — {{APP_NAME}}
import SwiftUI

struct OnboardingView: View {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var currentPage = 0

    private let pages: [(title: String, subtitle: String, icon: String)] = [
        ("Welcome to {{APP_NAME}}", "Your all-in-one timer companion", "timer"),
        ("Countdown Timer", "Set precise durations with visual progress", "hourglass"),
        ("Stopwatch", "Track elapsed time with lap support", "stopwatch"),
        ("Quick Presets", "One-tap timers for common activities", "list.bullet"),
    ]

    var body: some View {
        TabView(selection: $currentPage) {
            ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                VStack(spacing: 24) {
                    Spacer()
                    Image(systemName: page.icon).font(.system(size: 64)).foregroundStyle(Color(hex: "{{PRIMARY_COLOR}}"))
                    Text(page.title).font(.title).bold().multilineTextAlignment(.center)
                    Text(page.subtitle).font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Spacer()
                    if index == pages.count - 1 {
                        Button("Get Started") {
                            Task { let _ = await PermissionHelper.shared.requestNotificationPermission() }
                            hasCompletedOnboarding = true
                        }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    }
                    Spacer().frame(height: 60)
                }
                .padding().tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0; Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6: (r, g, b) = (Double((int >> 16) & 0xFF) / 255, Double((int >> 8) & 0xFF) / 255, Double(int & 0xFF) / 255)
        default: (r, g, b) = (0, 0, 0)
        }
        self.init(red: r, green: g, blue: b)
    }
}
