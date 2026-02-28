// PaywallView.swift — {{APP_NAME}}
import StoreKit
import SwiftUI

struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var products: [Product] = []

    private let productIds = ["com.zeroclaw.{{BUNDLE_ID}}.premium", "com.zeroclaw.{{BUNDLE_ID}}.monthly", "com.zeroclaw.{{BUNDLE_ID}}.annual"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Unlock Premium").font(.largeTitle).bold()
                Text("Access all content and features").foregroundStyle(.secondary)
                ForEach(products, id: \.id) { product in
                    Button { Task { try? await product.purchase() } } label: {
                        HStack {
                            VStack(alignment: .leading) { Text(product.displayName).bold(); Text(product.description).font(.caption) }
                            Spacer()
                            Text(product.displayPrice).bold()
                        }.padding().background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain)
                }
                Spacer()
                Button("Restore Purchases") { Task { try? await AppStore.sync() } }.font(.caption)
            }
            .padding()
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { dismiss() } } }
            .task { products = (try? await Product.products(for: productIds)) ?? [] }
        }
    }
}
