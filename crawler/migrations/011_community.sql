ALTER TABLE articles ADD COLUMN community_images TEXT; -- JSON: [{url, selected, order}]
ALTER TABLE articles ADD COLUMN article_type TEXT DEFAULT 'news'; -- 'news' | 'community' | 'foreign'
