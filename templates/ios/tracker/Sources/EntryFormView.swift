// EntryFormView.swift — {{APP_NAME}}
// Form for logging a new tracker entry.

import SwiftData
import SwiftUI

struct EntryFormView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]

    var preselectedCategory: TrackerCategory?

    @State private var selectedCategory: TrackerCategory?
    @State private var value: Double = 1
    @State private var note = ""
    @State private var date = Date.now
    @State private var showingCategoryPicker = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Category") {
                    if let cat = selectedCategory {
                        HStack {
                            Image(systemName: cat.icon)
                                .foregroundStyle(Color(hex: cat.colorHex) ?? .accentColor)
                            Text(cat.name)
                            Spacer()
                            Text("\(cat.unit)")
                                .foregroundStyle(.secondary)
                                .font(.caption)
                        }
                        Button("Change Category") {
                            showingCategoryPicker = true
                        }
                        .foregroundStyle(.accentColor)
                    } else {
                        Button("Select Category") {
                            showingCategoryPicker = true
                        }
                    }
                }

                Section("Value") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("\(value, specifier: "%.1f")")
                                .font(.title.bold())
                                .monospacedDigit()
                            Text(selectedCategory?.unit ?? "units")
                                .font(.title3)
                                .foregroundStyle(.secondary)
                        }

                        Slider(value: $value, in: 0 ... (selectedCategory?.goal ?? 10) * 2, step: 0.5)
                            .tint(Color(hex: selectedCategory?.colorHex ?? "#007AFF") ?? .accentColor)

                        HStack {
                            Button("-1") { value = max(0, value - 1) }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            Spacer()
                            Button("+0.5") { value += 0.5 }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            Button("+1") { value += 1 }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.small)
                        }
                    }
                }

                Section("Details") {
                    DatePicker("Date & Time", selection: $date, displayedComponents: [.date, .hourAndMinute])
                    TextField("Note (optional)", text: $note, axis: .vertical)
                        .lineLimit(3)
                }
            }
            .navigationTitle("Log Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { saveEntry() }
                        .fontWeight(.semibold)
                        .disabled(selectedCategory == nil)
                }
            }
            .sheet(isPresented: $showingCategoryPicker) {
                CategoryPickerView(selectedCategory: $selectedCategory)
            }
            .onAppear {
                selectedCategory = preselectedCategory ?? categories.first
                AnalyticsService.shared.trackScreen("EntryFormView")
            }
        }
    }

    private func saveEntry() {
        guard let category = selectedCategory else { return }
        let entry = TrackerEntry(value: value, note: note, date: date, category: category)
        modelContext.insert(entry)
        AnalyticsService.shared.trackEvent("entry_logged", properties: [
            "category": category.name,
            "value": String(value)
        ])
        dismiss()
    }
}

// MARK: - Category Picker

struct CategoryPickerView: View {
    @Binding var selectedCategory: TrackerCategory?
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(categories) { category in
                Button {
                    selectedCategory = category
                    dismiss()
                } label: {
                    HStack {
                        Image(systemName: category.icon)
                            .foregroundStyle(Color(hex: category.colorHex) ?? .accentColor)
                            .frame(width: 28)
                        Text(category.name)
                        Spacer()
                        if selectedCategory?.id == category.id {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.accentColor)
                        }
                    }
                }
                .foregroundStyle(.primary)
            }
            .navigationTitle("Select Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    EntryFormView()
        .modelContainer(for: [TrackerCategory.self, TrackerEntry.self], inMemory: true)
}
