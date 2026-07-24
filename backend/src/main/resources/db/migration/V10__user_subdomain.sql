-- D3: 사용자별 서브도메인 — 공개 라우팅 {subdomain}.도메인/{랜딩번호|슬러그}
-- 기본은 랜덤 문자열, 사용자가 설정에서 변경 가능(예약어·중복 차단).
alter table users add column subdomain varchar(30);

-- 기존 사용자 백필: 랜덤 소문자 문자열('u' + 11자). 신규 가입은 앱에서 유일성 보장.
update users
   set subdomain = 'u' || substr(md5(random()::text || id::text), 1, 11)
 where subdomain is null;

alter table users alter column subdomain set not null;
alter table users add constraint uk_users_subdomain unique (subdomain);
