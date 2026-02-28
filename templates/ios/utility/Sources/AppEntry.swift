// AppEntry.swift — {{APP_NAME}}
// Generated from ZeroClaw iOS utility archetype.
// Replace all {{VARIABLE}} placeholders before building.

import SwiftUI

@main
struct {{APP_NAME}}App: App {
    @StateObject private var historyStore = HistoryStore()
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                MainTabView()
                    .environmentObject(historyStore)
            } else {
                OnboardingView(onComplete: {
                    hasCompletedOnboarding = true
                })
            }
        }
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    @EnvironmentObject private var historyStore: HistoryStore

    var body: some View {
        TabView {
            ToolView()
                .tabItem {
                    Label("Tool", systemImage: "wrench.and.screwdriver")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .tint(Color("AccentColor"))
    }
}
