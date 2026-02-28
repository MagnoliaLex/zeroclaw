// AppEntry.swift — {{APP_NAME}}
// Generated from ZeroClaw iOS tracker archetype.
// Replace all {{VARIABLE}} placeholders before building.

import SwiftData
import SwiftUI

@main
struct {{APP_NAME}}App: App {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([TrackerEntry.self, TrackerCategory.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                MainTabView()
            } else {
                OnboardingView(onComplete: {
                    hasCompletedOnboarding = true
                })
            }
        }
        .modelContainer(sharedModelContainer)
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    @State private var showingEntryForm = false

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }

            // "Add Entry" tab: tapping opens the entry form sheet immediately.
            Color.clear
                .tabItem {
                    Label("Add Entry", systemImage: "plus.circle.fill")
                }
                .onAppear { showingEntryForm = true }

            NavigationStack {
                HistoryView()
            }
            .tabItem {
                Label("History", systemImage: "clock.arrow.circlepath")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
        }
        .tint(Color("AccentColor"))
        .sheet(isPresented: $showingEntryForm) {
            EntryFormView()
        }
    }
}
