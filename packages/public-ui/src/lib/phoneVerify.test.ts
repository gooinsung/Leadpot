import { describe, expect, it } from "vitest";
import type { FormBlock } from "../api/client";
import { isMobileDigits, phoneVerifyKey, phoneVerifyToken, type PhoneVerifyState } from "./phoneVerify";

const b = (blockType: string, fieldType?: string) => ({ blockType, fieldType }) as unknown as FormBlock;

describe("phoneVerify", () => {
  it("인증 대상은 첫 번째 연락처(tel) 항목 — 기본형은 정렬 인덱스, 스텝형은 연락처 인덱스", () => {
    const sorted = [b("TEXT"), b("FIELD", "text"), b("FIELD", "tel"), b("FIELD", "tel")];
    expect(phoneVerifyKey("BASIC", true, sorted)).toBe("f2");
    const step = [b("CHOICE"), b("FIELD", "text"), b("CHOICE"), b("FIELD", "tel")];
    expect(phoneVerifyKey("STEP", true, step)).toBe("c1");
  });

  it("인증을 끄거나 연락처 항목이 없으면 대상이 없다", () => {
    expect(phoneVerifyKey("BASIC", false, [b("FIELD", "tel")])).toBeNull();
    expect(phoneVerifyKey("BASIC", true, [b("FIELD", "text")])).toBeNull();
  });

  it("휴대폰(01x)만 인증할 수 있다", () => {
    expect(isMobileDigits("01012345678")).toBe(true);
    expect(isMobileDigits("0111234567")).toBe(true);
    expect(isMobileDigits("0212345678")).toBe(false);
    expect(isMobileDigits("010123")).toBe(false);
  });

  it("토큰은 지금 입력한 번호로 인증(또는 발송 불가)된 경우에만 실린다", () => {
    const verified: PhoneVerifyState = { phone: "01012345678", stage: "verified", token: "t", expiresAt: 0, resendAt: 0 };
    expect(phoneVerifyToken(verified, "010-1234-5678")).toBe("t");
    expect(phoneVerifyToken(verified, "010-1234-0000")).toBeNull(); // 번호를 바꾸면 무효
    expect(phoneVerifyToken({ ...verified, stage: "sent", token: null }, "010-1234-5678")).toBeNull();
    expect(phoneVerifyToken({ ...verified, stage: "fallback" }, "010-1234-5678")).toBe("t");
    expect(phoneVerifyToken(null, "010-1234-5678")).toBeNull();
  });
});
