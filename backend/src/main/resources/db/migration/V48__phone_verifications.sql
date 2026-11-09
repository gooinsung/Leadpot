-- 리드폼 휴대폰 본인인증(문자 인증번호, 2026-11-09).
--
-- 리드폼에서 '휴대폰 본인인증 사용'(forms.require_phone_verification, V2 부터 자리만 있었음)을 켜면
-- 방문자는 첫 번째 연락처(tel) 항목으로 6자리 인증번호를 받아 입력해야 제출할 수 있다.
-- 인증에 성공하면 1회용 '통과 토큰'을 발급하고, 리드 접수 때 서버가 그 토큰을 직접 확인한다
-- (화면만 막으면 API 직접 호출로 뚫린다). 통과한 리드는 leads.phone_verified = true.
--
-- 사용자 결정(2026-11-09): 인증 문자를 보내지 못하면(대행사 장애·발송 상한 초과 등) 접수를 막지 않고
-- '미인증'으로 받는다 — 그 경우에도 행을 남기고 FALLBACK 토큰을 발급한다(sms_sent = false).
--
-- 개인정보 최소화: 인증번호·토큰·휴대폰 번호 모두 원문 대신 SHA-256 해시만 둔다.
-- 번호 원문은 리드 답변(leads.answers)에만 있다.

CREATE TABLE phone_verifications (
    id               bigserial PRIMARY KEY,
    form_id          bigint      NOT NULL REFERENCES forms (id) ON DELETE CASCADE,
    -- 정규화한 휴대폰 번호(숫자만)의 SHA-256 hex.
    phone_hash       varchar(64) NOT NULL,
    -- 인증번호의 SHA-256 hex. FALLBACK(문자 미발송) 행은 null.
    code_hash        varchar(64),
    -- 인증번호 유효시각. FALLBACK 행은 null.
    code_expires_at  timestamptz,
    -- 틀린 입력 횟수. 상한(코드 참조)을 넘으면 이 인증번호는 죽는다.
    attempts         int         NOT NULL DEFAULT 0,
    -- 실제로 문자가 나갔는가. 쿨다운·발송 상한은 이 값이 true 인 행만 센다.
    sms_sent         boolean     NOT NULL DEFAULT false,
    -- PENDING(인증번호 입력 대기) / VERIFIED(인증 통과) / FALLBACK(문자 못 보냄 → 미인증 접수 허용)
    status           varchar(16) NOT NULL,
    -- 접수 때 제출하는 1회용 통과 토큰의 SHA-256 hex. VERIFIED·FALLBACK 에서만 채워진다.
    token_hash       varchar(64),
    token_expires_at timestamptz,
    -- 토큰이 리드 접수에 쓰인 시각(1회용).
    used_at          timestamptz,
    -- 요청한 방문자 IP — IP 별 발송 상한(문자 폭탄·비용 공격 방어).
    requester_ip     varchar(64),
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- 최신 인증 조회 + 번호별 쿨다운·상한.
CREATE INDEX ix_phone_verifications_form_phone ON phone_verifications (form_id, phone_hash, created_at DESC);
-- IP 별 상한.
CREATE INDEX ix_phone_verifications_ip ON phone_verifications (requester_ip, created_at DESC);
-- 접수 시 토큰 조회.
CREATE UNIQUE INDEX ux_phone_verifications_token ON phone_verifications (token_hash) WHERE token_hash IS NOT NULL;
