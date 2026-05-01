"""
크롤러 진입점.

사용법:
  python main.py          # 스케줄러 모드 (1시간마다 자동)
  python main.py --once   # 1회 실행 후 종료
  python main.py --init   # DB 초기화만
"""
import sys
from pathlib import Path

# 크롤러 폴더를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent))

from db import init_db


def main():
    args = sys.argv[1:]

    if "--init" in args:
        init_db()
        return

    # DB가 없으면 자동 초기화
    from db import DB_PATH
    if not DB_PATH.exists():
        print("DB가 없어 초기화합니다...")
        init_db()

    if "--once" in args:
        from scheduler import run_once
        run_once()
    else:
        from scheduler import run_scheduler
        run_scheduler()


if __name__ == "__main__":
    main()
