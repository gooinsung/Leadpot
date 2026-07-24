-- I1: 광고 픽셀(추적) 설정 — 리드폼/랜딩별로 여러 플랫폼 픽셀 ID 저장.
-- 예: {"google":"G-XXXX","meta":"123...","tiktok":"...","kakao":"...","daangn":"..."}
alter table forms add column tracking_config jsonb;
alter table landing_pages add column tracking jsonb;
