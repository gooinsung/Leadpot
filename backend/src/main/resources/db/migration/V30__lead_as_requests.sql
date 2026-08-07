-- AS 요청(V30) — 광고주가 리드에 이의를 제기하는 절차. 상태 축의 AS_REQUESTED 와 짝이다.
--
-- 흐름: 광고주가 사유(필수)·증빙 이미지와 함께 요청 → 리드 상태 AS_REQUESTED + 마케터 알림
--       → 마케터가 인정(리드 무효, 과금 환급) 또는 거부(리드 유효).
--
-- 리드 삭제 시 함께 지운다(cascade) — 요청은 리드에 종속된 이의제기 기록이다.
-- 광고주 계정 삭제 시에는 남긴다(set null) — 분쟁·정산 근거는 계정과 무관하게 보존한다(V27 과 같은 원칙).
create table lead_as_requests (
    id              bigserial primary key,
    lead_id         bigint      not null references leads(id) on delete cascade,
    advertiser_id   bigint      references users(id) on delete set null,
    reason          text        not null,
    evidence_urls   jsonb,                                -- 업로드된 증빙 이미지 URL 배열(v1 이미지 전용)
    status          varchar(20) not null default 'OPEN',  -- OPEN | ACCEPTED(인정→무효) | REJECTED(거부→유효)
    resolved_by     bigint,                               -- 처리한 마케터 user id
    resolution_note varchar(500),                         -- 처리 코멘트(선택)
    created_at      timestamptz not null default now(),
    resolved_at     timestamptz
);

create index idx_as_requests_lead on lead_as_requests(lead_id);

comment on table lead_as_requests is
    '광고주의 리드 AS(이의) 요청. 인정되면 리드가 무효(과금 환급), 거부되면 유효로 확정된다(V30).';
