-- 광고주 선입금 과금(V31) — DB 단가 · 충전 잔액 · 목표 수량 · 알림 설정.
--
-- 계약 모델(2026-08-08 사용자): 광고주가 광고비를 선입금하고, 리드가 '유효'로 확정될 때마다
-- 단가만큼 차감한다. AS 인정(무효)되면 환급. 잔액이 임계값 미만이면 결제 담당자에게 문자,
-- 하루 목표 수량이 차면 마케터에게 문자. 잔액이 소진돼도 수집은 계속한다(마이너스 허용, 후정산).
--
-- 설정은 계약 단위인 advertiser_form_grants(리드폼:광고주 = 1:1)에 둔다.
alter table advertiser_form_grants
    add column unit_price              integer     not null default 0, -- 유효 DB 1건당 단가(원). 0 = 과금 안 함
    add column daily_goal              integer     not null default 0, -- 일 목표 수량. 0 = 목표 없음
    add column total_goal              integer     not null default 0, -- 총 목표 수량(계약 물량). 0 = 목표 없음
    add column balance_alert_enabled   boolean     not null default false,
    add column balance_alert_threshold integer     not null default 0, -- 이 금액(원) 미만이면 알림
    -- 잔액 알림 수신번호. 마케터가 직접 지정한다 — V28 원칙의 예외다(2026-08-08 사용자 확정):
    -- 알림톡을 받는 광고주 번호와 "결제하는 사람" 번호가 다를 수 있어서다.
    -- 비어 있으면 광고주가 등록한 notify_phone 으로, 그것도 없으면 보내지 않는다.
    add column balance_alert_phone     varchar(20),
    add column balance_alert_sent_at   timestamptz,                    -- 반복 발송 억제(충전으로 임계 위로 올라오면 초기화)
    add column goal_alert_date         date;                           -- 일 목표 알림을 이미 보낸 날(KST, 하루 1회)

-- 충전/차감 원장 — 잔액은 이 테이블의 amount 합계다. 별도 잔액 컬럼을 두지 않아 어긋날 수 없다.
-- grant 가 지워져도(권한 회수·광고주 삭제) 돈 기록은 남아야 하므로 form/advertiser 를 함께 박아둔다.
create table advertiser_ledger (
    id            bigserial primary key,
    grant_id      bigint      references advertiser_form_grants(id) on delete set null,
    form_id       bigint      not null,
    advertiser_id bigint      not null,
    entry_type    varchar(10) not null, -- CHARGE(충전,+) | DEBIT(유효 차감,-) | REFUND(AS 환급,+) | ADJUST(수동 조정,±)
    amount        integer     not null, -- 부호 있는 금액(원). 잔액 = sum(amount)
    lead_id       bigint,               -- DEBIT/REFUND 의 근거 리드
    memo          varchar(200),
    created_by    bigint,               -- 기록 주체(충전·조정은 마케터, 차감·환급은 시스템=상태 변경 주체)
    created_at    timestamptz not null default now()
);

create index idx_ledger_grant on advertiser_ledger(grant_id);
create index idx_ledger_form on advertiser_ledger(form_id);
create index idx_ledger_lead on advertiser_ledger(lead_id);

comment on table advertiser_ledger is
    '광고주 선입금 원장. 유효 확정 시 DEBIT, AS 인정 시 REFUND. 잔액 = amount 합계(V31).';
