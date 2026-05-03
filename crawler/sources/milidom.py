"""밀리돔 뉴스 크롤러.

https://milidom.net/news 조회수 기반 핫 기사 수집.
테이블 구조: td[0]=번호, td[1]=카테고리, td[2]=제목, td[3]=닉네임,
             td[4]=날짜(YY.MM.DD.HH:MM), td[5]=추천, td[6]=조회수
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from db import get_conn

NEWS_URL = "https://milidom.net/news"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer": "https://milidom.net/",
}

HOT_VIEW_THRESHOLD = 300
SOURCE_NAME = "밀리돔"


def fetch_articles(pages: int = 2) -> list[dict]:
    """밀리돔 뉴스 목록 수집."""
    articles = []
    for page in range(1, pages + 1):
        url = NEWS_URL if page == 1 else f"{NEWS_URL}?page={page}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
        except Exception as e:
            print(f"  밀리돔 요청 오류 (page={page}): {e}")
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        parsed = _parse_rows(soup)
        articles.extend(parsed)
        time.sleep(1)

    # URL 기준 중복 제거
    seen, unique = set(), []
    for a in articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique.append(a)
    return unique


def _parse_rows(soup: BeautifulSoup) -> list[dict]:
    results = []
    for tr in soup.select("tr"):
        tds = tr.select("td")
        if len(tds) < 7:
            continue

        # 공지글(le-text-notice)은 건너뜀
        if "le-text-notice" in " ".join(tds[0].get("class", [])):
            continue

        # 게시글 번호 (lu-ldn-number)
        if "lu-ldn-number" not in " ".join(tds[0].get("class", [])):
            continue

        # 제목 + URL
        title_td = tds[2]
        a = title_td.select_one("a[href*='/news/']")
        if not a:
            continue

        href = a.get("href", "")
        # normal/hot 배지 제거 후 제목만 추출
        for badge in a.select("span, em, strong"):
            badge.decompose()
        title = a.get_text(strip=True)
        if len(title) < 4:
            continue

        # 조회수 (td[6])
        view_text = tds[6].get_text(strip=True).replace(",", "")
        view_cnt = int(view_text) if re.match(r"^\d+$", view_text) else 0

        # 날짜 (td[4]): "26.05.01.23:36" → "2026-05-01 23:36:00"
        published_at = _parse_date(tds[4].get_text(strip=True))

        full_url = f"https://milidom.net{href}" if href.startswith("/") else href

        results.append({
            "title": title,
            "url": full_url,
            "view_cnt": view_cnt,
            "description": "",
            "source": SOURCE_NAME,
            "published_at": published_at,
        })

    return results


def _parse_date(text: str) -> str:
    """YY.MM.DD.HH:MM → YYYY-MM-DD HH:MM:00"""
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{2})\.(\d{2}):(\d{2})", text)
    if m:
        yy, mo, dd, hh, mm = m.groups()
        return f"20{yy}-{mo}-{dd} {hh}:{mm}:00"
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def save_articles(articles: list[dict], category_id: int) -> tuple[int, list[dict]]:
    """기사 저장(UPSERT: view_cnt 갱신) + 핫 기사 반환."""
    conn = get_conn()
    saved = 0
    hot = []

    for a in articles:
        existing = conn.execute(
            "SELECT id, view_cnt FROM articles WHERE url = ?", (a["url"],)
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE articles SET view_cnt=? WHERE id=?",
                (a["view_cnt"], existing["id"])
            )
        else:
            conn.execute(
                """INSERT INTO articles
                   (category_id, title, url, description, source, published_at, view_cnt)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (category_id, a["title"], a["url"], a["description"],
                 a["source"], a["published_at"], a["view_cnt"])
            )
            saved += 1

        if a["view_cnt"] >= HOT_VIEW_THRESHOLD:
            hot.append(a)

    conn.commit()
    conn.close()
    return saved, hot


def run(category_id: int = 1) -> list[dict]:
    """밀리돔 뉴스 모니터링 메인 함수."""
    print("[밀리돔] 뉴스 크롤링...")
    articles = fetch_articles(pages=2)
    print(f"  → 수집 {len(articles)}건")

    if not articles:
        print("  → 기사 없음 (사이트 구조 변경 확인 필요)")
        return []

    saved, hot = save_articles(articles, category_id)
    print(f"  → 신규 {saved}건 저장, 핫 기사 {len(hot)}건 (조회 {HOT_VIEW_THRESHOLD}+)")

    for a in hot:
        print(f"  [HOT] [조회 {a['view_cnt']:,}] {a['title'][:50]}")

    return hot
