// StopwatchView.swift — {{APP_NAME}}
import SwiftUI

struct StopwatchView: View {
    @State private var elapsed: TimeInterval = 0
    @State private var isRunning = false
    @State private var laps: [TimeInterval] = []
    @State private var timer: Timer?
    @State private var startDate: Date?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text(formatInterval(elapsed))
                .font(.system(size: 56, weight: .thin, design: .monospaced))

            HStack(spacing: 20) {
                if isRunning {
                    Button("Lap") { laps.insert(elapsed, at: 0) }
                        .buttonStyle(.bordered).controlSize(.large)
                    Button("Stop") { stop() }
                        .buttonStyle(.bordered).controlSize(.large).tint(.red)
                } else if elapsed > 0 {
                    Button("Resume") { start() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    Button("Reset") { reset() }
                        .buttonStyle(.bordered).controlSize(.large).tint(.red)
                } else {
                    Button("Start") { start() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                }
            }

            if !laps.isEmpty {
                List {
                    ForEach(Array(laps.enumerated()), id: \.offset) { index, lap in
                        HStack {
                            Text("Lap \(laps.count - index)").foregroundStyle(.secondary)
                            Spacer()
                            Text(formatInterval(lap)).font(.system(.body, design: .monospaced))
                        }
                    }
                }
                .listStyle(.plain)
            } else {
                Spacer()
            }
        }
        .padding()
        .navigationTitle("Stopwatch")
        .onAppear { AnalyticsService.shared.trackScreen("Stopwatch") }
    }

    private func formatInterval(_ interval: TimeInterval) -> String {
        let mins = Int(interval) / 60; let secs = Int(interval) % 60; let ms = Int((interval.truncatingRemainder(dividingBy: 1)) * 100)
        return String(format: "%02d:%02d.%02d", mins, secs, ms)
    }

    private func start() {
        isRunning = true
        let base = elapsed
        startDate = Date()
        timer = Timer.scheduledTimer(withTimeInterval: 0.01, repeats: true) { _ in
            elapsed = base + Date().timeIntervalSince(startDate!)
        }
    }

    private func stop() { isRunning = false; timer?.invalidate() }
    private func reset() { stop(); elapsed = 0; laps = [] }
}
