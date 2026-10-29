/**
 * 목록 검색어 일치 — 대소문자·공백을 무시한다("개인 회생" 으로 '개인회생 DB' 가 걸리게).
 * 검색어가 비면 항상 일치.
 */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function matchesSearch(term: string, ...values: (string | null | undefined)[]): boolean {
  const q = normalizeSearch(term);
  if (!q) return true;
  return values.some((v) => v != null && normalizeSearch(v).includes(q));
}
