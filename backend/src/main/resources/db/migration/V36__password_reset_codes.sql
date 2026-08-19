-- 마케터 비밀번호 재설정 인증번호 (2026-08-19).
--
-- 이메일 발송 인프라가 없으므로 가입 때 받은 휴대폰(users.phone)으로 6자리 인증번호를
-- 문자로 보낸다. 광고주 재설정(advertiser_password_resets, 마케터가 링크 발급)과 달리
-- 이쪽은 로그인 화면에서 본인이 직접 요청하는 셀프서비스다.
--
-- 원문 인증번호는 저장하지 않고 SHA-256 해시만 둔다(초대 토큰과 같은 원칙).
-- attempts 는 온라인 무차별 대입 방어 — 6자리 숫자는 시도 제한이 없으면 뚫린다.

CREATE TABLE password_reset_codes (
    id          bigserial PRIMARY KEY,
    user_id     bigint      NOT NULL REFERENCES users (id),
    -- 인증번호의 SHA-256 hex(64자). 원문은 문자로만 전달되고 어디에도 남지 않는다.
    code_hash   varchar(64) NOT NULL,
    expires_at  timestamptz NOT NULL,
    -- 틀린 입력 횟수. 상한(코드 참조)을 넘으면 이 코드는 죽는다.
    attempts    int         NOT NULL DEFAULT 0,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 계정별 최신 코드 조회 + 재요청 쿨다운 검사.
CREATE INDEX ix_password_reset_codes_user ON password_reset_codes (user_id, created_at DESC);
