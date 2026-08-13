-- 광고주 접수 알림 수신번호를 "계정 기본값 + 리드폼별 덮어쓰기" 구조로 바꾼다.
--
-- 왜: V28 에서 수신번호를 리드폼별(advertiser_form_grants.notify_phone)로만 뒀다. 동의 근거는
-- 확실해졌지만, 광고주가 **리드폼이 새로 배정될 때마다 다시 등록**해야 해서 실제로 알림이 자주 끊겼다.
-- (2026-08-13 확인: 폼 24 는 등록됐고 새로 만든 폼 33 은 미등록 → 그 폼만 광고주 알림이 안 나갔다.)
--
-- 바꾼 것: 광고주가 계정에 기본 번호를 한 번 등록하면 배정된 모든 리드폼에 적용된다.
-- 특정 폼만 다른 번호로 받고 싶으면 그 폼에만 번호를 넣어 덮어쓴다.
--
-- ⚠️ 수신 동의 근거는 그대로다 — 계정 기본 번호도 **광고주 본인이 포털에서 직접 등록**한다.
-- 마케터는 여전히 남의 번호를 넣을 수 없다(V28 원칙 유지, MESSAGING-PLAN §9).
-- 유일한 예외는 잔액 알림(balance_alert_phone)이고 그건 결제자가 달라서다(2026-08-08).

ALTER TABLE users
    ADD COLUMN notify_phone    varchar(20),
    ADD COLUMN notify_phone_at timestamptz;

COMMENT ON COLUMN users.notify_phone IS
    '광고주가 포털에서 직접 등록한 접수 알림 수신번호(숫자만) — 배정된 모든 리드폼의 기본값. 광고주 계정에만 쓴다.';
COMMENT ON COLUMN users.notify_phone_at IS
    '계정 기본 수신번호를 등록·변경한 시각. 수신 동의 시점의 근거로 보관한다.';

-- 리드폼별 "이 폼은 받지 않음"을 명시적으로 표현한다.
--
-- 계정 기본값이 생기면서 "번호를 비우면 중단"이 더 이상 성립하지 않는다 — 비우면 기본값으로 나간다.
-- 그래서 '미설정(=기본값 사용)' 과 '이 폼은 끔' 을 구분하는 컬럼이 필요하다.
ALTER TABLE advertiser_form_grants
    ADD COLUMN notify_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN advertiser_form_grants.notify_disabled IS
    'true 면 이 리드폼의 광고주 알림을 보내지 않는다(계정 기본 번호가 있어도). 광고주 본인만 바꿀 수 있다.';
COMMENT ON COLUMN advertiser_form_grants.notify_phone IS
    '이 리드폼에만 적용할 수신번호(숫자만). 비어 있으면 광고주 계정 기본값(users.notify_phone)을 쓴다.';

-- 이미 폼별로 등록해 둔 번호를 계정 기본값으로 올려준다.
--
-- 왜 필요한가: 이 마이그레이션 없이 배포하면 기존 등록자는 그대로 동작하지만(폼별 값이 우선),
-- 새 폼에는 여전히 기본값이 없어 끊긴다. 광고주가 이미 "내 번호는 이것"이라고 등록한 행위가 있으므로
-- 그 값을 계정 기본값으로 승격하는 것은 동의 범위 안이다.
-- 여러 폼에 서로 다른 번호를 넣어둔 경우는 가장 최근에 등록한 것을 기본값으로 본다.
UPDATE users u
SET notify_phone    = g.notify_phone,
    notify_phone_at = g.notify_phone_at
FROM (
    SELECT DISTINCT ON (advertiser_id) advertiser_id, notify_phone, notify_phone_at
    FROM advertiser_form_grants
    WHERE notify_phone IS NOT NULL
    ORDER BY advertiser_id, notify_phone_at DESC NULLS LAST
) g
WHERE u.id = g.advertiser_id
  AND u.notify_phone IS NULL;
