/**
 * '접수 페이스'(대시보드) 비교 규칙 — 전체 카드(LeadPaceCard)와 리드폼별 표(FormPaceCard)가 같이 쓴다.
 */

export type Tone = "up" | "down" | "flat";

// "대강" 보는 용도라 ±15% 미만이거나 차이가 1건 미만이면 "비슷"으로 본다(작은 숫자의 1건 차이로 요란하지 않게).
export function compare(today: number, base: number): { tone: Tone; diff: number; pct: number | null } {
  const diff = Math.round((today - base) * 10) / 10;
  const pct = base > 0 ? Math.round((diff / base) * 100) : null;
  const flat = Math.abs(diff) < 1 || (pct != null && Math.abs(pct) < 15);
  return { tone: flat ? "flat" : diff > 0 ? "up" : "down", diff, pct };
}

export const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toFixed(1));
