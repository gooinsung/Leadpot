/**
 * 목록용 짧은 일시 — "2026.09.26 18:51". 목록 칸이 두 줄로 꺾이지 않게 짧게 쓴다
 * (전체 일시는 칸의 title 툴팁으로 보여준다). 올해 것은 연도를 뺀다("09.26 18:51").
 */
export function fmtShortDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  const md = `${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.getFullYear() === new Date().getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}.${md} ${hm}`;
}
