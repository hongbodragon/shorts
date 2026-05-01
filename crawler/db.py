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
    """마이그레이션 파일을 순서대로 실행해 DB 초기화."""
    conn = get_conn()
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    for f in migration_files:
        print(f"  Running migration: {f.name}")
        conn.executescript(f.read_text(encoding="utf-8"))
    conn.commit()
    conn.close()
    print(f"DB initialized: {DB_PATH}")


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
