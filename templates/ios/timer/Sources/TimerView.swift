// TimerView.swift — {{APP_NAME}}
import SwiftUI

struct TimerView: View {
    @State private var hours = 0
    @State private var minutes = 5
    @State private var seconds = 0
    @State private var timeRemaining = 0
    @State private var isRunning = false
    @State private var timer: Timer?

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            if isRunning || timeRemaining > 0 {
                Text(formatTime(timeRemaining))
                    .font(.system(size: 64, weight: .thin, design: .monospaced))
                    .foregroundStyle(timeRemaining <= 10 && timeRemaining > 0 ? .red : .primary)

                ZStack {
                    Circle().stroke(.gray.opacity(0.2), lineWidth: 8)
                    Circle().trim(from: 0, to: progress)
                        .stroke(Color(hex: "{{PRIMARY_COLOR}}"), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: timeRemaining)
                }
                .frame(width: 200, height: 200)
            } else {
                HStack(spacing: 0) {
                    Picker("Hours", selection: $hours) { ForEach(0..<24) { Text("\($0)h").tag($0) } }
                        .pickerStyle(.wheel).frame(width: 80)
                    Picker("Minutes", selection: $minutes) { ForEach(0..<60) { Text("\($0)m").tag($0) } }
                        .pickerStyle(.wheel).frame(width: 80)
                    Picker("Seconds", selection: $seconds) { ForEach(0..<60) { Text("\($0)s").tag($0) } }
                        .pickerStyle(.wheel).frame(width: 80)
                }
            }

            Spacer()

            HStack(spacing: 20) {
                if isRunning {
                    Button("Pause") { pause() }
                        .buttonStyle(.bordered).controlSize(.large)
                    Button("Stop") { stop() }
                        .buttonStyle(.bordered).controlSize(.large).tint(.red)
                } else if timeRemaining > 0 {
                    Button("Resume") { start() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    Button("Reset") { stop() }
                        .buttonStyle(.bordered).controlSize(.large).tint(.red)
                } else {
                    Button("Start") {
                        timeRemaining = hours * 3600 + minutes * 60 + seconds
                        if timeRemaining > 0 { start() }
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .disabled(hours == 0 && minutes == 0 && seconds == 0)
                }
            }
        }
        .padding()
        .navigationTitle("Timer")
        .onAppear { AnalyticsService.shared.trackScreen("Timer") }
    }

    private var totalTime: Int { hours * 3600 + minutes * 60 + seconds }
    private var progress: CGFloat { totalTime > 0 ? CGFloat(timeRemaining) / CGFloat(totalTime) : 0 }

    private func formatTime(_ total: Int) -> String {
        let h = total / 3600; let m = (total % 3600) / 60; let s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }

    private func start() {
        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if timeRemaining > 0 { timeRemaining -= 1 } else { stop(); sendNotification() }
        }
    }

    private func pause() { isRunning = false; timer?.invalidate() }
    private func stop() { isRunning = false; timer?.invalidate(); timeRemaining = 0 }

    private func sendNotification() {
        let content = UNMutableNotificationContent()
        content.title = "{{APP_NAME}}"
        content.body = "Timer complete!"
        content.sound = .default
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
