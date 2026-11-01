-- 리드 리포트 문자(2026-11-01 사용자 지시). 마케터 계정당 1행.
-- 아침 9시: 오늘 00~09시 접수 건수 / 밤 12시: 어제 하루(00~24시) 접수 건수 — 각각 따로 켜고 끈다.
-- 문자(LMS)는 리드팟 비용이라 기존 계정 문자 권한·월 상한(V25)을 그대로 탄다.
create table lead_report_settings (
    owner_id        bigint primary key references users (id),
    morning_enabled boolean not null default false,
    daily_enabled   boolean not null default false,
    -- 받을 번호. 비우면 계정 연락처(users.phone)로 보낸다.
    phone           varchar(20),
    updated_at      timestamptz not null default now()
);
