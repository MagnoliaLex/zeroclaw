// ContentView.swift — {{APP_NAME}}
import SwiftUI

struct ContentView: View {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some View {
        if hasCompletedOnboarding {
            NavigationSplitView {
                CategoryListView()
            } detail: {
                Text("Select a category to browse articles")
                    .foregroundStyle(.secondary)
            }
        } else {
            OnboardingView()
        }
    }
}
