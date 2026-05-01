"""APScheduler: 1시간마다 크롤링 + 반응 체크."""
import json
import sys
from apscheduler.schedulers.blocking import BlockingScheduler
from db import get_conn


def crawl_all():
    """활성 카테고리의 모든 키워드 크롤링."""
    from sources.naver import fetch_news, save_articles
    from sources.rss import fetch_and_save

    conn = get_conn()
    categories = conn.execute(
        "SELECT * FROM categories WHERE is_active = 1"
    ).fetchall()
    conn.close()

    for cat in categories:
        keywords = json.loads(cat["keywords"])
        total = 0
        print(f"[크롤링] {cat['name']} ({len(keywords)}개 키워드)")
        for kw in keywords:
            try:
                articles = fetch_news(kw, display=10)
                saved = save_articles(cat["id"], articles)
                total += saved
            except Exception as e:
                print(f"  키워드 '{kw}' 오류: {e}")

        # RSS
        try:
            rss_saved = fetch_and_save(cat["id"], cat["slug"])
            total += rss_saved
        except Exception as e:
            print(f"  RSS 오류: {e}")

        print(f"  → 신규 {total}건 저장")


def check_metrics():
    """반응 체크 → 임계값 초과 시 텔레그램 알람."""
    from metrics import check_article_metrics
    from alert import send_alert

    print("[반응 체크] 1시간 전 기사 반응 확인 중...")
    triggered = check_article_metrics()
    if triggered:
        print(f"  → {len(triggered)}건 임계값 초과, 알람 전송")
        send_alert(triggered)
    else:
        print("  → 임계값 초과 기사 없음")


def run_once():
    print("=== 1회 실행 모드 ===")
    crawl_all()
    check_metrics()
    print("=== 완료 ===")


def run_scheduler():
    print("=== 스케줄러 시작 (1시간마다 자동 실행) ===")
    print("종료: Ctrl+C")

    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    # 시작 즉시 1회 실행
    scheduler.add_job(crawl_all, "date")
    scheduler.add_job(check_metrics, "date")
    # 이후 1시간마다
    scheduler.add_job(crawl_all, "interval", hours=1, id="crawl")
    scheduler.add_job(check_metrics, "interval", hours=1, id="metrics",
                      minutes=5)  # 크롤링 5분 후 체크

    try:
        scheduler.start()
    except KeyboardInterrupt:
        print("\n스케줄러 종료")
