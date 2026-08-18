/**
 * 유입 파라미터(출처) 표시·필터 유틸 — 리드 목록의 '출처' 칩과
 * "파라미터 이름 선택 → 값 드롭다운" (faceted) 필터가 쓴다.
 *
 * ⚠️ '태그' 가 아니다. `leads.tags`(마케터가 손으로 붙이는 VIP 등)와 별개 축이므로
 * 화면 문구도 '유입/출처' 로 통일한다.
 *
 * 키 목록은 저장 화이트리스트(백엔드 `TrackingParams.ALLOWED_KEYS`)와 같은 축이다 —
 * 키를 늘리면 `lib/adUrl.ts`·`lib/utm.ts`·백엔드와 함께 여기 라벨도 추가한다.
 */

/** 필터 드롭다운·상세에 보이는 키 라벨. 순서 = 드롭다운 표시 순서(자체 3개 먼저). */
export const TRACKING_KEY_LABELS: Record<string, string> = {
  media_from: "광고 매체",
  campaign_name: "캠페인 이름",
  ads_name: "광고 이름",
  source: "소스(utm)",
  medium: "매체(utm)",
  campaign: "캠페인(utm)",
  term: "검색어(utm)",
  content: "콘텐츠(utm)",
};

export function trackingKeyLabel(key: string): string {
  return TRACKING_KEY_LABELS[key] ?? key;
}

/**
 * 목록 행의 '출처' 칩에 보여줄 값. 자체 파라미터(media_from)가 있으면 그것,
 * 없으면 표준 utm_source. 둘 다 없으면 null(칩을 그리지 않는다).
 */
export function leadSource(utm: Record<string, unknown> | null | undefined): string | null {
  if (!utm) return null;
  const v = utm.media_from ?? utm.source;
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** 리드의 유입 파라미터가 정확히 key=value 인지(드롭다운에서 고른 값 그대로, 부분검색 아님). */
export function matchesUtm(
  utm: Record<string, unknown> | null | undefined,
  key: string,
  value: string,
): boolean {
  if (!utm || utm[key] == null) return false;
  return String(utm[key]) === value;
}

export interface UtmFacetValue {
  value: string;
  count: number;
}
export interface UtmFacet {
  key: string;
  values: UtmFacetValue[];
}

/**
 * facet 키를 화면 표시 순서({@link TRACKING_KEY_LABELS} — 자체 3개 먼저)로 정렬한다.
 * 서버(`/api/leads/utm-facets`)는 저장 화이트리스트 순서(표준 UTM 먼저)로 주므로
 * 인박스도 폼별 목록과 같은 순서가 되도록 이걸 거친다. 모르는 키는 뒤로.
 */
export function sortUtmFacets(facets: UtmFacet[]): UtmFacet[] {
  const order = Object.keys(TRACKING_KEY_LABELS);
  return [...facets].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
}

/**
 * 리드 배열에서 유입 파라미터 facet 을 만든다(폼별 목록처럼 전체 리드를 이미 들고 있는 화면용 —
 * 인박스는 서버 `GET /api/leads/utm-facets` 가 같은 모양을 준다).
 *
 * ⚠️ 필터가 걸리기 **전** 배열로 만들어야 한다 — 필터된 결과로 만들면 값을 하나 고르는 순간
 * 다른 값들이 드롭다운에서 사라져 갈아탈 수 없다.
 *
 * 키 순서는 {@link TRACKING_KEY_LABELS}, 값은 많이 나온 순. 등장한 키만 담는다.
 */
export function buildUtmFacets(
  leads: ReadonlyArray<{ utm?: Record<string, unknown> | null }>,
): UtmFacet[] {
  const agg = new Map<string, Map<string, number>>();
  for (const key of Object.keys(TRACKING_KEY_LABELS)) agg.set(key, new Map());
  for (const l of leads) {
    if (!l.utm) continue;
    for (const key of Object.keys(TRACKING_KEY_LABELS)) {
      const raw = l.utm[key];
      const v = raw == null ? "" : String(raw).trim();
      if (v === "") continue;
      const m = agg.get(key)!;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  const out: UtmFacet[] = [];
  for (const [key, m] of agg) {
    if (m.size === 0) continue;
    const values = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
    out.push({ key, values });
  }
  return out;
}
