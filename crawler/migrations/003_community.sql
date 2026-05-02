-- 커뮤니티 게시글 테이블
CREATE TABLE IF NOT EXISTS community_posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL DEFAULT 'ruliweb',   -- ruliweb / dcinside 등
    category_id INTEGER REFERENCES categories(id),
    title       TEXT NOT NULL,
    url         TEXT NOT NULL UNIQUE,
    recommend   INTEGER DEFAULT 0,
    comment_cnt INTEGER DEFAULT 0,
    view_cnt    INTEGER DEFAULT 0,
    top_comments TEXT,              -- JSON array: 상위 댓글 10개
    article_id  INTEGER REFERENCES articles(id),   -- 연결된 뉴스 기사
    collected_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- articles에 search_keyword 컬럼 추가
ALTER TABLE articles ADD COLUMN search_keyword TEXT;
