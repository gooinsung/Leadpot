import { describe, expect, it } from "vitest";
import type { FormBlock } from "../api/client";
import { rememberAddressParts } from "./addressParts";
import { answerParts, joinAddressDetail } from "./fieldTypes";

const parts = { zonecode: "06234", road: "서울 강남구 테헤란로 123", jibun: "서울 강남구 역삼동 737", building: "래미안", bname: "역삼동" };
const saved = "(06234) 서울 강남구 테헤란로 123 (역삼동, 래미안)";

describe("addressParts", () => {
  it("주소 검색으로 채운 값이면 조각을 함께 남긴다", () => {
    rememberAddressParts(saved, parts);
    const b = { blockType: "FIELD", fieldType: "address" } as FormBlock;
    expect(answerParts(b, saved).addressParts).toEqual({ ...parts, detail: "" });
  });

  it("주소 + 상세주소 항목은 상세주소까지 담는다", () => {
    rememberAddressParts(saved, parts);
    const b = { blockType: "FIELD", fieldType: "address_detail" } as FormBlock;
    const r = answerParts(b, joinAddressDetail(saved, " 101동 202호 "));
    expect(r.addressParts).toEqual({ ...parts, detail: "101동 202호" });
    expect(r.addressDetail).toBe("101동 202호");
  });

  it("검색 없이 들어온 값이나 다른 유형은 남기지 않는다", () => {
    expect(answerParts({ blockType: "FIELD", fieldType: "address" } as FormBlock, "모르는 주소").addressParts).toBeUndefined();
    expect(answerParts({ blockType: "FIELD", fieldType: "text" } as FormBlock, saved).addressParts).toBeUndefined();
  });
});
