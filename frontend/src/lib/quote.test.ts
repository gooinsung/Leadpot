import { describe, expect, it } from "vitest";
import { quoteTotals, toHangulAmount } from "./quote";

/** 백엔드 QuoteCalculatorTest·KoreanAmountTest 와 같은 값 — 미리보기와 PDF 금액이 어긋나면 안 된다. */
describe("견적 합계", () => {
  const items = [
    { name: "개인회생 DB", description: "", quantity: 50, unitPrice: 50_000, note: "" },
    { name: "할인", description: "", quantity: 1, unitPrice: -100_005, note: "" },
  ];

  it("부가세 별도 — 10%, 원 미만 절사", () => {
    expect(quoteTotals(items, "EXCLUDED")).toEqual({ supply: 2_399_995, vat: 239_999, grand: 2_639_994 });
  });

  it("부가세 포함 — 1.1 로 나눠 가른다", () => {
    expect(quoteTotals([{ ...items[0], quantity: 1, unitPrice: 2_750_000 }], "INCLUDED")).toEqual({
      supply: 2_500_000,
      vat: 250_000,
      grand: 2_750_000,
    });
  });

  it("면세 — 부가세 0", () => {
    const t = quoteTotals(items, "EXEMPT");
    expect(t.vat).toBe(0);
    expect(t.grand).toBe(t.supply);
  });
});

describe("한글 금액", () => {
  it("십·백·천 앞의 '일'은 생략한다", () => {
    expect(toHangulAmount(2_750_000)).toBe("이백칠십오만");
    expect(toHangulAmount(10_000)).toBe("일만");
    expect(toHangulAmount(1_100)).toBe("천백");
    expect(toHangulAmount(100_000_001)).toBe("일억일");
    expect(toHangulAmount(1_234_567_890)).toBe("십이억삼천사백오십육만칠천팔백구십");
  });
});
