// SettingsView.swift — {{APP_NAME}}
// App preferences, model settings, and support links.

import StoreKit
import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("streamingEnabled") private var streamingEnabled = true
    @AppStorage("temperature") private var temperature = 0.7
    @AppStorage("systemPrompt") private var systemPrompt = ""
    @State private var showingPaywall = false

    private let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    private let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

    var body: some View {
        NavigationStack {
            Form {
                Section("Model") {
                    Toggle("Streaming Responses", isOn: $streamingEnabled)

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Temperature")
                            Spacer()
                            Text(String(format: "%.1f", temperature))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Slider(value: $temperature, in: 0 ... 1, step: 0.1)
                        Text("Lower = more focused. Higher = more creative.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Interface") {
                    Toggle("Haptic Feedback", isOn: $enableHaptics)
                }

                Section("Premium") {
                    Button {
                        showingPaywall = true
                    } label: {
                        Label("Upgrade to Premium", systemImage: "star.fill")
                            .foregroundStyle(.yellow)
                    }
                }

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

                Section("About") {
                    LabeledContent("Version", value: "\(appVersion) (\(buildNumber))")
                    LabeledContent("Bundle ID", value: "{{BUNDLE_ID}}")
                    LabeledContent("Model", value: "Gemini 1.5 Flash")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showingPaywall) {
                PaywallView()
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("SettingsView")
            }
        }
    }
}

#Preview {
    SettingsView()
}
