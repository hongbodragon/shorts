ALTER TABLE articles ADD COLUMN foreign_video_id TEXT;    -- 원본 YouTube video_id
ALTER TABLE articles ADD COLUMN foreign_video_clips TEXT;  -- JSON: [{videoId, start, end, label, clipPath}]
