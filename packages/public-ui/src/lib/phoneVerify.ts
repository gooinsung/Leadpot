import type { FormBlock } from "../api/client";

/**
 * 리드폼 휴대폰 본인인증(V48) 화면 상태. 번호(`phone`, 숫자만)를 함께 들고 있다가
 * 연락처 입력이 바뀌면 무효로 본다.
 *
 * - `sent`: 인증번호 입력 대기
 * - `verified`: 인증 통과(`token` 으로 접수)
 * - `fallback`: 문자를 못 보내 인증 없이 접수(`token` 으로 접수, 리드는 '미인증')
 */
export interface PhoneVerifyState {
  phone: string;
  stage: "sent" | "verified" | "fallback";
  token: string | null;
  /** 인증번호 만료 시각(ms). */
  expiresAt: number;
  /** 재전송 가능 시각(ms). */
  resendAt: number;
}

export const phoneDigits = (v: string | undefined | null) => (v ?? "").replace(/\D/g, "");

/** 휴대폰(01x, 10~11자리)인가 — 유선 번호로는 문자를 받을 수 없다. 서버 판정과 같다. */
export const isMobileDigits = (d: string) => /^01\d{8,9}$/.test(d);

/**
 * 인증할 연락처 칸의 값 키 — 리드폼의 **첫 번째 연락처(tel) 입력 항목**(사용자 결정 2026-11-09).
 * 기본형은 `f{정렬 인덱스}`, 스텝형은 연락처 단계의 `c{항목 인덱스}`. 인증을 안 쓰거나 연락처 항목이 없으면 null.
 * 서버(PhoneVerificationService.verificationPhone)도 같은 항목을 고른다.
 */
export function phoneVerifyKey(formType: string, requireVerification: boolean, sorted: FormBlock[]): string | null {
  if (!requireVerification) return null;
  const isTel = (b: FormBlock) => b.blockType === "FIELD" && b.fieldType === "tel";
  if (formType === "BASIC") {
    const i = sorted.findIndex(isTel);
    return i < 0 ? null : `f${i}`;
  }
  const ci = sorted.filter((b) => b.blockType === "FIELD").findIndex(isTel);
  return ci < 0 ? null : `c${ci}`;
}

/** 접수에 실을 토큰 — 지금 입력된 번호로 인증(또는 FALLBACK)된 경우에만. */
export function phoneVerifyToken(state: PhoneVerifyState | null, phone: string): string | null {
  if (!state || state.phone !== phoneDigits(phone)) return null;
  return state.stage === "verified" || state.stage === "fallback" ? state.token : null;
}
