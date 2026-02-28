// ChartView.swift — {{APP_NAME}}
// Weekly and monthly trend charts for tracked categories.

import Charts
import SwiftData
import SwiftUI

struct ChartView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TrackerCategory.createdAt) private var categories: [TrackerCategory]
    @State private var selectedCategory: TrackerCategory?
    @State private var chartRange: ChartRange = .week

    enum ChartRange: String, CaseIterable {
        case week = "7 Days"
        case month = "30 Days"
        case quarter = "90 Days"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if categories.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            categoryPicker
                            rangePicker
                            if let category = selectedCategory ?? categories.first {
                                barChart(for: category)
                                statsRow(for: category)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Trends")
            .onAppear {
                if selectedCategory == nil {
                    selectedCategory = categories.first
                }
                AnalyticsService.shared.trackScreen("ChartView")
            }
        }
    }

    // MARK: - Category Picker

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(categories) { category in
                    Button {
                        selectedCategory = category
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: category.icon)
                            Text(category.name)
                                .font(.subheadline.bold())
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            selectedCategory?.id == category.id
                                ? (Color(hex: category.colorHex) ?? .accentColor)
                                : Color.secondary.opacity(0.12),
                            in: Capsule()
                        )
                        .foregroundStyle(
                            selectedCategory?.id == category.id ? .white : .primary
                        )
                    }
                }
            }
        }
    }

    // MARK: - Range Picker

    private var rangePicker: some View {
        Picker("Range", selection: $chartRange) {
            ForEach(ChartRange.allCases, id: \.self) { range in
                Text(range.rawValue).tag(range)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Bar Chart

    private func barChart(for category: TrackerCategory) -> some View {
        let data = chartData(for: category)
        let accentColor = Color(hex: category.colorHex) ?? .accentColor

        return VStack(alignment: .leading, spacing: 10) {
            Text(category.name)
                .font(.headline)
            Text("Daily \(category.unit) over \(chartRange.rawValue)")
                .font(.caption)
                .foregroundStyle(.secondary)

            if data.isEmpty {
                Text("No data for this period.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 140, alignment: .center)
            } else {
                Chart(data, id: \.date) { point in
                    BarMark(
                        x: .value("Date", point.date, unit: .day),
                        y: .value(category.unit, point.value)
                    )
                    .foregroundStyle(accentColor.gradient)
                    .cornerRadius(4)

                    RuleMark(y: .value("Goal", category.goal))
                        .foregroundStyle(.red.opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4]))
                        .annotation(position: .trailing) {
                            Text("Goal")
                                .font(.caption2)
                                .foregroundStyle(.red.opacity(0.7))
                        }
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day, count: axisStride)) { value in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 220)
                .animation(.easeInOut, value: chartRange)
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Stats Row

    private func statsRow(for category: TrackerCategory) -> some View {
        let data = chartData(for: category)
        let values = data.map(\.value)
        let total = values.reduce(0, +)
        let average = values.isEmpty ? 0 : total / Double(values.count)
        let best = values.max() ?? 0
        let goalHitDays = data.filter { $0.value >= category.goal }.count

        return HStack(spacing: 0) {
            statCell(label: "Total", value: String(format: "%.0f", total), unit: category.unit)
            Divider().frame(height: 40)
            statCell(label: "Avg/Day", value: String(format: "%.1f", average), unit: category.unit)
            Divider().frame(height: 40)
            statCell(label: "Best Day", value: String(format: "%.0f", best), unit: category.unit)
            Divider().frame(height: 40)
            statCell(label: "Goal Days", value: "\(goalHitDays)", unit: "days")
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func statCell(label: String, value: String, unit: String) -> some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.bold())
                .monospacedDigit()
            Text(unit)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No Data Yet")
                .font(.title3.bold())
            Text("Start logging entries to see your trends here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxHeight: .infinity)
    }

    // MARK: - Helpers

    private struct ChartPoint {
        let date: Date
        let value: Double
    }

    private var daysBack: Int {
        switch chartRange {
        case .week: return 7
        case .month: return 30
        case .quarter: return 90
        }
    }

    private var axisStride: Int {
        switch chartRange {
        case .week: return 1
        case .month: return 7
        case .quarter: return 14
        }
    }

    private func chartData(for category: TrackerCategory) -> [ChartPoint] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        return (0 ..< daysBack).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: today) else { return nil }
            let end = calendar.date(byAdding: .day, value: 1, to: day)!
            let total = category.entries
                .filter { $0.date >= day && $0.date < end }
                .reduce(0) { $0 + $1.value }
            return ChartPoint(date: day, value: total)
        }
        .reversed()
    }
}

#Preview {
    ChartView()
        .modelContainer(for: [TrackerCategory.self, TrackerEntry.self], inMemory: true)
}
