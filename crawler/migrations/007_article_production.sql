-- 숏츠 제작용 컬럼 추가
ALTER TABLE articles ADD COLUMN shorts_title TEXT;
ALTER TABLE articles ADD COLUMN script TEXT;
ALTER TABLE articles ADD COLUMN script_requirements TEXT;
ALTER TABLE articles ADD COLUMN tts_path TEXT;
ALTER TABLE articles ADD COLUMN image_paths TEXT;   -- JSON array
