// ArticleView.swift — {{APP_NAME}}
import SwiftUI

struct ArticleView: View {
    let article: Article
    @AppStorage("bookmarks") private var bookmarksData: Data = Data()
    @State private var isBookmarked = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(article.title)
                    .font(.largeTitle).bold()
                Text(article.category)
                    .font(.caption).foregroundStyle(.secondary)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.ultraThinMaterial).clipShape(Capsule())
                Divider()
                Text(article.content)
                    .font(.body).lineSpacing(6)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button { toggleBookmark() } label: {
                Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
            }
        }
        .onAppear {
            isBookmarked = getBookmarkIds().contains(article.id.uuidString)
            AnalyticsService.shared.trackScreen("Article:\(article.title)")
        }
    }

    private func toggleBookmark() {
        var ids = getBookmarkIds()
        let idStr = article.id.uuidString
        if ids.contains(idStr) { ids.remove(idStr) } else { ids.insert(idStr) }
        isBookmarked = ids.contains(idStr)
        if let data = try? JSONEncoder().encode(Array(ids)) { bookmarksData = data }
    }

    private func getBookmarkIds() -> Set<String> {
        (try? JSONDecoder().decode([String].self, from: bookmarksData)).map(Set.init) ?? []
    }
}
