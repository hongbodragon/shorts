PRAGMA journal_mode=WAL;

-- 카테고리
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,       -- '방산/국방'
    slug        TEXT NOT NULL UNIQUE,       -- 'defense'
    keywords    TEXT NOT NULL,              -- JSON: ["K방산","KF-21","방산수출"]
    rss_urls    TEXT DEFAULT '[]',          -- JSON: ["https://..."]
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 유튜브 채널
CREATE TABLE IF NOT EXISTS channels (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    category_id         INTEGER REFERENCES categories(id),
    country_code        TEXT DEFAULT 'KR',
    language            TEXT DEFAULT 'ko',
    youtube_channel_id  TEXT,
    oauth_token         TEXT,               -- JSON (암호화 예정)
    is_active           INTEGER DEFAULT 1,
    created_at          TEXT DEFAULT (datetime('now','localtime'))
);

-- API 키 (다중 키 순환)
CREATE TABLE IF NOT EXISTS api_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name    TEXT NOT NULL,          -- 'naver', 'anthropic', 'openai', ...
    key_label       TEXT,                   -- 사용자 메모
    api_key         TEXT NOT NULL,
    extra           TEXT DEFAULT '{}',      -- JSON: client_secret 등 추가 정보
    is_active       INTEGER DEFAULT 1,
    last_used_at    TEXT,
    error_count     INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- AI 설정 (채널별, NULL이면 전체 기본값)
CREATE TABLE IF NOT EXISTS ai_settings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id          INTEGER REFERENCES channels(id),  -- NULL = 전체 기본값
    script_provider     TEXT DEFAULT 'claude',            -- claude / openai / gemini
    script_model        TEXT DEFAULT 'claude-sonnet-4-6',
    image_provider      TEXT DEFAULT 'pexels',            -- openai / gemini / pexels / unsplash
    tts_provider        TEXT DEFAULT 'polly',             -- polly / google / typecast
    updated_at          TEXT DEFAULT (datetime('now','localtime'))
);

-- 수집된 기사
CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER REFERENCES categories(id),
    title           TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    source          TEXT,                   -- '네이버뉴스', '국방일보'
    description     TEXT,
    content         TEXT,
    thumbnail_url   TEXT,
    published_at    TEXT,
    collected_at    TEXT DEFAULT (datetime('now','localtime')),
    -- 초기 반응 (수집 시점)
    initial_comments    INTEGER DEFAULT 0,
    initial_likes       INTEGER DEFAULT 0
);

-- 기사 반응 시계열 (1시간 후 재조회)
CREATE TABLE IF NOT EXISTS article_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER REFERENCES articles(id),
    checked_at      TEXT DEFAULT (datetime('now','localtime')),
    comments        INTEGER DEFAULT 0,
    likes           INTEGER DEFAULT 0,
    shares          INTEGER DEFAULT 0,
    -- 증가 속도 (건/시간)
    comment_velocity    REAL DEFAULT 0,
    like_velocity       REAL DEFAULT 0
);

-- 반응 임계값 설정 (카테고리별)
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id             INTEGER REFERENCES categories(id),  -- NULL = 전체 기본값
    min_comment_velocity    REAL DEFAULT 10,   -- 댓글 증가 기준 (건/시간)
    min_like_velocity       REAL DEFAULT 50,   -- 좋아요 증가 기준 (건/시간)
    updated_at              TEXT DEFAULT (datetime('now','localtime'))
);

-- Kanban 워크플로우 상태
CREATE TABLE IF NOT EXISTS workflow_state (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER REFERENCES articles(id) UNIQUE,
    channel_id      INTEGER REFERENCES channels(id),
    stage           TEXT DEFAULT 'collected',
    -- collected → approved → scripting → imaging → subtitling
    -- → preview → uploading → monitoring → done → trash
    is_ab_test      INTEGER DEFAULT 0,
    ab_test_id      INTEGER,
    notes           TEXT,
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- 제작된 영상
CREATE TABLE IF NOT EXISTS videos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER REFERENCES articles(id),
    channel_id      INTEGER REFERENCES channels(id),
    ab_variant      TEXT,                   -- NULL / 'A' / 'B'
    ab_test_id      INTEGER,
    -- AI 사용 정보 (성과 분석용)
    script_provider TEXT,
    script_model    TEXT,
    image_provider  TEXT,
    tts_provider    TEXT,
    -- 콘텐츠
    title           TEXT,
    description     TEXT,
    tags            TEXT DEFAULT '[]',      -- JSON
    script          TEXT,
    -- 파일 경로 (로컬)
    audio_path      TEXT,
    video_path      TEXT,
    thumbnail_path  TEXT,
    -- 유튜브
    youtube_video_id    TEXT,
    uploaded_at         TEXT,
    created_at          TEXT DEFAULT (datetime('now','localtime'))
);

-- 영상 성과 시계열
CREATE TABLE IF NOT EXISTS video_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id        INTEGER REFERENCES videos(id),
    ab_test_id      INTEGER,
    time_offset     TEXT NOT NULL,          -- '1h' / '6h' / '24h'
    checked_at      TEXT DEFAULT (datetime('now','localtime')),
    views           INTEGER DEFAULT 0,
    watch_time_views INTEGER DEFAULT 0,    -- 유효조회수
    likes           INTEGER DEFAULT 0,
    dislikes        INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    subscribers_gained INTEGER DEFAULT 0
);

-- A/B 테스트
CREATE TABLE IF NOT EXISTS ab_tests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER REFERENCES articles(id),
    variable_name   TEXT NOT NULL,          -- '제목 스타일'
    value_a         TEXT NOT NULL,          -- '복잡한 제목'
    value_b         TEXT NOT NULL,          -- '간결한 제목'
    video_id_a      INTEGER REFERENCES videos(id),
    video_id_b      INTEGER REFERENCES videos(id),
    status          TEXT DEFAULT 'pending', -- pending / running / done
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- 기본 데이터 삽입
INSERT OR IGNORE INTO categories (name, slug, keywords) VALUES
    ('방산/국방', 'defense', '["K방산","KF-21","방산수출","한화에어로스페이스","현대로템","한국형전투기"]'),
    ('국제/정치', 'global', '["트럼프","미중관계","우크라이나","NATO","지정학"]'),
    ('반도체/AI', 'tech', '["HBM","엔비디아","삼성파운드리","TSMC","AI반도체"]'),
    ('주식/금융', 'finance', '["코스피","코스닥","실적발표","외국인순매수","금리"]'),
    ('개그/시사', 'humor', '["시사풍자","밈","SNS화제"]');

INSERT OR IGNORE INTO ai_settings (channel_id, script_provider, script_model, image_provider, tts_provider)
    VALUES (NULL, 'claude', 'claude-sonnet-4-6', 'pexels', 'polly');

INSERT OR IGNORE INTO alert_thresholds (category_id, min_comment_velocity, min_like_velocity)
    VALUES (NULL, 10, 50);
