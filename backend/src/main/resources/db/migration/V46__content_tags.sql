-- 리드폼·랜딩 자유 태그(2026-10-31 사용자 지시). 문자열 배열(jsonb), null = 태그 없음.
-- 태그 목록(체크박스 후보)은 따로 테이블을 두지 않고 본인 리드폼·랜딩에 달린 태그를 모아 만든다.
alter table forms add column tags jsonb;
alter table landing_pages add column tags jsonb;
