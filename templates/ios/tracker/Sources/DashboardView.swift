// DashboardView.swift — {{APP_NAME}}
// Today's overview with quick-log buttons and progress rings.

import SwiftData
import SwiftUI

struct DashboardView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]
    @State private var showingEntryForm = false
    @State private var selectedCategory: TrackerCategory?
    @State private var showingAIInsight = false
    @State private var aiInsight: String?
    @State private var isLoadingAI = false

    private let gemini = GeminiService.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Date header
                    HStack {
                        VStack(alignment: .leading) {
                            Text(Date.now, style: .date)
                                .font(.headline)
                                .foregroundStyle(.secondary)
                            Text("Today's Progress")
                                .font(.largeTitle.bold())
                        }
                        Spacer()
                        Button {
                            showingAIInsight = true
                            fetchAIInsight()
                        } label: {
                            Label("AI Insight", systemImage: "sparkles")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .tint(.purple)
                    }
                    .padding(.horizontal)

                    if categories.isEmpty {
                        emptyState
                    } else {
                        // Category cards
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            ForEach(categories) { category in
                                CategoryCard(category: category) {
                                    selectedCategory = category
                                    showingEntryForm = true
                                }
                            }
                        }
                        .padding(.horizontal)
                    }

                    if showingAIInsight {
                        AIInsightCard(
                            isLoading: isLoadingAI,
                            insight: aiInsight,
                            onDismiss: { showingAIInsight = false }
                        )
                        .padding(.horizontal)
                    }

                    Spacer(minLength: 40)
                }
                .padding(.top)
            }
            .navigationTitle("{{APP_NAME}}")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        selectedCategory = nil
                        showingEntryForm = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink(destination: CategoryManagerView()) {
                        Image(systemName: "square.grid.2x2")
                    }
                }
            }
            .sheet(isPresented: $showingEntryForm) {
                EntryFormView(preselectedCategory: selectedCategory)
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("DashboardView")
                seedDefaultCategoriesIfNeeded()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No Categories Yet")
                .font(.title3.bold())
            Text("Add your first tracking category to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Add Default Categories") {
                seedDefaultCategoriesIfNeeded(force: true)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(40)
    }

    private func seedDefaultCategoriesIfNeeded(force: Bool = false) {
        guard force || categories.isEmpty else { return }
        for cat in TrackerCategory.defaultCategories() {
            modelContext.insert(cat)
        }
    }

    private func fetchAIInsight() {
        guard !categories.isEmpty else { return }
        isLoadingAI = true
        aiInsight = nil
        let summary = categories.map { cat in
            "\(cat.name): \(cat.todayTotal(), specifier: "%.0f")/\(cat.goal, specifier: "%.0f") \(cat.unit)"
        }.joined(separator: ", ")

        Task {
            do {
                let prompt = "I'm tracking my daily habits. Today's progress: \(summary). Give me a brief (2-3 sentences) motivational insight or practical tip based on this data."
                aiInsight = try await gemini.generate(prompt: prompt)
            } catch {
                aiInsight = "Could not load insight. Check your Gemini API key."
            }
            isLoadingAI = false
        }
    }
}

// MARK: - Category Card

struct CategoryCard: View {
    let category: TrackerCategory
    let onLog: () -> Void

    private var progress: Double {
        min(category.todayTotal() / max(category.goal, 1), 1.0)
    }

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.2), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(Color(hex: category.colorHex) ?? .accentColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut, value: progress)

                Image(systemName: category.icon)
                    .font(.title2)
                    .foregroundStyle(Color(hex: category.colorHex) ?? .accentColor)
            }
            .frame(width: 70, height: 70)

            Text(category.name)
                .font(.subheadline.bold())
                .lineLimit(1)

            Text("\(category.todayTotal(), specifier: "%.0f") / \(category.goal, specifier: "%.0f") \(category.unit)")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button(action: onLog) {
                Text("Log")
                    .font(.caption.bold())
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(hex: category.colorHex) ?? .accentColor)
            .controlSize(.small)
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - AI Insight Card

private struct AIInsightCard: View {
    let isLoading: Bool
    let insight: String?
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("AI Insight", systemImage: "sparkles")
                    .font(.caption.bold())
                    .foregroundStyle(.purple)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            if isLoading {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Analyzing your data…").font(.footnote).foregroundStyle(.secondary)
                }
            } else {
                Text(insight ?? "No insight available.")
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Color from Hex

extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        guard Scanner(string: hex).scanHexInt64(&int) else { return nil }
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

#Preview {
    DashboardView()
        .modelContainer(for: [TrackerCategory.self, TrackerEntry.self], inMemory: true)
}
