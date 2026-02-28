// BookmarkView.swift — {{APP_NAME}}
import SwiftUI

struct BookmarkView: View {
    @AppStorage("bookmarks") private var bookmarksData: Data = Data()
    private let allArticles: [Article] = Category.samples.flatMap(\.articles)

    var bookmarkedArticles: [Article] {
        let ids = (try? JSONDecoder().decode([String].self, from: bookmarksData)) ?? []
        return allArticles.filter { ids.contains($0.id.uuidString) }
    }

    var body: some View {
        Group {
            if bookmarkedArticles.isEmpty {
                ContentUnavailableView("No Bookmarks", systemImage: "bookmark", description: Text("Bookmark articles to find them here"))
            } else {
                List(bookmarkedArticles) { article in
                    NavigationLink(destination: ArticleView(article: article)) {
                        VStack(alignment: .leading) {
                            Text(article.title).font(.headline)
                            Text(article.summary).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Bookmarks")
        .onAppear { AnalyticsService.shared.trackScreen("Bookmarks") }
    }
}
