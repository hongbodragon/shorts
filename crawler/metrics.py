"""1시간 후 기사 반응 재조회 → 증가 속도 계산 → 임계값 초과 시 알람."""
from datetime import datetime, timedelta
from db import get_conn


def check_article_metrics():
    """수집된 지 50~70분 된 기사의 반응을 재조회해 속도 계산."""
    conn = get_conn()
    now = datetime.now()
    window_start = (now - timedelta(minutes=70)).strftime("%Y-%m-%d %H:%M:%S")
    window_end = (now - timedelta(minutes=50)).strftime("%Y-%m-%d %H:%M:%S")

    articles = conn.execute(
        """SELECT a.*, c.slug as category_slug
           FROM articles a
           JOIN categories c ON c.id = a.category_id
           WHERE a.collected_at BETWEEN ? AND ?
             AND NOT EXISTS (
                 SELECT 1 FROM article_metrics m WHERE m.article_id = a.id
             )""",
        (window_start, window_end),
    ).fetchall()

    triggered = []
    for article in articles:
        # 네이버 뉴스 댓글 수는 별도 API 없이 추정 (추후 구현)
        # 현재는 초기값과 비교해 변화량 0으로 기록, 구조만 준비
        current_comments = article["initial_comments"]
        current_likes = article["initial_likes"]

        elapsed_hours = _hours_since(article["collected_at"])
        if elapsed_hours <= 0:
            continue

        comment_velocity = current_comments / elapsed_hours
        like_velocity = current_likes / elapsed_hours

        conn.execute(
            """INSERT INTO article_metrics
               (article_id, comments, likes, comment_velocity, like_velocity)
               VALUES (?, ?, ?, ?, ?)""",
            (article["id"], current_comments, current_likes,
             comment_velocity, like_velocity),
        )

        threshold = _get_threshold(conn, article["category_id"])
        if (comment_velocity >= threshold["min_comment_velocity"] or
                like_velocity >= threshold["min_like_velocity"]):
            triggered.append({
                "article": dict(article),
                "comment_velocity": comment_velocity,
                "like_velocity": like_velocity,
                "threshold": threshold,
            })

    conn.commit()
    conn.close()
    return triggered


def _hours_since(dt_str: str) -> float:
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return (datetime.now() - dt).total_seconds() / 3600
    except Exception:
        return 1.0


def _get_threshold(conn, category_id: int) -> dict:
    row = conn.execute(
        """SELECT * FROM alert_thresholds
           WHERE category_id = ? OR category_id IS NULL
           ORDER BY category_id DESC NULLS LAST LIMIT 1""",
        (category_id,),
    ).fetchone()
    return dict(row) if row else {"min_comment_velocity": 10, "min_like_velocity": 50}
