// PaywallView.swift — {{APP_NAME}}
// StoreKit 2 paywall scaffold with premium and subscription tiers.

import StoreKit
import SwiftUI

private enum ProductID {
    static let premiumMonthly = "{{BUNDLE_ID}}.premium.monthly"
    static let premiumAnnual = "{{BUNDLE_ID}}.premium.annual"
    static let lifetimePremium = "{{BUNDLE_ID}}.premium.lifetime"
}

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
                    errorMessage = "Purchase verification failed."
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
        } catch {
            errorMessage = "Restore failed: \(error.localizedDescription)"
        }
        isLoading = false
    }
}

struct PaywallView: View {
    @StateObject private var viewModel = PaywallViewModel()
    @Environment(\.dismiss) private var dismiss

    private let features: [(String, String)] = [
        ("Unlimited Conversations", "bubble.left.and.bubble.right"),
        ("Streaming Responses", "bolt.fill"),
        ("Conversation Export", "square.and.arrow.up"),
        ("Priority API Access", "speedometer"),
        ("Prompt Library (Full)", "text.book.closed")
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        Image(systemName: "sparkles.rectangle.stack.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.purple)
                            .symbolRenderingMode(.hierarchical)
                        Text("{{APP_NAME}} Premium")
                            .font(.largeTitle.bold())
                        Text("Unlock unlimited AI access")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 24)

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

                    if viewModel.isLoading {
                        ProgressView().padding()
                    } else if !viewModel.products.isEmpty {
                        VStack(spacing: 12) {
                            ForEach(viewModel.products) { product in
                                Button {
                                    Task { await viewModel.purchase(product) }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(product.displayName)
                                                .font(.headline)
                                                .foregroundStyle(.primary)
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
                        }
                        .padding(.horizontal)
                    } else if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    Button("Restore Purchases") {
                        Task { await viewModel.restorePurchases() }
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)

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

#Preview {
    PaywallView()
}
