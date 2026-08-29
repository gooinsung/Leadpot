-- 고객 여정 분석: 상호작용 이벤트에 스크롤 깊이·체류 시간 저장
-- scroll_depth: 스크롤 임계값(25/50/75/100) 통과 시 eventType="scroll" 로 기록되는 도달 퍼센트
-- duration_sec: 페이지 이탈 시 eventType="page_exit" 로 기록되는 체류 시간(초)
ALTER TABLE interaction_events
    ADD COLUMN scroll_depth INTEGER,
    ADD COLUMN duration_sec INTEGER;
