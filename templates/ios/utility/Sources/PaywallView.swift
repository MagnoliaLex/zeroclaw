// PaywallView.swift — {{APP_NAME}}
// StoreKit 2 paywall scaffold with premium and subscription tiers.

import StoreKit
import SwiftUI

// MARK: - Product IDs (replace with your App Store Connect product IDs)

private enum ProductID {
    static let premiumMonthly = "{{BUNDLE_ID}}.premium.monthly"
    static let premiumAnnual = "{{BUNDLE_ID}}.premium.annual"
    static let lifetimePremium = "{{BUNDLE_ID}}.premium.lifetime"
}

// MARK: - Paywall View Model

@MainActor
final class PaywallViewModel: ObservableObject {
    @Published var products: [Product] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isPurchased = false

    func loadProducts() async {
        isLoading = true
        errorMessage = nil
        do {
            products = try await Product.products(for: [
                ProductID.premiumMonthly,
                ProductID.premiumAnnual,
                ProductID.lifetimePremium
            ])
            products.sort { $0.price < $1.price }
        } catch {
            errorMessage = "Could not load products: \(error.localizedDescription)"
        }
        isLoading = false
    }

    func purchase(_ product: Product) async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified:
                    isPurchased = true
                    AnalyticsService.shared.trackEvent("paywall_purchase_success", properties: [
                        "product_id": product.id
                    ])
                case .unverified:
                    errorMessage = "Purchase verification failed. Please contact support."
                }
            case .pending:
                errorMessage = "Purchase is pending approval."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            errorMessage = "Purchase failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    func restorePurchases() async {
        isLoading = true
        do {
            try await AppStore.sync()
            await checkEntitlements()
        } catch {
            errorMessage = "Restore failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    private func checkEntitlements() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                if [ProductID.premiumMonthly, ProductID.premiumAnnual, ProductID.lifetimePremium]
                    .contains(transaction.productID) {
                    isPurchased = true
                    return
                }
            }
        }
    }
}

// MARK: - Paywall View

struct PaywallView: View {
    @StateObject private var viewModel = PaywallViewModel()
    @Environment(\.dismiss) private var dismiss

    private let features: [(String, String)] = [
        ("Unlimited History", "clock.arrow.circlepath"),
        ("AI-Powered Suggestions", "sparkles"),
        ("Export Results", "square.and.arrow.up"),
        ("Priority Support", "envelope.badge")
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "star.circle.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.yellow)
                            .symbolRenderingMode(.hierarchical)

                        Text("{{APP_NAME}} Premium")
                            .font(.largeTitle.bold())

                        Text("Unlock the full experience")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 24)

                    // Feature list
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(features, id: \.0) { feature, icon in
                            HStack(spacing: 14) {
                                Image(systemName: icon)
                                    .font(.title3)
                                    .foregroundStyle(.accent)
                                    .frame(width: 28)
                                Text(feature)
                                    .font(.body)
                            }
                        }
                    }
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal)

                    // Products
                    if viewModel.isLoading {
                        ProgressView()
                            .padding()
                    } else if viewModel.products.isEmpty {
                        Text(viewModel.errorMessage ?? "No products available.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding()
                    } else {
                        VStack(spacing: 12) {
                            ForEach(viewModel.products) { product in
                                ProductRow(product: product) {
                                    Task { await viewModel.purchase(product) }
                                }
                            }
                        }
                        .padding(.horizontal)
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    // Restore
                    Button("Restore Purchases") {
                        Task { await viewModel.restorePurchases() }
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                    // Legal
                    Text("Subscriptions renew automatically. Cancel anytime in App Store settings.")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 24)
                }
            }
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
            .task {
                await viewModel.loadProducts()
                AnalyticsService.shared.trackScreen("PaywallView")
            }
            .onChange(of: viewModel.isPurchased) { _, purchased in
                if purchased { dismiss() }
            }
        }
    }
}

// MARK: - Product Row

private struct ProductRow: View {
    let product: Product
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(product.displayName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    if let sub = product.subscription {
                        Text(subscriptionPeriodLabel(sub.subscriptionPeriod))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text(product.displayPrice)
                    .font(.headline)
                    .foregroundStyle(.accent)
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private func subscriptionPeriodLabel(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day: return "per \(period.value == 1 ? "day" : "\(period.value) days")"
        case .week: return "per \(period.value == 1 ? "week" : "\(period.value) weeks")"
        case .month: return "per \(period.value == 1 ? "month" : "\(period.value) months")"
        case .year: return "per \(period.value == 1 ? "year" : "\(period.value) years")"
        @unknown default: return ""
        }
    }
}

#Preview {
    PaywallView()
}
