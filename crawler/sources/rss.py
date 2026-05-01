import json
import feedparser
from datetime import datetime
from db import get_conn

RSS_FEEDS = {
    "defense": [
        "https://www.kookbang.com/rss/rss.jsp",   # 국방일보
    ],
}


def fetch_rss(feed_url: str) -> list[dict]:
    feed = feedparser.parse(feed_url)
    return [_normalize(e) for e in feed.entries]


def _normalize(entry) -> dict:
    published = ""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        published = datetime(*entry.published_parsed[:6]).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "title": entry.get("title", ""),
        "url": entry.get("link", ""),
        "description": entry.get("summary", "")[:500],
        "published_at": published,
        "source": entry.get("author", "RSS"),
    }


def fetch_and_save(category_id: int, slug: str) -> int:
    urls = RSS_FEEDS.get(slug, [])
    conn = get_conn()

    # DB에 저장된 RSS URL도 추가
    row = conn.execute(
        "SELECT rss_urls FROM categories WHERE id = ?", (category_id,)
    ).fetchone()
    if row:
        urls += json.loads(row["rss_urls"] or "[]")
    conn.close()

    saved = 0
    for url in set(urls):
        articles = fetch_rss(url)
        from sources.naver import save_articles
        saved += save_articles(category_id, articles)
    return saved
