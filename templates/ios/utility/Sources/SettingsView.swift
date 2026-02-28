// SettingsView.swift — {{APP_NAME}}
// App preferences, about info, and support link.

import StoreKit
import SwiftUI

struct SettingsView: View {
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("enableAISuggestions") private var enableAISuggestions = true
    @AppStorage("historyRetentionDays") private var historyRetentionDays = 30
    @State private var showingPaywall = false

    private let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    private let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

    var body: some View {
        NavigationStack {
            Form {
                // MARK: - Preferences
                Section("Preferences") {
                    Toggle("Haptic Feedback", isOn: $enableHaptics)
                    Toggle("AI Suggestions", isOn: $enableAISuggestions)

                    Stepper(
                        "History: \(historyRetentionDays) days",
                        value: $historyRetentionDays,
                        in: 7 ... 365,
                        step: 7
                    )
                }

                // MARK: - Premium
                Section("Premium") {
                    Button {
                        showingPaywall = true
                    } label: {
                        Label("Upgrade to Premium", systemImage: "star.fill")
                            .foregroundStyle(.yellow)
                    }
                }

                // MARK: - Support
                Section("Support") {
                    Link(destination: URL(string: "{{SUPPORT_URL}}")!) {
                        Label("Get Help", systemImage: "questionmark.circle")
                    }

                    Link(destination: URL(string: "https://apps.apple.com/app/id{{APPLE_APP_ID}}")!) {
                        Label("Rate {{APP_NAME}}", systemImage: "heart")
                    }

                    Link(destination: URL(string: "{{PRIVACY_POLICY_URL}}")!) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }
                }

                // MARK: - About
                Section("About") {
                    LabeledContent("Version", value: "\(appVersion) (\(buildNumber))")
                    LabeledContent("Bundle ID", value: "{{BUNDLE_ID}}")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingPaywall) {
                PaywallView()
            }
        }
    }
}

#Preview {
    SettingsView()
}
