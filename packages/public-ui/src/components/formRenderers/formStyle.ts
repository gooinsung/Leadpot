import type { FormInput } from "../../api/client";

/**
 * '제출 버튼 문구'의 손대지 않은 씨앗값(FormEditPage 의 useState 기본값과 동일해야 한다).
 * 계산기가 붙은 폼에서 마케터가 아직 이 값을 안 건드렸으면 계산기의 CTA 문구를 대신 쓴다 —
 * 반대로 이 값과 다르면 마케터가 직접 입력한 것이므로 그 값이 항상 이긴다.
 */
export const DEFAULT_SUBMIT_LABEL = "무료 상담 신청";

/** 마지막 제출 버튼에 실제로 쓸 문구. 마케터 설정 > 계산기 기본 CTA > 범용 기본값 순. */
export function resolveSubmitLabel(form: FormInput, calcSubmitLabel: string | undefined): string {
  const configured = form.submitButtonConfig?.label as string | undefined;
  if (configured && configured !== DEFAULT_SUBMIT_LABEL) return configured;
  return calcSubmitLabel || configured || "제출하기";
}

export interface ResolvedStyle {
  buttonColor: string;
  accentColor: string;
  buttonText: string; // 버튼 배경 대비 텍스트 색
  accentText: string;
}

/** 리드폼 styleConfig 에서 색상을 해석(기본값 포함)하고 대비 텍스트 색을 계산. */
export function resolveStyle(form: FormInput): ResolvedStyle {
  const buttonColor = (form.styleConfig?.buttonColor as string) || "#12b886";
  const accentColor = (form.styleConfig?.accentColor as string) || "#3a43c0";
  return {
    buttonColor,
    accentColor,
    buttonText: textOn(buttonColor),
    accentText: textOn(accentColor),
  };
}

/** 배경색 위에서 읽기 쉬운 텍스트 색(흰/잉크)을 luminance 로 결정. */
export function textOn(hex: string): string {
  const c = (hex || "").replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 150 ? "#14172a" : "#ffffff";
}

/** CHOICE 질문의 답변 방식 중 "선택지 목록에서 고르는" 유형(카드형·목록형) 전체. */
const CHOICE_ANSWER_TYPES = new Set(["single", "multi", "list_single", "list_multi"]);
/** 위 중에서도 다중 선택이 가능한 유형. */
const MULTI_ANSWER_TYPES = new Set(["multi", "list_multi"]);

export function isChoiceAnswerType(t: string): boolean {
  return CHOICE_ANSWER_TYPES.has(t);
}
export function isMultiAnswerType(t: string): boolean {
  return MULTI_ANSWER_TYPES.has(t);
}

/** 항목 설명 강조 단계. 레거시 데이터는 boolean(true=강조)이었다 — true 는 "redbold"로 취급. */
export type DescEmphasis = "none" | "bold" | "red" | "redbold";
export function descEmphasisLevel(v: unknown): DescEmphasis {
  if (v === true) return "redbold";
  if (v === "bold" || v === "red" || v === "redbold") return v;
  return "none";
}
/** `field-desc` 뒤에 붙일 클래스 접미사("" 또는 " emphasis-*"). */
export function descEmphasisClass(v: unknown): string {
  const level = descEmphasisLevel(v);
  return level === "none" ? "" : ` emphasis-${level}`;
}
