// ToolView.swift — {{APP_NAME}}
// Main utility tool screen. Customize the tool logic for your specific use case
// (calculator, unit converter, text formatter, etc.).

import SwiftUI

// MARK: - Tool Mode

enum ToolMode: String, CaseIterable, Identifiable {
    case converter = "Converter"
    case formatter = "Formatter"
    case calculator = "Calculator"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .converter: return "arrow.left.arrow.right"
        case .formatter: return "textformat"
        case .calculator: return "plusminus"
        }
    }
}

// MARK: - Tool View Model

@MainActor
final class ToolViewModel: ObservableObject {
    @Published var inputText = ""
    @Published var result = ""
    @Published var selectedMode: ToolMode = .converter
    @Published var isProcessing = false
    @Published var errorMessage: String?
    @Published var aiSuggestion: String?
    @Published var isLoadingAI = false

    @AppStorage("enableAISuggestions") private var enableAISuggestions = true

    private let gemini = GeminiService.shared

    func process() {
        guard !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Please enter a value."
            return
        }
        errorMessage = nil
        aiSuggestion = nil

        switch selectedMode {
        case .converter:
            result = convertValue(inputText)
        case .formatter:
            result = formatText(inputText)
        case .calculator:
            result = evaluate(inputText)
        }

        if !result.isEmpty {
            AnalyticsService.shared.trackEvent(AnalyticsEvent.toolUsed, properties: [
                "mode": selectedMode.rawValue
            ])
        }
    }

    func fetchAISuggestion() {
        guard enableAISuggestions, !inputText.isEmpty, !result.isEmpty else { return }
        isLoadingAI = true
        Task {
            do {
                aiSuggestion = try await gemini.suggestForResult(input: inputText, result: result)
                AnalyticsService.shared.trackEvent(AnalyticsEvent.aiSuggestionReceived)
            } catch {
                AnalyticsService.shared.trackEvent(AnalyticsEvent.aiSuggestionError, properties: [
                    "error": error.localizedDescription
                ])
            }
            isLoadingAI = false
        }
    }

    func clearAll() {
        inputText = ""
        result = ""
        errorMessage = nil
        aiSuggestion = nil
    }

    // MARK: - Stub tool logic (replace with your actual implementation)

    private func convertValue(_ input: String) -> String {
        // Example: simple meter-to-feet conversion stub
        guard let value = Double(input) else { return "Invalid number" }
        let converted = value * 3.28084
        return String(format: "%.4f ft", converted)
    }

    private func formatText(_ input: String) -> String {
        // Example: title-case formatter stub
        return input.capitalized
    }

    private func evaluate(_ input: String) -> String {
        // Example: basic arithmetic evaluator stub using NSExpression
        let expression = NSExpression(format: input)
        if let value = expression.expressionValue(with: nil, context: nil) as? NSNumber {
            return value.stringValue
        }
        return "Invalid expression"
    }
}

// MARK: - Tool View

struct ToolView: View {
    @EnvironmentObject private var historyStore: HistoryStore
    @StateObject private var viewModel = ToolViewModel()
    @State private var showCopiedFeedback = false
    @State private var showingAISuggestion = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Mode Picker
                    Picker("Mode", selection: $viewModel.selectedMode) {
                        ForEach(ToolMode.allCases) { mode in
                            Label(mode.rawValue, systemImage: mode.systemImage).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Input")
                            .font(.caption.uppercaseSmallCaps())
                            .foregroundStyle(.secondary)
                        TextField("Enter value…", text: $viewModel.inputText)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(viewModel.selectedMode == .calculator ? .decimalPad : .default)
                    }
                    .padding(.horizontal)

                    // Process Button
                    Button(action: {
                        viewModel.process()
                        if !viewModel.result.isEmpty {
                            historyStore.add(
                                input: viewModel.inputText,
                                result: viewModel.result,
                                mode: viewModel.selectedMode.rawValue
                            )
                        }
                    }) {
                        Label("Process", systemImage: "play.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.horizontal)

                    // Error
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    // Result Card
                    if !viewModel.result.isEmpty {
                        ResultCard(
                            result: viewModel.result,
                            showCopiedFeedback: $showCopiedFeedback,
                            onCopy: {
                                UIPasteboard.general.string = viewModel.result
                                showCopiedFeedback = true
                                AnalyticsService.shared.trackEvent(AnalyticsEvent.resultCopied)
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                    showCopiedFeedback = false
                                }
                            },
                            onAI: {
                                showingAISuggestion = true
                                viewModel.fetchAISuggestion()
                            }
                        )
                        .padding(.horizontal)
                    }

                    // AI Suggestion
                    if showingAISuggestion {
                        AISuggestionView(
                            isLoading: viewModel.isLoadingAI,
                            suggestion: viewModel.aiSuggestion,
                            onDismiss: { showingAISuggestion = false }
                        )
                        .padding(.horizontal)
                    }

                    Spacer(minLength: 40)
                }
                .padding(.top)
            }
            .navigationTitle("{{APP_NAME}}")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Clear", action: viewModel.clearAll)
                        .disabled(viewModel.inputText.isEmpty && viewModel.result.isEmpty)
                }
            }
            .onAppear {
                AnalyticsService.shared.trackScreen("ToolView")
            }
        }
    }
}

// MARK: - Result Card

private struct ResultCard: View {
    let result: String
    @Binding var showCopiedFeedback: Bool
    let onCopy: () -> Void
    let onAI: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Result")
                    .font(.caption.uppercaseSmallCaps())
                    .foregroundStyle(.secondary)
                Spacer()
                HStack(spacing: 8) {
                    Button(action: onCopy) {
                        Label(
                            showCopiedFeedback ? "Copied!" : "Copy",
                            systemImage: showCopiedFeedback ? "checkmark" : "doc.on.doc"
                        )
                        .font(.caption.bold())
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(showCopiedFeedback ? .green : .accentColor)

                    Button(action: onAI) {
                        Label("AI", systemImage: "sparkles")
                            .font(.caption.bold())
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(.purple)
                }
            }

            Text(result)
                .font(.title2.bold())
                .foregroundStyle(.primary)
                .textSelection(.enabled)
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    ToolView()
        .environmentObject(HistoryStore())
}
