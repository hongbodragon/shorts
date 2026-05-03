-- articles 테이블에 조회수 컬럼 추가 (밀리돔 뉴스용)
ALTER TABLE articles ADD COLUMN view_cnt INTEGER DEFAULT 0;
