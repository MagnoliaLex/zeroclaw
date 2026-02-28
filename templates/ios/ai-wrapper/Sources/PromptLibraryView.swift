// PromptLibraryView.swift — {{APP_NAME}}
// Curated prompt library organized by category.

import SwiftUI

// MARK: - Models

struct PromptTemplate: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let prompt: String
    let category: PromptCategory
    let icon: String
}

enum PromptCategory: String, CaseIterable {
    case writing = "Writing"
    case coding = "Coding"
    case analysis = "Analysis"
    case creative = "Creative"
    case productivity = "Productivity"

    var systemImage: String {
        switch self {
        case .writing: return "pencil"
        case .coding: return "chevron.left.forwardslash.chevron.right"
        case .analysis: return "chart.bar.xaxis"
        case .creative: return "paintbrush"
        case .productivity: return "checklist"
        }
    }

    var color: Color {
        switch self {
        case .writing: return .blue
        case .coding: return .green
        case .analysis: return .orange
        case .creative: return .purple
        case .productivity: return .teal
        }
    }
}

private let builtInPrompts: [PromptTemplate] = [
    // Writing
    PromptTemplate(title: "Improve My Writing", prompt: "Please review and improve the following text for clarity, grammar, and style:\n\n", category: .writing, icon: "pencil.and.sparkles"),
    PromptTemplate(title: "Summarize Text", prompt: "Please provide a concise summary of the following text in 3-5 bullet points:\n\n", category: .writing, icon: "list.bullet"),
    PromptTemplate(title: "Write Email", prompt: "Write a professional email about the following topic:\n\n", category: .writing, icon: "envelope"),
    PromptTemplate(title: "Blog Post Outline", prompt: "Create a detailed blog post outline for the following topic:\n\n", category: .writing, icon: "doc.text"),

    // Coding
    PromptTemplate(title: "Explain Code", prompt: "Please explain what the following code does, step by step:\n\n```\n\n```", category: .coding, icon: "magnifyingglass"),
    PromptTemplate(title: "Debug Code", prompt: "I have a bug in my code. Please help me find and fix it:\n\n```\n\n```\n\nError message:\n", category: .coding, icon: "ladybug"),
    PromptTemplate(title: "Write Unit Tests", prompt: "Write comprehensive unit tests for the following function:\n\n```\n\n```", category: .coding, icon: "checkmark.seal"),
    PromptTemplate(title: "Code Review", prompt: "Please review the following code for best practices, potential bugs, and improvements:\n\n```\n\n```", category: .coding, icon: "eye"),

    // Analysis
    PromptTemplate(title: "Pros and Cons", prompt: "Give me a comprehensive pros and cons analysis of:\n\n", category: .analysis, icon: "scale.3d"),
    PromptTemplate(title: "SWOT Analysis", prompt: "Perform a SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) for:\n\n", category: .analysis, icon: "square.grid.2x2"),
    PromptTemplate(title: "Explain Concept", prompt: "Explain the following concept in simple terms as if teaching a beginner:\n\n", category: .analysis, icon: "lightbulb"),

    // Creative
    PromptTemplate(title: "Story Starter", prompt: "Write a compelling story opening (first 3 paragraphs) set in the following scenario:\n\n", category: .creative, icon: "book"),
    PromptTemplate(title: "Brainstorm Ideas", prompt: "Brainstorm 10 creative ideas for:\n\n", category: .creative, icon: "cloud.bolt"),
    PromptTemplate(title: "Name Generator", prompt: "Generate 10 creative, memorable names for a:\n\n", category: .creative, icon: "tag"),

    // Productivity
    PromptTemplate(title: "Action Plan", prompt: "Create a step-by-step action plan to achieve the following goal:\n\n", category: .productivity, icon: "list.number"),
    PromptTemplate(title: "Meeting Agenda", prompt: "Create a structured meeting agenda for:\n\nDuration:\nAttendees:\nObjective:", category: .productivity, icon: "calendar"),
    PromptTemplate(title: "Decision Framework", prompt: "Help me make a decision about the following by providing a clear framework:\n\n", category: .productivity, icon: "arrow.triangle.branch")
]

// MARK: - View

struct PromptLibraryView: View {
    let onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedCategory: PromptCategory? = nil
    @State private var searchText = ""

    private var filteredPrompts: [PromptTemplate] {
        var prompts = builtInPrompts
        if let category = selectedCategory {
            prompts = prompts.filter { $0.category == category }
        }
        if !searchText.isEmpty {
            prompts = prompts.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.prompt.localizedCaseInsensitiveContains(searchText)
            }
        }
        return prompts
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Category filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        CategoryChip(
                            title: "All",
                            isSelected: selectedCategory == nil,
                            color: .primary
                        ) { selectedCategory = nil }

                        ForEach(PromptCategory.allCases, id: \.self) { cat in
                            CategoryChip(
                                title: cat.rawValue,
                                isSelected: selectedCategory == cat,
                                color: cat.color
                            ) { selectedCategory = cat }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                Divider()

                // Prompt list
                List(filteredPrompts) { prompt in
                    PromptRow(prompt: prompt) {
                        AnalyticsService.shared.trackEvent("prompt_selected", properties: [
                            "category": prompt.category.rawValue,
                            "title": prompt.title
                        ])
                        onSelect(prompt.prompt)
                    }
                }
                .listStyle(.plain)
            }
            .searchable(text: $searchText, prompt: "Search prompts")
            .navigationTitle("Prompt Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("PromptLibraryView")
            }
        }
    }
}

// MARK: - Category Chip

private struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let color: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.subheadline.bold())
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? color : Color.secondary.opacity(0.12), in: Capsule())
                .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Prompt Row

private struct PromptRow: View {
    let prompt: PromptTemplate
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: prompt.icon)
                    .font(.body)
                    .foregroundStyle(prompt.category.color)
                    .frame(width: 32, height: 32)
                    .background(prompt.category.color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 3) {
                    Text(prompt.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    Text(prompt.category.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    PromptLibraryView(onSelect: { _ in })
}
