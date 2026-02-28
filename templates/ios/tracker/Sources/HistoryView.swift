// HistoryView.swift — {{APP_NAME}}
// Chronological log of all tracker entries with delete and filter support.

import SwiftData
import SwiftUI

struct HistoryView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TrackerEntry.date, order: .reverse) private var entries: [TrackerEntry]
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]

    @State private var filterCategory: TrackerCategory?
    @State private var searchText = ""
    @State private var entryToEdit: TrackerEntry?

    private var filteredEntries: [TrackerEntry] {
        entries.filter { entry in
            let matchesCategory = filterCategory == nil || entry.category?.id == filterCategory?.id
            let matchesSearch = searchText.isEmpty
                || (entry.category?.name.localizedCaseInsensitiveContains(searchText) == true)
                || entry.note.localizedCaseInsensitiveContains(searchText)
            return matchesCategory && matchesSearch
        }
    }

    private var groupedEntries: [(String, [TrackerEntry])] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none

        var groups: [(String, [TrackerEntry])] = []
        var seen: [String: Int] = [:]

        for entry in filteredEntries {
            let key: String
            if calendar.isDateInToday(entry.date) {
                key = "Today"
            } else if calendar.isDateInYesterday(entry.date) {
                key = "Yesterday"
            } else {
                key = formatter.string(from: entry.date)
            }

            if let idx = seen[key] {
                groups[idx].1.append(entry)
            } else {
                seen[key] = groups.count
                groups.append((key, [entry]))
            }
        }
        return groups
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                categoryFilterBar

                if filteredEntries.isEmpty {
                    emptyState
                } else {
                    List {
                        ForEach(groupedEntries, id: \.0) { label, dayEntries in
                            Section(label) {
                                ForEach(dayEntries) { entry in
                                    EntryRow(entry: entry)
                                        .contentShape(Rectangle())
                                        .onTapGesture { entryToEdit = entry }
                                }
                                .onDelete { indexSet in
                                    deleteEntries(at: indexSet, from: dayEntries)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("History")
            .searchable(text: $searchText, prompt: "Search entries…")
            .sheet(item: $entryToEdit) { entry in
                EditEntryView(entry: entry)
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("HistoryView")
            }
        }
    }

    // MARK: - Category Filter Bar

    private var categoryFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(label: "All", icon: "square.grid.2x2", color: .accentColor, isSelected: filterCategory == nil) {
                    filterCategory = nil
                }
                ForEach(categories) { cat in
                    filterChip(label: cat.name, icon: cat.icon, color: Color(hex: cat.colorHex) ?? .accentColor, isSelected: filterCategory?.id == cat.id) {
                        filterCategory = filterCategory?.id == cat.id ? nil : cat
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func filterChip(label: String, icon: String, color: Color, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.caption)
                Text(label).font(.caption.bold())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? color : Color.secondary.opacity(0.12), in: Capsule())
            .foregroundStyle(isSelected ? .white : .primary)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No Entries Found")
                .font(.title3.bold())
            Text(searchText.isEmpty ? "Log your first entry on the Dashboard." : "Try a different search term.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxHeight: .infinity)
    }

    // MARK: - Delete

    private func deleteEntries(at offsets: IndexSet, from dayEntries: [TrackerEntry]) {
        for index in offsets {
            modelContext.delete(dayEntries[index])
        }
        AnalyticsService.shared.trackEvent("entries_deleted", properties: ["count": String(offsets.count)])
    }
}

// MARK: - Entry Row

private struct EntryRow: View {
    let entry: TrackerEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.category?.icon ?? "circle.fill")
                .foregroundStyle(Color(hex: entry.category?.colorHex ?? "#007AFF") ?? .accentColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(entry.category?.name ?? "Unknown")
                        .font(.subheadline.bold())
                    Spacer()
                    Text("\(entry.value, specifier: "%.1f") \(entry.category?.unit ?? "")")
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text(entry.date, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !entry.note.isEmpty {
                        Text("•")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(entry.note)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Edit Entry View

struct EditEntryView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let entry: TrackerEntry
    @State private var value: Double
    @State private var note: String
    @State private var date: Date

    init(entry: TrackerEntry) {
        self.entry = entry
        _value = State(initialValue: entry.value)
        _note = State(initialValue: entry.note)
        _date = State(initialValue: entry.date)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Value") {
                    HStack {
                        Text("\(value, specifier: "%.1f")")
                            .font(.title.bold())
                            .monospacedDigit()
                        Text(entry.category?.unit ?? "units")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: $value, in: 0 ... (entry.category?.goal ?? 10) * 2, step: 0.5)
                }
                Section("Details") {
                    DatePicker("Date & Time", selection: $date, displayedComponents: [.date, .hourAndMinute])
                    TextField("Note (optional)", text: $note, axis: .vertical)
                        .lineLimit(3)
                }
            }
            .navigationTitle("Edit Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        entry.value = value
                        entry.note = note
                        entry.date = date
                        AnalyticsService.shared.trackEvent("entry_edited")
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

#Preview {
    HistoryView()
        .modelContainer(for: [TrackerCategory.self, TrackerEntry.self], inMemory: true)
}
