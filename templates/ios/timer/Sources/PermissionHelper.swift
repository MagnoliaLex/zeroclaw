// PermissionHelper.swift — {{APP_NAME}}
import UIKit
import UserNotifications

final class PermissionHelper {
    static let shared = PermissionHelper()
    private init() {}

    func requestNotificationPermission() async -> Bool {
        do { return try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) }
        catch { return false }
    }

    func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            Task { @MainActor in UIApplication.shared.open(url) }
        }
    }
}
