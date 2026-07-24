-- 동의 문서에 관리용 '이름'(name) 추가. 기존 title 은 공개 노출용 '제목'으로 유지.
-- 기존 행은 name 을 title 로 백필(관리 목록이 비지 않도록).
alter table consent_documents add column name varchar(255) not null default '';
update consent_documents set name = title where name = '';
