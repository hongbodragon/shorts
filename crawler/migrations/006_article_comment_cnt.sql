-- articles 테이블에 댓글수 컬럼 추가 (다모앙 커뮤니티 글용)
ALTER TABLE articles ADD COLUMN comment_cnt INTEGER DEFAULT 0;
