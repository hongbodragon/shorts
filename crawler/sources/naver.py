import json
import requests
from datetime import datetime
from db import get_conn, get_active_api_key, mark_api_key_error


def fetch_news(keyword: str, display: int = 20) -> list[dict]:
    """네이버 뉴스 검색 API 호출. api_keys 테이블에서 키 자동 순환."""
    key = get_active_api_key("naver")
    if not key:
        raise RuntimeError("네이버 API 키가 없습니다. 대시보드 설정에서 등록해주세요.")

    extra = json.loads(key.get("extra", "{}"))
    client_id = key["api_key"]
    client_secret = extra.get("client_secret", "")

    url = "https://openapi.naver.com/v1/search/news.json"
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    params = {"query": keyword, "display": display, "sort": "date"}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        items = resp.json().get("items", [])
        return [_normalize(item) for item in items]
    except requests.HTTPError as e:
        if resp.status_code in (401, 403, 429):
            mark_api_key_error(key["id"])
            raise RuntimeError(f"네이버 API 키 오류 (id={key['id']}): {e}") from e
        raise


def _normalize(item: dict) -> dict:
    import re
    clean = re.compile(r"<[^>]+>")
    return {
        "title": clean.sub("", item.get("title", "")),
        "url": item.get("originallink") or item.get("link", ""),
        "description": clean.sub("", item.get("description", "")),
        "published_at": _parse_date(item.get("pubDate", "")),
        "source": "네이버뉴스",
    }


def _parse_date(pub_date: str) -> str:
    try:
        dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def save_articles(category_id: int, articles: list[dict]) -> int:
    """새 기사만 저장하고 저장된 수 반환."""
    conn = get_conn()
    saved = 0
    for a in articles:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO articles
                   (category_id, title, url, description, source, published_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (category_id, a["title"], a["url"],
                 a["description"], a["source"], a["published_at"]),
            )
            if conn.total_changes > 0:
                saved += 1
        except Exception as e:
            print(f"  저장 오류: {e}")
    conn.commit()
    conn.close()
    return saved
