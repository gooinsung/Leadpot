-- 광고주 접수 알림 수신번호를 광고주 본인이 직접 등록하게 한다.
--
-- 왜: 지금까지는 마케터가 forms.settings_config.smsAdvertiserPhone 에 광고주 번호를 대신 넣었다.
-- 광고주 본인은 등록한 적도 동의한 적도 없고 끌 수도 없었다. 발신 채널이 리드팟 명의 하나라
-- 광고주가 스팸 신고를 하면 전 고객 알림이 함께 막힌다(docs/MESSAGING-PLAN.md §9).
-- 광고주가 자기 번호를 직접 넣으면 그 행위 자체가 수신 동의 근거가 된다.
--
-- 채널 중립 이름을 쓴다(sms~ 아님) — 문자는 고객 전용으로 좁히고 마케터·광고주 알림은
-- 카카오 알림톡으로 옮길 예정이라, 그때 컬럼을 그대로 재사용한다.
ALTER TABLE advertiser_form_grants
    ADD COLUMN notify_phone    varchar(20),
    ADD COLUMN notify_phone_at timestamptz;

COMMENT ON COLUMN advertiser_form_grants.notify_phone IS
    '광고주가 포털에서 직접 등록한 접수 알림 수신번호(숫자만). 비어 있으면 발송하지 않는다.';
COMMENT ON COLUMN advertiser_form_grants.notify_phone_at IS
    '번호를 등록·변경한 시각. 수신 동의 시점의 근거로 보관한다.';

-- ⚠️ forms.settings_config.smsAdvertiserPhone 은 일부러 지우지 않는다.
-- 이 마이그레이션 이후 코드가 읽지 않으므로 발송에는 쓰이지 않는다(= 광고주가 새로 등록할 때까지 중단).
-- 되돌릴 여지를 남기려고 값만 남겨둔다. 정리 여부는 운영 안정화 후 별도 판단.
