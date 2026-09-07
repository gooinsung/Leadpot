/**
 * 현재 URL 쿼리스트링에서 유입 추적 파라미터를 추출한다.
 *
 * 두 종류를 함께 읽는다:
 *  - 표준 UTM `utm_source`·`utm_medium`·`utm_campaign`·`utm_term`·`utm_content`
 *    → 접두어를 떼고 `source`·`medium`·... 로 저장한다(기존 데이터와 같은 형태).
 *    GA4·메타·구글·네이버가 아는 표준 이름이라 같은 URL 로 외부 리포트와 대조할 수 있다.
 *  - 자체 광고 파라미터 `media_from`(매체)·`campaign_name`(캠페인)·`ads_name`(광고)
 *    → 이름 그대로 저장한다. 광고 URL 빌더(랜딩 목록)가 붙여주는 값이다.
 *
 * ⚠️ 자체 파라미터 이름은 **표준 UTM 저장 키와 겹치지 않게** 골랐다.
 * `?campaign=` 처럼 지으면 `utm_campaign` 과 같은 칸을 덮어써 하나가 사라진다.
 *
 * ⚠️ 여기서 고른 키만 서버가 저장한다 — 백엔드 `TrackingParams.ALLOWED_KEYS` 가 최종 관문이다.
 * 키를 늘릴 때는 **양쪽을 함께** 고쳐야 한다(제출은 공개 API 라 프론트만 믿을 수 없다).
 *
 * 호출처: 공개 폼 제출(PublicFormView) · 방문 기록(PublicFormPage·PublicSitePage·embed).
 * 리드와 방문에 같은 값이 남도록 **이 함수 하나만** 쓴다(예전엔 PublicFormView 에 복사본이 있었다).
 *
 * ⚠️ 방문·이벤트 기록은 브라우저에서만 일어난다(SSR 렌더러도 하이드레이션 후 클라이언트에서 호출) —
 * 그래서 인자를 생략하면 지금처럼 `window.location.search` 를 읽는다. `search` 를 명시하면
 * (예: SSR 쪽에서 요청 URL의 쿼리스트링을 넘길 때) `window` 없이도 순수 함수로 쓸 수 있다.
 */

/** 표준 UTM — `utm_` 접두어를 떼고 저장하는 키. */
const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;

/** 자체 광고 파라미터 — 이름 그대로 저장하는 키. */
const AD_KEYS = ["media_from", "campaign_name", "ads_name"] as const;

export function parseUtm(search?: string): Record<string, string> {
  const qs = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const p = new URLSearchParams(qs);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = p.get(`utm_${k}`);
    if (v) utm[k] = v;
  }
  for (const k of AD_KEYS) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}
