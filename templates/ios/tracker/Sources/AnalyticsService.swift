// AnalyticsService.swift — {{APP_NAME}}
// Analytics event stubs. Replace with your chosen analytics SDK.

import Foundation

enum AnalyticsEvent {
    static let entryLogged = "entry_logged"
    static let entryEdited = "entry_edited"
    static let entriesDeleted = "entries_deleted"
    static let categoryCreated = "category_created"
    static let categoryEdited = "category_edited"
    static let aiInsightRequested = "ai_insight_requested"
    static let paywallViewed = "paywall_viewed"
    static let purchaseSuccess = "paywall_purchase_success"
    static let settingChanged = "setting_changed"
    static let onboardingCompleted = "onboarding_completed"
}

final class AnalyticsService {
    static let shared = AnalyticsService()
    private init() {}

    func trackEvent(_ name: String, properties: [String: String] = [:]) {
        #if DEBUG
        var parts = ["[Analytics] \(name)"]
        if !properties.isEmpty {
            let props = properties.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
            parts.append("{ \(props) }")
        }
        print(parts.joined(separator: " "))
        #endif
        // TODO: Replace with your analytics SDK call, e.g.:
        // Amplitude.instance().logEvent(name, withEventProperties: properties)
    }

    func trackScreen(_ screenName: String) {
        #if DEBUG
        print("[Analytics] screen_view: \(screenName)")
        #endif
        // TODO: Replace with your analytics SDK screen tracking call.
    }

    func identifyUser(id: String, properties: [String: String] = [:]) {
        #if DEBUG
        print("[Analytics] identify: \(id)")
        #endif
    }

    func resetUser() {
        #if DEBUG
        print("[Analytics] reset_user")
        #endif
    }
}
