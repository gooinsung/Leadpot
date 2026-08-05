-- 운영자(어드민) 변경 이력. 권한을 켜고 끄는 화면이라 흔적이 없으면 사고 시 추적이 안 된다.
--
-- 광고주 접속 감사(advertiser_access_logs)와 같은 원칙: 누가 · 누구를 · 무엇을 · 언제.
-- 이력은 삭제 API 를 만들지 않는다(감사 목적).

CREATE TABLE admin_audit_logs (
    id          bigserial PRIMARY KEY,
    -- 변경을 수행한 운영자 계정.
    admin_id    bigint      NOT NULL,
    -- 변경 대상 계정. 계정과 무관한 동작이면 null.
    target_id   bigint,
    -- 무엇을 했는지. 예: SMS_PERMISSIONS_UPDATE
    action      varchar(60) NOT NULL,
    -- 바뀐 내용을 사람이 읽을 수 있게. 개인정보(연락처·리드 내용)는 넣지 않는다.
    detail      varchar(1000),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 최신순 조회 + 특정 계정에 무슨 일이 있었는지 추적.
CREATE INDEX ix_admin_audit_created ON admin_audit_logs (created_at DESC);
CREATE INDEX ix_admin_audit_target ON admin_audit_logs (target_id, created_at DESC)
    WHERE target_id IS NOT NULL;
