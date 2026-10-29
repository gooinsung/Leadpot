import type { QuoteItem, QuoteParty, QuoteStatus, VatMode } from "../api/client";

/**
 * 견적 합계 — 백엔드 {@code QuoteCalculator} 와 **같은 식**이다(미리보기용. 저장 값은 서버가 다시 계산한다).
 * 한쪽만 고치면 화면 미리보기와 PDF 금액이 어긋나므로 함께 고친다.
 */
export function lineAmount(it: Pick<QuoteItem, "quantity" | "unitPrice">): number {
  return (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
}

export function quoteTotals(items: QuoteItem[], mode: VatMode): { supply: number; vat: number; grand: number } {
  const sum = items.reduce((acc, it) => acc + lineAmount(it), 0);
  if (mode === "INCLUDED") {
    // Java Math.round(sum / 1.1) 와 같게 — 반올림(.5 는 올림)
    const supply = Math.floor(sum / 1.1 + 0.5);
    return { supply, vat: sum - supply, grand: sum };
  }
  if (mode === "EXEMPT") return { supply: sum, vat: 0, grand: sum };
  const vat = Math.floor(sum / 10);
  return { supply: sum, vat, grand: sum + vat };
}

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const BIG = ["", "만", "억", "조", "경"];

/** 금액을 한글로(예: 2,750,000 → "이백칠십오만"). 백엔드 KoreanAmount 와 같다. */
export function toHangulAmount(amount: number): string {
  if (amount === 0) return "영";
  if (amount < 0) return `마이너스 ${toHangulAmount(-amount)}`;
  let n = Math.floor(amount);
  let out = "";
  let big = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let s = "";
      for (let pos = 3; pos >= 0; pos--) {
        const d = Math.floor(chunk / 10 ** pos) % 10;
        if (d === 0) continue;
        if (!(d === 1 && pos > 0)) s += DIGITS[d];
        s += SMALL[pos];
      }
      out = s + BIG[big] + out;
    }
    n = Math.floor(n / 10000);
    big++;
  }
  return out;
}

export function won(n: number): string {
  return (Number(n) || 0).toLocaleString("ko-KR");
}

export const VAT_MODE_LABEL: Record<VatMode, string> = {
  EXCLUDED: "부가세 별도 (공급가 + 10%)",
  INCLUDED: "부가세 포함 (단가에 포함)",
  EXEMPT: "면세",
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "작성중",
  ISSUED: "발행",
  ACCEPTED: "수락",
  REJECTED: "거절",
};

/** 상태 뱃지 색(기존 badge 클래스 재사용). */
export const QUOTE_STATUS_BADGE: Record<QuoteStatus, string> = {
  DRAFT: "",
  ISSUED: "b-wait",
  ACCEPTED: "b-normal",
  REJECTED: "b-bad",
};

export const EMPTY_PARTY: QuoteParty = {
  companyName: "",
  ceoName: "",
  bizNo: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  bankAccount: "",
};

export function emptyItem(): QuoteItem {
  return { name: "", description: "", quantity: 1, unitPrice: 0, note: "" };
}

/** 오늘(로컬) YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function quotePdfFilename(quoteNo: string, recipientName: string): string {
  return `견적서_${quoteNo}_${recipientName}.pdf`.replace(/[\\/:*?"<>|]/g, "_");
}
