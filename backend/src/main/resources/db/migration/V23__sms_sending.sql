-- 문자(SMS/LMS) 발송 기반.
--
-- 발송 계정 구조(docs/MESSAGING-PLAN.md §11): 기본은 **리드팟 솔라피 계정**(API 키는 환경변수)으로 보내고,
-- 마케터가 자기 키를 등록하면 그 키로 보낸다. 그래서 아래 컬럼은 "마케터 자기 키(선택)" 저장용이다.

ALTER TABLE integration_settings ADD COLUMN sms_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE integration_settings ADD COLUMN sms_api_key varchar(200);
ALTER TABLE integration_settings ADD COLUMN sms_api_secret varchar(200);
-- 발신번호는 발송 계정에 사전등록된 번호여야 한다(전기통신사업법). 하이픈 없이 숫자만 저장한다.
ALTER TABLE integration_settings ADD COLUMN sms_sender_phone varchar(20);

-- 발송 이력. 월 사용량(플랜 한도)도 이 표의 그 달 SENT 건수로 집계한다 —
-- 별도 카운터를 두면 실제 발송과 어긋난다.
CREATE TABLE message_logs (
    id              bigserial PRIMARY KEY,
    -- 발송 비용을 부담하는 주체(= 리드폼 소유 마케터). 사용량 집계 기준.
    owner_id        bigint      NOT NULL,
    form_id         bigint,
    lead_id         bigint,
    -- 규칙 없이 나간 발송(연동 테스트·수동)은 null.
    rule_id         bigint,
    template_id     bigint,
    channel         varchar(20) NOT NULL,               -- SMS | LMS | EMAIL | ALIMTALK
    -- 수신자 구분: MARKETER | ADVERTISER | LEAD | TEST
    recipient_type  varchar(20) NOT NULL,
    -- 수신 번호는 마스킹해 저장한다(원본을 이력에 쌓아둘 이유가 없다).
    recipient       varchar(40),
    rendered_body   text,
    status          varchar(20) NOT NULL,               -- SENT | FAILED | SKIPPED
    error           varchar(500),
    provider_message_id varchar(100),
    -- 리드팟 키로 보냈는지(= 우리 비용, 플랜 한도 대상). 마케터 자기 키면 false.
    system_credential boolean   NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 월 사용량 집계(owner + 기간 + 상태)와 이력 화면(최신순)에 쓰는 인덱스.
CREATE INDEX ix_message_logs_owner_created ON message_logs (owner_id, created_at DESC);
-- 규칙별 리드당 1회 원칙 검사용(§2 중복 발송).
CREATE INDEX ix_message_logs_rule_lead ON message_logs (rule_id, lead_id) WHERE rule_id IS NOT NULL;
