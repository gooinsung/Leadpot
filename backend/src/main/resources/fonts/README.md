# 견적서 PDF 폰트

- `NanumGothic-Regular.ttf`, `NanumGothic-Bold.ttf` — 나눔고딕(© NAVER Corp.), **SIL Open Font License 1.1**
  (https://openfontlicense.org). 원본은 npm `@kfonts/nanum-gothic@0.2.0` 의 TTF.
- 용량을 줄이려고 **한자를 뺀 부분집합**으로 만들었다(fontTools subset): 기본 라틴·라틴-1, 일반 구두점, 원화 기호,
  화살표·도형·원문자, CJK 기호, 한글 자모·호환 자모, **한글 음절 전체(가~힣)**, 전각 문자.
  견적서에 한자가 들어가면 그 글자는 빠진다 — 필요해지면 원본 TTF 로 다시 부분집합을 만든다.
- 서버(QuotePdfRenderer)가 PDF 에 임베드한다. OFL 에 따라 폰트 자체를 단독 판매하지 않는다.
