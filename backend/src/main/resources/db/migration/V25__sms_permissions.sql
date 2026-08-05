-- 문자 발송을 권한 있는 계정만 쓰게 막는다 (2026-08-05 사용자 지시).
--
-- 왜: 문자는 리드팟 솔라피 계정 하나로 나가고 비용을 우리가 부담한다(docs/MESSAGING-PLAN.md §11).
-- 지금은 모든 마케터가 리드폼에서 자유롭게 켤 수 있어 돈이 샌다. 당분간 운영자 계정만 쓰게 하고
-- 나중에 요금제와 함께 열어준다.
--
-- 전부 기본 off 다. 새 계정은 아무것도 못 보낸다.

ALTER TABLE users ADD COLUMN sms_enabled boolean NOT NULL DEFAULT false;

-- 허용 채널 CSV. 'SMS,LMS,MMS' 처럼 넣는다. 빈 문자열이면 아무 채널도 못 보낸다.
-- 채널별로 나누는 이유는 단가가 크게 갈리기 때문(SMS 18 / LMS 45 / MMS 110원 · 2026-08-04 공개 페이지 기준).
-- CSV 한 칸으로 둔 이유: 나중에 'ALIMTALK' 을 같은 자리에 추가할 수 있다(컬럼이 늘지 않는다).
ALTER TABLE users ADD COLUMN sms_allowed_channels varchar(40) NOT NULL DEFAULT '';

-- 계정별 월 발송 상한. ⚠️ 0 의 의미가 예전 플랜 상수와 반대다 —
--   0  = 발송 금지 (기본값)
--   >0 = 그 건수까지
--   -1 = 무제한
-- 예전 SmsService.quotaError 는 'limit <= 0' 을 무제한으로 해석했다. 두 규약이 섞이면
-- 권한 없는 계정이 무제한이 되므로, 플랜 기반 한도(app.sms.monthly-limit.*)는 제거하고
-- 이 컬럼을 유일한 기준으로 삼는다.
ALTER TABLE users ADD COLUMN sms_monthly_limit integer NOT NULL DEFAULT 0;

-- 운영자 계정 개방은 마이그레이션에 넣지 않는다 — 이메일이 git 에 영구 기록되기 때문.
-- 대신 기동 시 APP_ADMIN_BOOTSTRAP_EMAIL 환경변수로 승격한다(AdminBootstrap).
