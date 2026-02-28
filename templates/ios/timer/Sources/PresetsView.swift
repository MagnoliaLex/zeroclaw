// PresetsView.swift — {{APP_NAME}}
import SwiftUI

struct TimerPreset: Identifiable, Codable {
    let id: UUID
    var name: String
    var duration: Int // seconds

    init(name: String, duration: Int) {
        self.id = UUID(); self.name = name; self.duration = duration
    }
}

struct PresetsView: View {
    @State private var presets: [TimerPreset] = [
        TimerPreset(name: "Pomodoro", duration: 25 * 60),
        TimerPreset(name: "Short Break", duration: 5 * 60),
        TimerPreset(name: "Long Break", duration: 15 * 60),
        TimerPreset(name: "Meditation", duration: 10 * 60),
        TimerPreset(name: "Exercise", duration: 30 * 60),
    ]
    @State private var showingAddSheet = false

    var body: some View {
        List {
            ForEach(presets) { preset in
                HStack {
                    VStack(alignment: .leading) {
                        Text(preset.name).font(.headline)
                        Text(formatDuration(preset.duration)).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "play.circle.fill")
                        .font(.title2).foregroundStyle(Color(hex: "{{PRIMARY_COLOR}}"))
                }
            }
            .onDelete { presets.remove(atOffsets: $0) }
        }
        .navigationTitle("Presets")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingAddSheet = true } label: { Image(systemName: "plus") }
            }
        }
        .onAppear { AnalyticsService.shared.trackScreen("Presets") }
    }

    private func formatDuration(_ seconds: Int) -> String {
        let m = seconds / 60; let s = seconds % 60
        return s == 0 ? "\(m) min" : "\(m)m \(s)s"
    }
}
