// SettingsView.swift — {{APP_NAME}}
import SwiftUI

struct SettingsView: View {
    @State private var showingPaywall = false
    private let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"

    var body: some View {
        Form {
            Section("Premium") {
                Button { showingPaywall = true } label: {
                    Label("Upgrade to Premium", systemImage: "star.fill").foregroundStyle(.yellow)
                }
            }
            Section("Support") {
                Label("Version \(appVersion)", systemImage: "info.circle")
                Label("{{BUNDLE_ID}}", systemImage: "app.badge")
            }
        }
        .navigationTitle("Settings")
        .sheet(isPresented: $showingPaywall) { PaywallView() }
        .onAppear { AnalyticsService.shared.trackScreen("Settings") }
    }
}
