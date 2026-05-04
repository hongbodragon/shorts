"""APScheduler: 1시간마다 커뮤니티 크롤링 + 핫 콘텐츠 알람."""
import sys
from apscheduler.schedulers.blocking import BlockingScheduler
from db import get_conn


def _get_defense_category_id() -> int:
    conn = get_conn()
    row = conn.execute("SELECT id FROM categories WHERE slug='defense'").fetchone()
    conn.close()
    return row["id"] if row else 1


def crawl_communities():
    """다모앙 크롤링 (밀리돔 제외)."""
    from sources.damoang import run as damoang_run

    category_id = _get_defense_category_id()

    damoang_hot = damoang_run(category_id)

    if damoang_hot:
        print(f"  → 핫 콘텐츠 총 {len(damoang_hot)}건 (다모앙)")

    return {"damoang": damoang_hot}


def check_hot_and_alert():
    """핫 콘텐츠 → 텔레그램 알람."""
    from metrics import get_hot_community_posts
    from alert import send_alert

    print("[핫 체크] 다모앙 핫 콘텐츠 확인 중...")
    hot_posts = get_hot_community_posts()

    if not hot_posts:
        print("  → 새로운 핫 콘텐츠 없음")
        return

    triggered = [{"type": "community", "item": p} for p in hot_posts]

    print(f"  → {len(triggered)}건 핫 콘텐츠 알람 전송")
    send_alert(triggered)

    # alerted_at 기록
    conn = get_conn()
    for p in hot_posts:
        conn.execute("UPDATE community_posts SET alerted_at=datetime('now','localtime') WHERE id=?", (p["id"],))
    conn.commit()
    conn.close()



def run_once():
    print("=== 1회 실행 모드 ===")
    crawl_communities()
    check_hot_and_alert()
    print("=== 완료 ===")


def run_scheduler():
    print("=== 스케줄러 시작 (1시간마다 자동 실행) ===")
    print("종료: Ctrl+C")

    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    # 시작 즉시 1회 실행
    scheduler.add_job(crawl_communities, "date")
    # 이후 1시간마다
    scheduler.add_job(crawl_communities, "interval", hours=1, id="crawl")
    # 크롤링 10분 후 핫 체크 + 알람
    scheduler.add_job(check_hot_and_alert, "interval", hours=1, id="alert",
                      minutes=10)

    try:
        scheduler.start()
    except KeyboardInterrupt:
        print("\n스케줄러 종료")
