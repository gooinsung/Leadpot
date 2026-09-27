-- 리드당 가치(원) 도장. 리드폼 설정(settings_config.leadValue)의 단가를 접수 순간 복사해 새긴다.
-- 단가를 나중에 바꿔도 이미 들어온 리드의 수익은 안 바뀐다(2026-09-27 사용자 확정).
-- null = 이 기능 도입 전 리드 → 통계에서는 리드폼의 현재 단가로 계산한다.
alter table leads add column lead_value bigint;
