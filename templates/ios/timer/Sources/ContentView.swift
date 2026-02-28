// ContentView.swift — {{APP_NAME}}
import SwiftUI

struct ContentView: View {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some View {
        if hasCompletedOnboarding {
            TabView {
                NavigationStack { TimerView() }
                    .tabItem { Label("Timer", systemImage: "timer") }
                NavigationStack { StopwatchView() }
                    .tabItem { Label("Stopwatch", systemImage: "stopwatch") }
                NavigationStack { PresetsView() }
                    .tabItem { Label("Presets", systemImage: "list.bullet") }
                NavigationStack { SettingsView() }
                    .tabItem { Label("Settings", systemImage: "gear") }
            }
            .tint(Color(hex: "{{PRIMARY_COLOR}}"))
        } else {
            OnboardingView()
        }
    }
}
