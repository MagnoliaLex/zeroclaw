// AnalyticsService.swift — {{APP_NAME}}
// Analytics event stubs. Replace the stub implementations with your chosen
// analytics SDK (e.g., Firebase Analytics, Mixpanel, Amplitude, PostHog).
// This file intentionally contains no third-party dependencies.

import Foundation

// MARK: - Event Names

enum AnalyticsEvent {
    // Screens
    static let screenTool = "screen_tool"
    static let screenHistory = "screen_history"
    static let screenSettings = "screen_settings"
    static let screenPaywall = "screen_paywall"
    static let screenOnboarding = "screen_onboarding"

    // Onboarding
    static let onboardingStarted = "onboarding_started"
    static let onboardingCompleted = "onboarding_completed"
    static let onboardingSkipped = "onboarding_skipped"

    // Tool actions
    static let toolUsed = "tool_used"
    static let resultCopied = "result_copied"
    static let resultShared = "result_shared"
    static let historyItemTapped = "history_item_tapped"
    static let historyCleared = "history_cleared"

    // AI
    static let aiSuggestionRequested = "ai_suggestion_requested"
    static let aiSuggestionReceived = "ai_suggestion_received"
    static let aiSuggestionError = "ai_suggestion_error"

    // Paywall
    static let paywallViewed = "paywall_viewed"
    static let paywallDismissed = "paywall_dismissed"
    static let purchaseStarted = "purchase_started"
    static let purchaseSuccess = "paywall_purchase_success"
    static let purchaseFailed = "purchase_failed"
    static let restoreStarted = "restore_started"
    static let restoreSuccess = "restore_success"

    // Settings
    static let settingChanged = "setting_changed"
}

// MARK: - Analytics Service

final class AnalyticsService {
    static let shared = AnalyticsService()

    private init() {}

    /// Track a named event with optional string properties.
    func trackEvent(_ name: String, properties: [String: String] = [:]) {
        // TODO: Replace this stub with your analytics SDK call.
        // Example (Firebase):
        //   Analytics.logEvent(name, parameters: properties)
        // Example (Mixpanel):
        //   Mixpanel.mainInstance().track(event: name, properties: properties)
        #if DEBUG
        var parts = ["[Analytics] \(name)"]
        if !properties.isEmpty {
            let props = properties.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
            parts.append("{ \(props) }")
        }
        print(parts.joined(separator: " "))
        #endif
    }

    /// Track a screen view.
    func trackScreen(_ screenName: String, screenClass: String? = nil) {
        // TODO: Replace with your analytics SDK screen tracking call.
        // Example (Firebase):
        //   Analytics.logEvent(AnalyticsEventScreenView, parameters: [
        //       AnalyticsParameterScreenName: screenName,
        //       AnalyticsParameterScreenClass: screenClass ?? screenName
        //   ])
        #if DEBUG
        print("[Analytics] screen_view: \(screenName)")
        #endif
    }

    /// Identify the current user (call after sign-in or premium purchase).
    func identifyUser(id: String, properties: [String: String] = [:]) {
        // TODO: Replace with your analytics SDK user identification call.
        // Example (Mixpanel):
        //   Mixpanel.mainInstance().identify(distinctId: id)
        #if DEBUG
        print("[Analytics] identify: \(id)")
        #endif
    }

    /// Reset user identity (call on sign-out).
    func resetUser() {
        // TODO: Replace with your analytics SDK reset call.
        #if DEBUG
        print("[Analytics] reset_user")
        #endif
    }
}
