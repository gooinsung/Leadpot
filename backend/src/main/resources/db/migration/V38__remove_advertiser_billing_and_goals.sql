-- 광고주 선입금 과금(정산, V31) + 리드폼 수집 목표 기능 제거.
-- 사용자 결정: 정산 관리는 별도로 다시 만들 계획이라 기존 원장·과금 설정을 걷어낸다.
-- (수집 목표는 forms.settings_config JSONB 키였을 뿐 별도 테이블/컬럼이 없어 코드 제거만으로 끝난다.)

DROP TABLE IF EXISTS advertiser_ledger;

ALTER TABLE advertiser_form_grants
    DROP COLUMN IF EXISTS unit_price,
    DROP COLUMN IF EXISTS daily_goal,
    DROP COLUMN IF EXISTS total_goal,
    DROP COLUMN IF EXISTS balance_alert_enabled,
    DROP COLUMN IF EXISTS balance_alert_threshold,
    DROP COLUMN IF EXISTS balance_alert_phone,
    DROP COLUMN IF EXISTS balance_alert_sent_at,
    DROP COLUMN IF EXISTS goal_alert_date;
