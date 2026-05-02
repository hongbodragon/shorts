"""루리웹 밀리터리 취미갤 크롤러.

핫 게시글(조회수/댓글 기준 초과) 탐지 → 네이버에서 관련 뉴스 검색 → DB 저장.
댓글 내용은 JavaScript 렌더링 필요라 수집 불가 → 조회수+댓글수로 반응 측정.
"""
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from db import get_conn

BOARD_URL = "https://bbs.ruliweb.com/hobby/board/300227"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# 핫 게시글 기준 (조회수 OR 댓글수 초과 시 탐지)
HOT_VIEW_THRESHOLD = 3000   # 조회수
HOT_REPLY_THRESHOLD = 10    # 댓글수


def fetch_posts(pages: int = 2) -> list[dict]:
    """루리웹 밀리터리 게시판 게시글 목록 수집."""
    posts = []
    for page in range(1, pages + 1):
        url = f"{BOARD_URL}?page={page}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            r.raise_for_status()
        except Exception as e:
            print(f"  루리웹 요청 오류 (page={page}): {e}")
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        rows = soup.select("tr.table_body")

        for row in rows:
            try:
                post = _parse_row(row)
                if post:
                    posts.append(post)
            except Exception:
                continue

        time.sleep(1)  # 서버 부하 방지

    return posts


def _parse_row(row) -> dict | None:
    title_tag = row.select_one("a.subject_link")
    if not title_tag:
        return None

    title_full = title_tag.get_text(strip=True)
    # "(숫자)" 패턴 = 댓글 수
    m = re.search(r"\((\d+)\)\s*$", title_full)
    reply_cnt = int(m.group(1)) if m else 0
    title = re.sub(r"\s*\(\d+\)\s*$", "", title_full).strip()

    url = title_tag.get("href", "").split("?")[0]

    view_cnt = 0
    for td in row.select("td"):
        if "hit" in " ".join(td.get("class", [])):
            view_cnt = int(re.sub(r"[^\d]", "", td.get_text(strip=True)) or "0")
            break

    return {
        "title": title,
        "url": url,
        "reply_cnt": reply_cnt,
        "view_cnt": view_cnt,
    }


def save_and_detect_hot(posts: list[dict], category_id: int) -> list[dict]:
    """게시글 저장 + 임계값 초과 게시글 반환."""
    conn = get_conn()
    hot = []

    for p in posts:
        # UPSERT: 이미 있으면 조회수/댓글수 업데이트
        existing = conn.execute(
            "SELECT id, view_cnt, comment_cnt FROM community_posts WHERE url = ?",
            (p["url"],)
        ).fetchone()

        if existing:
            conn.execute(
                """UPDATE community_posts
                   SET view_cnt=?, comment_cnt=?, updated_at=datetime('now','localtime')
                   WHERE id=?""",
                (p["view_cnt"], p["reply_cnt"], existing["id"])
            )
        else:
            conn.execute(
                """INSERT INTO community_posts
                   (source, category_id, title, url, recommend, comment_cnt, view_cnt)
                   VALUES ('ruliweb', ?, ?, ?, 0, ?, ?)""",
                (category_id, p["title"], p["url"], p["reply_cnt"], p["view_cnt"])
            )

        # 핫 게시글 판정
        if p["view_cnt"] >= HOT_VIEW_THRESHOLD or p["reply_cnt"] >= HOT_REPLY_THRESHOLD:
            hot.append(p)

    conn.commit()
    conn.close()
    return hot


def search_news_for_post(post: dict) -> list[dict]:
    """핫 게시글 제목으로 네이버 뉴스 검색."""
    from sources.naver import fetch_news, save_articles

    # 제목에서 핵심 키워드 추출 (명사 위주 앞 20자)
    keyword = post["title"][:20].strip()

    try:
        articles = fetch_news(keyword, display=5)
        return articles
    except Exception as e:
        print(f"  뉴스 검색 오류 ({keyword}): {e}")
        return []


def run(category_id: int = 1):
    """루리웹 모니터링 메인 함수."""
    print("[루리웹] 밀리터리 게시판 크롤링...")
    posts = fetch_posts(pages=2)
    print(f"  → 수집 {len(posts)}건")

    hot = save_and_detect_hot(posts, category_id)
    print(f"  → 핫 게시글 {len(hot)}건 (조회 {HOT_VIEW_THRESHOLD}+ 또는 댓글 {HOT_REPLY_THRESHOLD}+)")

    if not hot:
        return []

    results = []
    for p in hot:
        print(f"  🔥 [{p['view_cnt']}조회/{p['reply_cnt']}댓글] {p['title'][:40]}")
        articles = search_news_for_post(p)
        if articles:
            from sources.naver import save_articles
            saved = save_articles(category_id, articles)
            print(f"     → 관련 뉴스 {saved}건 저장")
            results.append({"post": p, "articles": articles})

    return results
