"""핫 콘텐츠 감지.

다모앙 community_posts: 댓글수 기준
밀리돔 articles: 조회수 기준

check_hot()은 scheduler.py의 check_hot_and_alert()에서 호출됨.
"""
from db import get_conn

DAMOANG_COMMENT_THRESHOLD = 5
MILIDOM_VIEW_THRESHOLD = 300


def get_hot_community_posts() -> list[dict]:
    """아직 알람 안 보낸 다모앙 핫 게시글 반환."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM community_posts
           WHERE comment_cnt >= ?
             AND alerted_at IS NULL
           ORDER BY comment_cnt DESC LIMIT 20""",
        (DAMOANG_COMMENT_THRESHOLD,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_hot_milidom_articles() -> list[dict]:
    """아직 알람 안 보낸 밀리돔 핫 기사 반환."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM articles
           WHERE source = '밀리돔'
             AND view_cnt >= ?
             AND alerted_at IS NULL
           ORDER BY view_cnt DESC LIMIT 20""",
        (MILIDOM_VIEW_THRESHOLD,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
