// HistoryView.swift — {{APP_NAME}}
// Displays past tool results with filter and delete support.

import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var historyStore: HistoryStore
    @State private var selectedMode = "All"
    @State private var searchText = ""
    @State private var showingClearConfirm = false

    private let modes = ["All"] + ToolMode.allCases.map(\.rawValue)

    private var filteredEntries: [HistoryEntry] {
        let base = historyStore.entries(for: selectedMode)
        if searchText.isEmpty { return base }
        return base.filter {
            $0.input.localizedCaseInsensitiveContains(searchText) ||
            $0.result.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if filteredEntries.isEmpty {
                    ContentUnavailableView(
                        "No History",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Past results will appear here after you use the tool.")
                    )
                } else {
                    List {
                        ForEach(filteredEntries) { entry in
                            HistoryRowView(entry: entry)
                        }
                        .onDelete { offsets in
                            let targetIDs = Set(offsets.map { filteredEntries[$0].id })
                            let globalOffsets = IndexSet(
                                historyStore.entries.indices.filter { targetIDs.contains(historyStore.entries[$0].id) }
                            )
                            historyStore.remove(at: globalOffsets)
                        }
                    }
                }
            }
            .navigationTitle("History")
            .searchable(text: $searchText, prompt: "Search history")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("Mode", selection: $selectedMode) {
                        ForEach(modes, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if !historyStore.entries.isEmpty {
                        Button(role: .destructive) {
                            showingClearConfirm = true
                        } label: {
                            Label("Clear All", systemImage: "trash")
                        }
                    }
                }
            }
            .confirmationDialog(
                "Clear All History?",
                isPresented: $showingClearConfirm,
                titleVisibility: .visible
            ) {
                Button("Clear All", role: .destructive) {
                    historyStore.clearAll()
                }
                Button("Cancel", role: .cancel) {}
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("HistoryView")
            }
        }
    }
}

// MARK: - History Row

private struct HistoryRowView: View {
    let entry: HistoryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(entry.mode, systemImage: modeIcon(entry.mode))
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.date, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            HStack {
                Text(entry.input)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Image(systemName: "arrow.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)

                Text(entry.result)
                    .font(.subheadline.bold())
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            UIPasteboard.general.string = entry.result
            AnalyticsService.shared.trackEvent(AnalyticsEvent.historyItemTapped)
        }
    }

    private func modeIcon(_ mode: String) -> String {
        switch mode {
        case "Converter": return "arrow.left.arrow.right"
        case "Formatter": return "textformat"
        case "Calculator": return "plusminus"
        default: return "wrench"
        }
    }
}

#Preview {
    HistoryView()
        .environmentObject(HistoryStore())
}
