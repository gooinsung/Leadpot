/** 현재 URL 쿼리스트링에서 utm_* 파라미터를 추출한다(source/medium/campaign/term/content). */
export function parseUtm(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) {
    const v = p.get(`utm_${k}`);
    if (v) utm[k] = v;
  }
  return utm;
}
