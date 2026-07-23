import type { FormInput } from "../../api/client";

export interface ResolvedStyle {
  buttonColor: string;
  accentColor: string;
  buttonText: string; // 버튼 배경 대비 텍스트 색
  accentText: string;
}

/** 폼 styleConfig 에서 색상을 해석(기본값 포함)하고 대비 텍스트 색을 계산. */
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
