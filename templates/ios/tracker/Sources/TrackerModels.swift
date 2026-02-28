// TrackerModels.swift — {{APP_NAME}}
// SwiftData models for tracker entries and categories.

import Foundation
import SwiftData

// MARK: - Tracker Category

@Model
final class TrackerCategory {
    @Attribute(.unique) var id: UUID
    var name: String
    var icon: String
    var colorHex: String
    var unit: String
    var goal: Double
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \TrackerEntry.category)
    var entries: [TrackerEntry] = []

    init(
        id: UUID = UUID(),
        name: String,
        icon: String = "circle.fill",
        colorHex: String = "#007AFF",
        unit: String = "times",
        goal: Double = 1,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.icon = icon
        self.colorHex = colorHex
        self.unit = unit
        self.goal = goal
        self.createdAt = createdAt
    }

    var entriesCount: Int { entries.count }

    func todayTotal() -> Double {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: .now)
        let end = calendar.date(byAdding: .day, value: 1, to: start)!
        return entries
            .filter { $0.date >= start && $0.date < end }
            .reduce(0) { $0 + $1.value }
    }

    func weeklyTotal() -> Double {
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .weekOfYear, value: -1, to: .now)!
        return entries
            .filter { $0.date >= start }
            .reduce(0) { $0 + $1.value }
    }
}

// MARK: - Tracker Entry

@Model
final class TrackerEntry {
    @Attribute(.unique) var id: UUID
    var value: Double
    var note: String
    var date: Date
    var category: TrackerCategory?

    init(
        id: UUID = UUID(),
        value: Double,
        note: String = "",
        date: Date = .now,
        category: TrackerCategory? = nil
    ) {
        self.id = id
        self.value = value
        self.note = note
        self.date = date
        self.category = category
    }
}

// MARK: - Default Categories

extension TrackerCategory {
    static func defaultCategories() -> [TrackerCategory] {
        [
            TrackerCategory(name: "Water", icon: "drop.fill", colorHex: "#007AFF", unit: "glasses", goal: 8),
            TrackerCategory(name: "Exercise", icon: "figure.walk", colorHex: "#34C759", unit: "minutes", goal: 30),
            TrackerCategory(name: "Sleep", icon: "moon.zzz.fill", colorHex: "#5856D6", unit: "hours", goal: 8),
            TrackerCategory(name: "Meditation", icon: "brain.head.profile", colorHex: "#FF9500", unit: "minutes", goal: 10)
        ]
    }
}
