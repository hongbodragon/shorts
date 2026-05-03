ALTER TABLE articles ADD COLUMN youtube_video_id TEXT;
ALTER TABLE articles ADD COLUMN youtube_stats TEXT; -- JSON: {views, likes, comments, subscribers, checked_at}
