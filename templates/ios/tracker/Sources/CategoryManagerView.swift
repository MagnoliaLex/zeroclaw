// CategoryManagerView.swift — {{APP_NAME}}
// Create, edit, and delete tracking categories.

import SwiftData
import SwiftUI

struct CategoryManagerView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]
    @State private var showingAddSheet = false
    @State private var categoryToEdit: TrackerCategory?

    var body: some View {
        NavigationStack {
            List {
                ForEach(categories) { category in
                    HStack(spacing: 14) {
                        Circle()
                            .fill(Color(hex: category.colorHex) ?? .accentColor)
                            .frame(width: 36, height: 36)
                            .overlay {
                                Image(systemName: category.icon)
                                    .foregroundStyle(.white)
                                    .font(.subheadline)
                            }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(category.name)
                                .font(.subheadline.bold())
                            Text("Goal: \(category.goal, specifier: "%.0f") \(category.unit)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Text("\(category.entriesCount) entries")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { categoryToEdit = category }
                }
                .onDelete(perform: deleteCategories)
            }
            .navigationTitle("Categories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    EditButton()
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                CategoryFormView(mode: .add)
            }
            .sheet(item: $categoryToEdit) { cat in
                CategoryFormView(mode: .edit(cat))
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("CategoryManagerView")
            }
        }
    }

    private func deleteCategories(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(categories[index])
        }
    }
}

// MARK: - Category Form

enum CategoryFormMode {
    case add
    case edit(TrackerCategory)
}

struct CategoryFormView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let mode: CategoryFormMode

    @State private var name = ""
    @State private var icon = "circle.fill"
    @State private var colorHex = "#007AFF"
    @State private var unit = "times"
    @State private var goal: Double = 1

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private let iconOptions = [
        "circle.fill", "drop.fill", "figure.walk", "moon.zzz.fill", "brain.head.profile",
        "flame.fill", "bolt.fill", "heart.fill", "star.fill", "leaf.fill",
        "dumbbell.fill", "fork.knife", "cup.and.saucer.fill", "pills.fill", "book.fill"
    ]

    private let colorOptions = [
        "#007AFF", "#34C759", "#FF3B30", "#FF9500", "#FFCC00",
        "#5856D6", "#AF52DE", "#FF2D55", "#00C7BE", "#30B0C7"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Category name", text: $name)
                }

                Section("Unit") {
                    TextField("e.g. glasses, minutes, km", text: $unit)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Daily Goal")
                            Spacer()
                            Text("\(goal, specifier: "%.0f") \(unit)")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Slider(value: $goal, in: 1 ... 100, step: 1)
                    }
                    .padding(.vertical, 4)
                }

                Section("Icon") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
                        ForEach(iconOptions, id: \.self) { iconName in
                            Button {
                                icon = iconName
                            } label: {
                                Image(systemName: iconName)
                                    .font(.title3)
                                    .frame(width: 44, height: 44)
                                    .background(icon == iconName ? (Color(hex: colorHex) ?? .accentColor) : Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                                    .foregroundStyle(icon == iconName ? .white : .primary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
                        ForEach(colorOptions, id: \.self) { hex in
                            Button {
                                colorHex = hex
                            } label: {
                                Circle()
                                    .fill(Color(hex: hex) ?? .accentColor)
                                    .frame(width: 36, height: 36)
                                    .overlay {
                                        if colorHex == hex {
                                            Image(systemName: "checkmark")
                                                .foregroundStyle(.white)
                                                .font(.caption.bold())
                                        }
                                    }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle(isEditing ? "Edit Category" : "New Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isEditing ? "Save" : "Add") {
                        saveCategory()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if case .edit(let cat) = mode {
                    name = cat.name
                    icon = cat.icon
                    colorHex = cat.colorHex
                    unit = cat.unit
                    goal = cat.goal
                }
            }
        }
    }

    private func saveCategory() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }

        switch mode {
        case .add:
            let cat = TrackerCategory(name: trimmedName, icon: icon, colorHex: colorHex, unit: unit, goal: goal)
            modelContext.insert(cat)
            AnalyticsService.shared.trackEvent("category_created", properties: ["name": trimmedName])
        case .edit(let cat):
            cat.name = trimmedName
            cat.icon = icon
            cat.colorHex = colorHex
            cat.unit = unit
            cat.goal = goal
            AnalyticsService.shared.trackEvent("category_edited", properties: ["name": trimmedName])
        }
        dismiss()
    }
}

#Preview {
    CategoryManagerView()
        .modelContainer(for: [TrackerCategory.self, TrackerEntry.self], inMemory: true)
}
