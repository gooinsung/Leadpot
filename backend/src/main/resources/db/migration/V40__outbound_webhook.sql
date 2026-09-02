-- 아웃바운드 웹훅 — 우리 쪽에 리드가 접수되면 외부 URL 로 GET/POST 호출해 전달(인바운드 웹훅의 반대 방향).
-- 설정(켜짐 여부·URL·방식·파라미터 매핑)은 기존 구글시트 연동과 같은 패턴으로 forms.settings_config(JSONB) 에
-- outboundWebhook* 키로 넣는다(스키마 변경 불필요). 여기서는 "그 리드가 실제로 전송됐는지" 결과만 기록한다.
--
-- 리드 하나당 최신 시도 결과만 남긴다(이력 테이블이 아니다) — 재시도하면 이 값이 갱신된다.
-- status: SUCCESS(2xx 응답) | FAILED(그 외/예외). NULL = 아직 시도한 적 없음(연동이 꺼져 있었거나 미실행).

ALTER TABLE leads
    ADD COLUMN outbound_webhook_status VARCHAR(20),
    ADD COLUMN outbound_webhook_code INTEGER,
    ADD COLUMN outbound_webhook_response VARCHAR(1000),
    ADD COLUMN outbound_webhook_sent_at TIMESTAMP;
