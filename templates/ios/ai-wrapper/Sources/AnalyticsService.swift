// AnalyticsService.swift — {{APP_NAME}}
// Analytics event stubs. Replace with your chosen analytics SDK.

import Foundation

enum AnalyticsEvent {
    static let messageSent = "message_sent"
    static let messageReceived = "message_received"
    static let generationCancelled = "generation_cancelled"
    static let conversationStarted = "conversation_started"
    static let conversationDeleted = "conversation_deleted"
    static let promptSelected = "prompt_selected"
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
    }

    func trackScreen(_ screenName: String) {
        #if DEBUG
        print("[Analytics] screen_view: \(screenName)")
        #endif
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
