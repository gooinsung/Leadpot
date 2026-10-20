/**
 * 주소 검색 결과의 조각(우편번호·도로명·지번 등) — 리드 답변에 `addressParts` 로 함께 남긴다.
 *
 * 저장 값은 `(우편번호) 도로명 (법정동, 아파트명)` 한 문자열이라, 외부 API 전달(아웃바운드)에서
 * `{우편번호} {지번}` 처럼 사용자가 직접 조합하려면 검색한 시점의 원본 조각이 필요하다(사용자 지시 2026-10-20).
 * 폼 값은 항목당 문자열 하나라서, 주소 검색이 끝날 때 저장 문자열 → 조각을 여기 기억해 두고
 * 접수할 때 같은 문자열로 꺼낸다(같은 주소를 고르면 같은 문자열이 나오므로 키로 충분하다).
 */
export interface AddressParts {
  /** 우편번호(5자리) */
  zonecode: string;
  /** 도로명 주소(괄호 덧붙임 없이) */
  road: string;
  /** 지번 주소 */
  jibun: string;
  /** 건물명(아파트명 등) — 없으면 빈 값 */
  building: string;
  /** 법정동·법정리 */
  bname: string;
  /** 상세주소(동·호수) — '주소 + 상세주소' 항목만 */
  detail: string;
}

const remembered = new Map<string, Omit<AddressParts, "detail">>();

/** 주소 검색이 끝났을 때 — 저장 문자열과 조각을 짝지어 둔다. */
export function rememberAddressParts(saved: string, parts: Omit<AddressParts, "detail">): void {
  remembered.set(saved, parts);
}

/** 접수할 때 — 저장 문자열로 조각을 꺼낸다. 검색 없이 들어온 값(기본값 등)은 null. */
export function lookupAddressParts(saved: string, detail = ""): AddressParts | null {
  const p = remembered.get(saved.trim());
  return p ? { ...p, detail: detail.trim() } : null;
}

/** 외부 API 전달 '직접 조합' 에서 쓸 수 있는 자리표시자 — 백엔드 OutboundWebhookService 와 같은 목록. */
export const ADDRESS_TOKENS: readonly { token: string; label: string }[] = [
  { token: "{우편번호}", label: "우편번호" },
  { token: "{도로명}", label: "도로명 주소" },
  { token: "{지번}", label: "지번 주소" },
  { token: "{상세주소}", label: "상세주소(동·호수)" },
  { token: "{건물명}", label: "건물명(아파트명)" },
  { token: "{법정동}", label: "법정동" },
];
