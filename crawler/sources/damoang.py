"""다모앙 밀리터리 게시판 크롤러.

게시글 제목 + 댓글수 수집 → 핫 게시글 감지.
URL 패턴: https://damoang.net/military
댓글수는 제목 끝의 [N] 패턴으로 파싱.
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from db import get_conn

BOARD_URL = "https://damoang.net/military"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer": "https://damoang.net/",
}

HOT_COMMENT_THRESHOLD = 5


def fetch_posts(pages: int = 2) -> list[dict]:
    """다모앙 밀리터리 게시판 게시글 목록 수집."""
    posts = []
    for page in range(1, pages + 1):
        url = BOARD_URL if page == 1 else f"{BOARD_URL}?page={page}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
        except Exception as e:
            print(f"  다모앙 요청 오류 (page={page}): {e}")
            continue

        soup = BeautifulSoup(r.text, "html.parser")

        # 댓글수 맵: /military/{id} → comment_cnt
        # #comments 링크에 "[N]" 형태로 분리돼 있음
        comment_map = {}
        for a in soup.find_all("a", href=re.compile(r"/military/\d+#comments")):
            base = a.get("href", "").split("#")[0]
            m = re.search(r"\[(\d+)\]", a.get_text())
            if m:
                comment_map[base] = int(m.group(1))

        # 게시글 링크 (숫자로 끝나는 것만, #comments 제외)
        seen_href = set()
        for a in soup.find_all("a", href=re.compile(r"/military/\d+$")):
            href = a.get("href", "")
            if href in seen_href:
                continue
            seen_href.add(href)

            full_text = a.get_text()
            # 앞의 숫자(게시글 번호) 제거, [N] 이전까지가 제목
            m = re.search(r"^\s*\d*\s*(.*?)\s*\[", full_text, re.DOTALL)
            if m:
                title = re.sub(r"\s+", " ", m.group(1)).strip()
            else:
                title = re.sub(r"\s+", " ", full_text).strip()

            if len(title) < 4:
                continue

            full_url = ("https://damoang.net" + href) if not href.startswith("http") else href
            comment_cnt = comment_map.get(href, 0)
            view_cnt = _parse_view_cnt(full_text)
            published_at = _parse_post_date(full_text)

            posts.append({
                "title": title,
                "url": full_url,
                "comment_cnt": comment_cnt,
                "view_cnt": view_cnt,
                "published_at": published_at,
            })

        time.sleep(1)

    # URL 기준 중복 제거
    seen, unique = set(), []
    for p in posts:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique.append(p)
    return unique


def _parse_post_date(text: str) -> str:
    """링크 텍스트에서 글 작성일 추출. '04.29' → '2026-04-29 00:00:00'."""
    from datetime import datetime
    now = datetime.now()
    # [N] 이후 텍스트에서 MM.DD 패턴
    after_comment = re.split(r"\[\d+\]", text)[-1]
    m = re.search(r"(\d{2})\.(\d{2})", after_comment)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        year = now.year
        # 미래 날짜라면 작년으로 처리
        if month > now.month or (month == now.month and day > now.day):
            year -= 1
        return f"{year}-{month:02d}-{day:02d} 00:00:00"
    return now.strftime("%Y-%m-%d 00:00:00")


def _parse_view_cnt(text: str) -> int:
    """링크 텍스트에서 조회수 추출. '1.5k' → 1500, '2k' → 2000."""
    # [N] 이후 텍스트에서 날짜(MM.DD) 다음의 숫자/k 패턴
    after_comment = re.split(r"\[\d+\]", text)[-1]
    m = re.search(r"\d{2}\.\d{2}\s+([\d.]+)([kK]?)", after_comment)
    if m:
        num = float(m.group(1))
        return int(num * 1000) if m.group(2).lower() == "k" else int(num)
    return 0


def save_and_detect_hot(posts: list[dict], category_id: int) -> list[dict]:
    """게시글 저장(UPSERT) → community_posts + articles 양쪽에 저장."""
    conn = get_conn()
    hot = []

    for p in posts:
        # community_posts: 원본 데이터 보관
        existing_cp = conn.execute(
            "SELECT id FROM community_posts WHERE url = ?", (p["url"],)
        ).fetchone()

        if existing_cp:
            conn.execute(
                "UPDATE community_posts SET comment_cnt=?, view_cnt=?, updated_at=datetime('now','localtime') WHERE id=?",
                (p["comment_cnt"], p["view_cnt"], existing_cp["id"])
            )
        else:
            conn.execute(
                """INSERT INTO community_posts (source, category_id, title, url, comment_cnt, view_cnt)
                   VALUES ('damoang', ?, ?, ?, ?, ?)""",
                (category_id, p["title"], p["url"], p["comment_cnt"], p["view_cnt"])
            )

        # articles: 칸반 워크플로우에 통합
        existing_art = conn.execute(
            "SELECT id FROM articles WHERE url = ?", (p["url"],)
        ).fetchone()

        if existing_art:
            conn.execute(
                "UPDATE articles SET comment_cnt=?, view_cnt=?, published_at=? WHERE id=?",
                (p["comment_cnt"], p["view_cnt"], p["published_at"], existing_art["id"])
            )
        else:
            conn.execute(
                """INSERT INTO articles
                   (category_id, title, url, description, source, published_at, view_cnt, comment_cnt)
                   VALUES (?, ?, ?, '', '다모앙', ?, ?, ?)""",
                (category_id, p["title"], p["url"], p["published_at"], p["view_cnt"], p["comment_cnt"])
            )

        if p["comment_cnt"] >= HOT_COMMENT_THRESHOLD:
            hot.append(p)

    conn.commit()
    conn.close()
    return hot


def run(category_id: int = 1) -> list[dict]:
    """다모앙 모니터링 메인 함수."""
    print("[다모앙] 밀리터리 게시판 크롤링...")
    posts = fetch_posts(pages=2)
    print(f"  → 수집 {len(posts)}건")

    if not posts:
        print("  → 게시글 없음 (사이트 구조 변경 확인 필요)")
        return []

    hot = save_and_detect_hot(posts, category_id)
    print(f"  → 핫 게시글 {len(hot)}건 (댓글 {HOT_COMMENT_THRESHOLD}+)")

    for p in hot:
        print(f"  [HOT] [댓글 {p['comment_cnt']}] {p['title'][:50]}")

    return hot
