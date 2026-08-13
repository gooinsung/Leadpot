/** 계산기 결과 표시용 숫자 포맷. 계산기가 늘어나도 같은 표기를 쓰도록 여기 모아둔다. */

/**
 * 원 단위 금액을 한국식으로 축약한다. 결과 화면의 큰 숫자에 쓴다.
 * 예) 96,000,000 → "9,600만원" · 123,000,000 → "1억 2,300만원" · 8,500 → "8,500원"
 */
export function formatKrw(won: number): string {
  const n = Math.round(won);
  if (!Number.isFinite(n) || n === 0) return "0원";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  if (eok > 0) return `${sign}${eok}억${man > 0 ? ` ${man.toLocaleString("ko-KR")}만` : ""}원`;
  if (man > 0) return `${sign}${man.toLocaleString("ko-KR")}만원`;
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

/** 정확한 원 단위 표기(산출 근거 표에 쓴다). 예) 1,538,543원 */
export function formatWon(won: number): string {
  return `${Math.round(won).toLocaleString("ko-KR")}원`;
}

/** 만원 단위로 입력받은 문자열 → 원. 빈값·잘못된 값은 0. */
export function manwonToWon(raw: string | undefined): number {
  const n = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10_000) : 0;
}

/** 선택지 값 등 정수 문자열 → 숫자. 빈값·잘못된 값은 0. */
export function toInt(raw: string | undefined): number {
  const n = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
