-- 마케터가 자기 문자 대행사 계정을 연동하는 경로를 걷어낸다(2026-08-02 사용자 결정).
--
-- V23 에서 컬럼만 만들어 뒀는데 저장할 API·화면을 만들지 않아 실제로는 한 번도 쓰이지 않았다.
-- 지금은 **리드팟 계정 하나로만** 발송한다. 쓰지 않는 자격증명 컬럼을 남겨두면
-- "여기에 키를 넣으면 되나?" 하는 오해를 부르고, 비어 있는 시크릿 컬럼은 그 자체로 관리 대상이 된다.
--
-- 나중에 마케터별 키가 필요해지면 이 컬럼들을 다시 추가하면 된다.
-- 코드 쪽 자리는 SmsService.resolveCredentials 주석 참고.
ALTER TABLE integration_settings DROP COLUMN IF EXISTS sms_enabled;
ALTER TABLE integration_settings DROP COLUMN IF EXISTS sms_api_key;
ALTER TABLE integration_settings DROP COLUMN IF EXISTS sms_api_secret;
ALTER TABLE integration_settings DROP COLUMN IF EXISTS sms_sender_phone;

-- message_logs.system_credential 은 남긴다 — 이미 쌓인 이력의 사실이고,
-- 나중에 마케터 키를 붙이면 그때 다시 의미를 갖는다.
