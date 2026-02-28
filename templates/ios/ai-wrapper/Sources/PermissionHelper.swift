// PermissionHelper.swift — {{APP_NAME}}
// Permission request helpers. Remove unused methods before shipping.

import AVFoundation
import SwiftUI
import UserNotifications

enum PermissionStatus {
    case notDetermined
    case authorized
    case denied
    case restricted
}

@MainActor
final class PermissionHelper: ObservableObject {
    static let shared = PermissionHelper()

    @Published var notificationStatus: PermissionStatus = .notDetermined
    @Published var microphoneStatus: PermissionStatus = .notDetermined

    private init() {}

    func checkNotificationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationStatus = map(settings.authorizationStatus)
    }

    func requestNotificationPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            notificationStatus = granted ? .authorized : .denied
            return granted
        } catch {
            notificationStatus = .denied
            return false
        }
    }

    func checkMicrophoneStatus() {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        microphoneStatus = mapAV(status)
    }

    func requestMicrophonePermission() async -> Bool {
        let granted = await AVCaptureDevice.requestAccess(for: .audio)
        microphoneStatus = granted ? .authorized : .denied
        return granted
    }

    func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func map(_ status: UNAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized, .ephemeral, .provisional: return .authorized
        case .denied: return .denied
        @unknown default: return .notDetermined
        }
    }

    private func mapAV(_ status: AVAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .notDetermined
        }
    }
}
