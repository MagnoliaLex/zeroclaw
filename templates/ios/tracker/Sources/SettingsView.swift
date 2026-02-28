// SettingsView.swift — {{APP_NAME}}
// App preferences, notifications, and support links.

import StoreKit
import SwiftUI

struct SettingsView: View {
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("enableDailyReminder") private var enableDailyReminder = false
    @AppStorage("reminderHour") private var reminderHour = 20
    @AppStorage("reminderMinute") private var reminderMinute = 0
    @State private var showingPaywall = false
    @State private var reminderTime = Date()

    private let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    private let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

    var body: some View {
        Form {
            Section("Notifications") {
                Toggle("Daily Reminder", isOn: $enableDailyReminder)
                    .onChange(of: enableDailyReminder) { _, enabled in
                        handleReminderToggle(enabled: enabled)
                    }

                if enableDailyReminder {
                    DatePicker(
                        "Reminder Time",
                        selection: $reminderTime,
                        displayedComponents: .hourAndMinute
                    )
                    .onChange(of: reminderTime) { _, newTime in
                        scheduleReminder(at: newTime)
                    }
                }
            }

            Section("Interface") {
                Toggle("Haptic Feedback", isOn: $enableHaptics)
            }

            Section("Premium") {
                Button {
                    showingPaywall = true
                    AnalyticsService.shared.trackEvent(AnalyticsEvent.paywallViewed)
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
                LabeledContent("AI Model", value: "Gemini 1.5 Flash")
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingPaywall) {
            PaywallView()
        }
        .onAppear {
            AnalyticsService.shared.trackScreen("SettingsView")
            loadReminderTime()
        }
    }

    // MARK: - Reminder Helpers

    private func loadReminderTime() {
        var components = DateComponents()
        components.hour = reminderHour
        components.minute = reminderMinute
        if let date = Calendar.current.date(from: components) {
            reminderTime = date
        }
    }

    private func handleReminderToggle(enabled: Bool) {
        if enabled {
            Task {
                let granted = await PermissionHelper.shared.requestNotificationPermission()
                if granted {
                    scheduleReminder(at: reminderTime)
                } else {
                    await MainActor.run { enableDailyReminder = false }
                    PermissionHelper.shared.openAppSettings()
                }
            }
        } else {
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["daily_reminder"])
        }
        AnalyticsService.shared.trackEvent(AnalyticsEvent.settingChanged, properties: [
            "setting": "daily_reminder",
            "value": enabled ? "on" : "off"
        ])
    }

    private func scheduleReminder(at time: Date) {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: time)
        let minute = calendar.component(.minute, from: time)
        reminderHour = hour
        reminderMinute = minute

        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["daily_reminder"])

        let content = UNMutableNotificationContent()
        content.title = "{{APP_NAME}}"
        content.body = "Time to log today's progress. Keep your streak going!"
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: "daily_reminder", content: content, trigger: trigger)
        center.add(request)
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
