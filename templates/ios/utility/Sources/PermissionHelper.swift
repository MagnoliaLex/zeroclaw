// PermissionHelper.swift — {{APP_NAME}}
// Permission request helpers. Only request permissions the app actually uses.
// Remove unused permission methods to keep the bundle minimal.

import AVFoundation
import Photos
import SwiftUI
import UserNotifications

// MARK: - Permission Status

enum PermissionStatus {
    case notDetermined
    case authorized
    case denied
    case restricted
}

// MARK: - Permission Helper

@MainActor
final class PermissionHelper: ObservableObject {
    static let shared = PermissionHelper()

    @Published var notificationStatus: PermissionStatus = .notDetermined
    @Published var cameraStatus: PermissionStatus = .notDetermined
    @Published var photoLibraryStatus: PermissionStatus = .notDetermined

    private init() {}

    // MARK: - Notifications

    func checkNotificationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationStatus = mapAuthorizationStatus(settings.authorizationStatus)
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

    // MARK: - Camera

    func checkCameraStatus() {
        cameraStatus = mapAVAuthorizationStatus(AVCaptureDevice.authorizationStatus(for: .video))
    }

    func requestCameraPermission() async -> Bool {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        cameraStatus = granted ? .authorized : .denied
        return granted
    }

    // MARK: - Photo Library

    func checkPhotoLibraryStatus() {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        photoLibraryStatus = mapPHAuthorizationStatus(status)
    }

    func requestPhotoLibraryPermission() async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        photoLibraryStatus = mapPHAuthorizationStatus(status)
        return status == .authorized || status == .limited
    }

    // MARK: - Deep Link to Settings

    func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    // MARK: - Mapping Helpers

    private func mapAuthorizationStatus(_ status: UNAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized, .ephemeral, .provisional: return .authorized
        case .denied: return .denied
        @unknown default: return .notDetermined
        }
    }

    private func mapAVAuthorizationStatus(_ status: AVAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .notDetermined
        }
    }

    private func mapPHAuthorizationStatus(_ status: PHAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized, .limited: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .notDetermined
        }
    }
}

// MARK: - Permission Banner View

/// Drop-in banner to prompt users who have denied a critical permission.
struct PermissionBannerView: View {
    let permissionName: String
    let reason: String
    let onOpenSettings: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(permissionName) permission required")
                    .font(.subheadline.bold())
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button("Settings", action: onOpenSettings)
                .font(.caption.bold())
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}
