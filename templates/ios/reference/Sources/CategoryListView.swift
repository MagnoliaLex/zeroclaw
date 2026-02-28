// CategoryListView.swift — {{APP_NAME}}
import SwiftUI

struct Category: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let icon: String
    let articles: [Article]
}

struct Article: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let summary: String
    let content: String
    let category: String
}

struct CategoryListView: View {
    @State private var searchText = ""
    @State private var categories: [Category] = Category.samples
    @State private var showingSettings = false

    var filteredCategories: [Category] {
        if searchText.isEmpty { return categories }
        return categories.map { cat in
            Category(name: cat.name, icon: cat.icon,
                     articles: cat.articles.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.content.localizedCaseInsensitiveContains(searchText) })
        }.filter { !$0.articles.isEmpty }
    }

    var body: some View {
        List(filteredCategories) { category in
            Section(header: Label(category.name, systemImage: category.icon)) {
                ForEach(category.articles) { article in
                    NavigationLink(value: article) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(article.title).font(.headline)
                            Text(article.summary).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("{{APP_NAME}}")
        .searchable(text: $searchText, prompt: "Search articles")
        .navigationDestination(for: Article.self) { article in
            ArticleView(article: article)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                NavigationLink(destination: BookmarkView()) {
                    Image(systemName: "bookmark")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingSettings = true } label: { Image(systemName: "gear") }
            }
        }
        .sheet(isPresented: $showingSettings) { NavigationStack { SettingsView() } }
        .onAppear { AnalyticsService.shared.trackScreen("CategoryList") }
    }
}

extension Category {
    static let samples: [Category] = [
        Category(name: "Getting Started", icon: "star", articles: [
            Article(title: "Welcome", summary: "Introduction to the app", content: "Welcome to {{APP_NAME}}. This guide covers all the essentials.", category: "Getting Started"),
            Article(title: "Quick Start", summary: "Get up and running fast", content: "Follow these steps to get started quickly with {{APP_NAME}}.", category: "Getting Started"),
        ]),
        Category(name: "Advanced Topics", icon: "book", articles: [
            Article(title: "Deep Dive", summary: "Advanced concepts explained", content: "This article covers advanced topics in detail.", category: "Advanced Topics"),
        ]),
    ]
}
