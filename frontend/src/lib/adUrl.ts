/**
 * 광고 URL 조립 — 랜딩 주소 뒤에 유입 파라미터를 붙인다.
 *
 * UI(`components/AdUrlBuilder.tsx`)에서 떼어 놓은 이유는 **테스트할 수 있게** 하려는 것이다.
 * 빈 값 처리·인코딩·기존 쿼리 이어붙이기가 조용히 틀리면 광고를 돌린 뒤에야 알게 된다.
 */

/**
 * 붙일 파라미터 키. 순서가 곧 URL 에 붙는 순서다.
 *
 * ⚠️ 이 목록은 세 곳이 일치해야 한다 — 여기 · `lib/utm.ts`(수집) ·
 * 백엔드 `TrackingParams.ALLOWED_KEYS`(저장 관문). 한 곳만 고치면
 * URL 에는 붙지만 저장되지 않거나, 반대로 저장 경로가 열려 있는데 아무도 안 보낸다.
 */
export const AD_PARAM_KEYS = ["media_from", "campaign_name", "ads_name"] as const;

export type AdParamKey = (typeof AD_PARAM_KEYS)[number];

/**
 * 값이 채워진 파라미터만 붙인 주소를 만든다.
 *
 * - 빈 값·공백만 있는 값은 붙이지 않는다 — 서버가 어차피 버리므로 주소만 길어진다.
 * - 값은 `URLSearchParams` 가 인코딩한다(한글 매체명·공백이 들어와도 깨지지 않게).
 * - 원본에 이미 쿼리가 있으면 `&` 로 이어 붙인다(리드폼 주소 등에 재사용할 때를 위해).
 * - 붙일 게 없으면 원본을 그대로 돌려준다.
 */
export function buildAdUrl(baseUrl: string, values: Partial<Record<AdParamKey, string>>): string {
  const params = new URLSearchParams();
  for (const key of AD_PARAM_KEYS) {
    const value = (values[key] ?? "").trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  if (!query) return baseUrl;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
}
