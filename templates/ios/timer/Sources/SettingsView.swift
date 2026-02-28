// SettingsView.swift — {{APP_NAME}}
import SwiftUI

struct SettingsView: View {
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("enableSound") private var enableSound = true
    @State private var showingPaywall = false

    var body: some View {
        Form {
            Section("Timer") {
                Toggle("Haptic Feedback", isOn: $enableHaptics)
                Toggle("Completion Sound", isOn: $enableSound)
            }
            Section("Premium") {
                Button { showingPaywall = true } label: {
                    Label("Upgrade to Premium", systemImage: "star.fill").foregroundStyle(.yellow)
                }
            }
            Section("About") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                LabeledContent("Bundle ID", value: "{{BUNDLE_ID}}")
            }
        }
        .navigationTitle("Settings")
        .sheet(isPresented: $showingPaywall) { PaywallView() }
        .onAppear { AnalyticsService.shared.trackScreen("Settings") }
    }
}
