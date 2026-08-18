-- 리드폼 '분야'(업종 구분: 개인회생·장기렌트·임플란트 등) — 마케터가 폼별로 지정.
-- 리드 목록/인박스에서 분야로 걸러 "오늘 개인회생 광고 전반"을 본다.
-- ⚠️ 손태그(leads.tags, V16)와 별개 축이다. 분야 목록은 별도 테이블 없이
--    forms.category 의 distinct 값으로 만든다(등록 화면·관리 없이 굴러가게).
ALTER TABLE forms ADD COLUMN category VARCHAR(50);
