-- 랜딩페이지 전체 배경 컬러(화이트·블랙·블루 프리셋 + 커스텀). null/빈 값 = 화이트(기본).
alter table landing_pages add column bg_color varchar(9);
