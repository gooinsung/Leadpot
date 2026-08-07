-- 리드 진행상태를 마케터·광고주가 함께 쓰는 단일 축으로 통합한다 (2026-08-08 사용자 확정).
--
-- 왜: 마케터 축(신규/상담중/완료/불량)과 광고주 축(신규/확인/통화완료/부재/전환/종료)이 분리돼
-- 같은 리드를 두 사람이 다른 언어로 관리했다. 새 축은 고정 4개(신규/유효/AS요청/무효) +
-- 광고주 커스텀 상태. '유효'가 과금(DB 단가 차감)의 기준이 되고, '무효' 전환·해제는 마케터만 한다.
--
-- ⚠️ 기존 상태값은 사용자 결정대로 "전부 신규로 리셋"한다. 되돌릴 수 있게 옛 값은
-- *_legacy 컬럼에 백업만 남긴다 — 코드는 이 컬럼을 읽지 않는다. 운영 안정화 후 정리 판단.

-- ① 광고주 커스텀 상태 정의 (광고주 계정 단위 — 그 광고주의 모든 리드폼에서 공유)
create table lead_statuses (
    id            bigserial primary key,
    advertiser_id bigint      not null references users(id) on delete cascade,
    name          varchar(30) not null,
    sort_order    int         not null default 0,
    archived      boolean     not null default false, -- 삭제 대신 보관: 쓰던 리드의 이름 표시를 지키기 위함
    created_at    timestamptz not null default now(),
    unique (advertiser_id, name)
);

comment on table lead_statuses is
    '광고주가 직접 만든 리드 진행상태(상담중·부재3일차 등). 고정 상태(신규/유효/AS요청/무효)와 함께 단일 축을 이룬다(V29).';

-- ② 옛 값 백업
alter table leads add column status_legacy varchar(20);
update leads set status_legacy = status;
alter table leads rename column advertiser_status to advertiser_status_legacy;

comment on column leads.status_legacy is 'V29 이전 마케터 상태(NEW/IN_PROGRESS/DONE/SPAM) 백업. 코드는 읽지 않는다.';
comment on column leads.advertiser_status_legacy is 'V29 이전 광고주 상태(NEW/CONFIRMED/CALLED/NO_ANSWER/CONVERTED/CLOSED) 백업. 코드는 읽지 않는다.';

-- ③ 새 축 컬럼 — advertiser_status_at 은 "상태 변경 시각"으로 의미가 넓어진다(마케터 변경 포함).
--    광고주 리포트의 접수→상태변경 평균이 이 컬럼을 그대로 쓴다.
alter table leads rename column advertiser_status_at to status_changed_at;
alter table leads add column custom_status_id bigint references lead_statuses(id) on delete set null;

comment on column leads.status is '통합 진행상태: NEW(신규)|VALID(유효,과금 기준)|AS_REQUESTED(AS요청)|INVALID(무효,마케터 전용)|CUSTOM(광고주 정의)';
comment on column leads.custom_status_id is 'status=CUSTOM 일 때의 정의(lead_statuses). 정의가 지워지면 null 이 되고 화면에는 "사용자 상태"로 표시된다.';

-- ④ 리셋 (사용자 결정 2026-08-08: 전부 신규로)
update leads set status = 'NEW', status_changed_at = null;

create index idx_leads_custom_status on leads(custom_status_id);
