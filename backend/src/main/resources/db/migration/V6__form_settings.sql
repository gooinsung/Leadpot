-- 폼 레벨 설정(중복/차단 등). 동일 IP 접수 허용 여부 등을 담는다.
alter table forms add column settings_config jsonb;
