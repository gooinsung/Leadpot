-- 랜딩별 "구글 광고용" 옵션(V41) — docs/SSR-LANDING-PLAN.md Phase 4.
--
-- 공개 랜딩을 전면 SSR(Next.js 렌더러)로 옮기면서, HTML 블록의 <script> 는 여전히 그대로 실행되게
-- 뒀다(메타·당근·카카오 광고용 랜딩은 카운트다운·플로팅배너 스크립트를 계속 써야 하기 때문).
-- 하지만 구글 광고 최종 URL 로 쓰는 랜딩은 임의 스크립트 실행 자체가 "손상된 사이트" 반려 사유였다.
-- 그래서 랜딩별로 켤 수 있는 옵션 하나를 둔다: 켜면 렌더러가 HTML 블록에서 <script>·<iframe>·
-- 인라인 이벤트 핸들러를 제거하고 내려준다(sanitizeHtml.ts, 이미 Phase 2 에서 만들어둠).
alter table landing_pages
    add column google_ads_safe boolean not null default false;

comment on column landing_pages.google_ads_safe is
    '켜면 공개 렌더 시 HTML 블록의 <script>·<iframe>·인라인 이벤트 핸들러를 제거한다(V41, 구글 광고용).';
