// AnalyticsService.swift — {{APP_NAME}}
import Foundation

enum AnalyticsEvent: String {
    case appLaunched, paywallViewed, purchaseCompleted, settingChanged, articleViewed, bookmarkAdded
}

final class AnalyticsService {
    static let shared = AnalyticsService()
    private init() {}
    func trackEvent(_ event: AnalyticsEvent, properties: [String: String] = [:]) {
        #if DEBUG
        print("[Analytics] \(event.rawValue) \(properties)")
        #endif
    }
    func trackScreen(_ name: String) {
        #if DEBUG
        print("[Analytics] Screen: \(name)")
        #endif
    }
}
