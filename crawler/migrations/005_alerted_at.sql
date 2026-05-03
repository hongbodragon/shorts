-- 알람 발송 여부 추적 (중복 알람 방지)
ALTER TABLE articles ADD COLUMN alerted_at TEXT;
ALTER TABLE community_posts ADD COLUMN alerted_at TEXT;
