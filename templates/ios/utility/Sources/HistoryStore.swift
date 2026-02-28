// HistoryStore.swift — {{APP_NAME}}
// In-memory + UserDefaults-backed store for tool history entries.

import Foundation

// MARK: - History Entry

struct HistoryEntry: Identifiable, Codable, Equatable {
    let id: UUID
    let input: String
    let result: String
    let mode: String
    let date: Date

    init(id: UUID = UUID(), input: String, result: String, mode: String, date: Date = .now) {
        self.id = id
        self.input = input
        self.result = result
        self.mode = mode
        self.date = date
    }
}

// MARK: - History Store

@MainActor
final class HistoryStore: ObservableObject {
    @Published private(set) var entries: [HistoryEntry] = []

    private let storageKey = "{{BUNDLE_ID}}.history"
    private let maxEntries = 200

    init() {
        load()
    }

    func add(input: String, result: String, mode: String) {
        let entry = HistoryEntry(input: input, result: result, mode: mode)
        entries.insert(entry, at: 0)
        if entries.count > maxEntries {
            entries = Array(entries.prefix(maxEntries))
        }
        save()
    }

    func remove(at offsets: IndexSet) {
        entries.remove(atOffsets: offsets)
        save()
    }

    func clearAll() {
        entries.removeAll()
        save()
        AnalyticsService.shared.trackEvent(AnalyticsEvent.historyCleared)
    }

    func entries(for mode: String) -> [HistoryEntry] {
        mode == "All" ? entries : entries.filter { $0.mode == mode }
    }

    // MARK: - Persistence

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([HistoryEntry].self, from: data)
        else { return }
        entries = decoded
    }
}
