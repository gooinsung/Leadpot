-- 범용 인바운드 웹훅 리드 수신 (docs/META-LEADS-PLAN.md).
-- 리드폼을 "이 화면으로 직접 제출(SELF)" 또는 "외부 웹훅으로 수신(WEBHOOK)" 으로 나눈다.
-- WEBHOOK 인 리드폼은 공개 렌더를 막고, 대신 토큰 기반 웹훅 URL 로 외부(Zapier·Make·LeadsBridge 등)의
-- 리드를 받는다. 토큰은 원문을 저장하지 않고 SHA-256 해시만 보관한다(InviteTokens 와 동일한 원칙).

ALTER TABLE forms
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'SELF',
    ADD COLUMN webhook_token_hash VARCHAR(64),
    ADD COLUMN webhook_config JSONB;

CREATE UNIQUE INDEX ux_forms_webhook_token_hash ON forms (webhook_token_hash) WHERE webhook_token_hash IS NOT NULL;

-- 웹훅으로 들어온 리드의 멱등성 키(외부 고유값 또는 페이로드 해시). 같은 (form_id, external_id) 는 한 번만 저장된다.
ALTER TABLE leads
    ADD COLUMN external_id VARCHAR(255);

CREATE UNIQUE INDEX ux_leads_form_external_id ON leads (form_id, external_id) WHERE external_id IS NOT NULL;
