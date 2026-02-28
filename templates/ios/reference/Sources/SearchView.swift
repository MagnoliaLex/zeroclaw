// SearchView.swift — {{APP_NAME}}
import SwiftUI

struct SearchView: View {
    @State private var query = ""
    private let allArticles: [Article] = Category.samples.flatMap(\.articles)

    var results: [Article] {
        guard !query.isEmpty else { return [] }
        return allArticles.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
            $0.content.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        List(results) { article in
            NavigationLink(destination: ArticleView(article: article)) {
                VStack(alignment: .leading) {
                    Text(article.title).font(.headline)
                    Text(article.summary).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .searchable(text: $query, prompt: "Search all articles")
        .navigationTitle("Search")
        .overlay {
            if query.isEmpty {
                ContentUnavailableView("Search Articles", systemImage: "magnifyingglass", description: Text("Type to search across all content"))
            } else if results.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
    }
}
