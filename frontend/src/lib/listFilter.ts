// 리드폼·랜딩 목록의 검색·정렬(2026-10-29, 사용자 지시).
// 목록은 이미 전부 받아와 있으므로(페이징도 프론트) 서버 왕복 없이 여기서 거른다.

/** 검색어 비교용 — 대소문자·공백을 무시한다("모두 이사" 로도 "모두이사" 가 걸리게). */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 검색어가 비었거나, 대상 문자열 중 하나라도 검색어를 포함하면 true. */
export function matchesQuery(query: string, fields: (string | number | null | undefined)[]): boolean {
  const q = norm(query);
  if (!q) return true;
  return fields.some((f) => f != null && norm(String(f)).includes(q));
}

/** 태그 묶음 검색 방식 — and: 고른 태그를 모두 가진 것 · or: 하나라도 가진 것. */
export type TagMode = "and" | "or";

/** 고른 태그가 없으면 true. */
export function matchesTags(itemTags: string[] | null | undefined, selected: string[], mode: TagMode): boolean {
  if (selected.length === 0) return true;
  const have = new Set(itemTags ?? []);
  return mode === "or" ? selected.some((t) => have.has(t)) : selected.every((t) => have.has(t));
}

export type ListSort = "updated" | "oldest" | "created" | "name" | "revenue";

export const LIST_SORT_LABEL: Record<ListSort, string> = {
  updated: "최근 수정순",
  oldest: "오래된 수정순",
  created: "최근 만든순",
  name: "이름순(가나다)",
  revenue: "수익 높은순",
};

export function parseSort(v: string | null): ListSort {
  return v && v in LIST_SORT_LABEL ? (v as ListSort) : "updated";
}

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/**
 * 정렬한 새 배열을 돌려준다(원본은 그대로). 같은 값이면 최근 수정순으로 묶는다.
 * - created: id 가 클수록 나중에 만든 것(목록 요약에 생성일이 없어 id 로 대신한다).
 * - revenue: 목록의 수익 칸과 같은 기간 값. 수익이 없으면 0 으로 본다.
 */
export function sortList<T extends { id: number; updatedAt: string }>(
  items: T[],
  sort: ListSort,
  get: { name: (x: T) => string; revenue: (x: T) => number },
): T[] {
  const byUpdated = (a: T, b: T) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  const cmp: Record<ListSort, (a: T, b: T) => number> = {
    updated: byUpdated,
    oldest: (a, b) => -byUpdated(a, b),
    created: (a, b) => b.id - a.id,
    name: (a, b) => collator.compare(get.name(a), get.name(b)) || byUpdated(a, b),
    revenue: (a, b) => get.revenue(b) - get.revenue(a) || byUpdated(a, b),
  };
  return [...items].sort(cmp[sort]);
}
