import sqlite3
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DB_PATH = Path(__file__).parent.parent / os.getenv("DB_PATH", "data/db.sqlite")
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """마이그레이션 파일을 순서대로 실행해 DB 초기화 (적용된 것은 건너뜀)."""
    conn = get_conn()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT)"
    )
    conn.commit()

    # _migrations 테이블이 비어 있고 articles 테이블이 이미 존재하면
    # 이전에 적용된 마이그레이션을 추적 없이 실행한 것이므로 현재 DB 상태를 기준으로 시드
    count = conn.execute("SELECT COUNT(*) FROM _migrations").fetchone()[0]
    if count == 0:
        _seed_existing_migrations(conn)

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    for f in migration_files:
        already = conn.execute(
            "SELECT 1 FROM _migrations WHERE name = ?", (f.name,)
        ).fetchone()
        if already:
            continue
        print(f"  Running migration: {f.name}")
        try:
            conn.executescript(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  [경고] {f.name} 실행 오류 (이미 적용됐을 수 있음): {e}")
        conn.execute(
            "INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, datetime('now','localtime'))",
            (f.name,)
        )
        conn.commit()

    conn.close()
    print(f"DB initialized: {DB_PATH}")


def _seed_existing_migrations(conn):
    """기존 DB 상태를 감지해 이미 적용된 마이그레이션을 _migrations에 기록."""
    tables = {
        row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    def _has_column(table, col):
        if table not in tables:
            return False
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        return col in cols

    seeds = []
    if "articles" in tables:
        seeds.append("001_init.sql")
    if _has_column("ai_settings", "image_model"):
        seeds.append("002_image_model.sql")
    if "community_posts" in tables:
        seeds.append("003_community.sql")
    if _has_column("articles", "view_cnt"):
        seeds.append("004_view_cnt.sql")
    if _has_column("articles", "alerted_at"):
        seeds.append("005_alerted_at.sql")

    for name in seeds:
        conn.execute(
            "INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, datetime('now','localtime'))",
            (name,)
        )
    conn.commit()
    if seeds:
        print(f"  [마이그레이션 시드] 기존 적용 마이그레이션 {len(seeds)}개 기록: {', '.join(seeds)}")


def get_active_api_key(service_name: str) -> dict | None:
    """라운드로빈으로 활성 API 키 반환. 오류 적은 키 우선."""
    conn = get_conn()
    row = conn.execute(
        """SELECT * FROM api_keys
           WHERE service_name = ? AND is_active = 1
           ORDER BY error_count ASC, last_used_at ASC NULLS FIRST
           LIMIT 1""",
        (service_name,),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE api_keys SET last_used_at = datetime('now','localtime') WHERE id = ?",
            (row["id"],),
        )
        conn.commit()
    conn.close()
    return dict(row) if row else None


def mark_api_key_error(key_id: int):
    conn = get_conn()
    conn.execute(
        "UPDATE api_keys SET error_count = error_count + 1 WHERE id = ?", (key_id,)
    )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
