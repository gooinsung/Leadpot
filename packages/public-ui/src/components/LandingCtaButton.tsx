import { Fragment, type CSSProperties } from "react";
import type { LandingBlock } from "../api/client";
import { TEXT_EFFECTS } from "./formRenderers/FormTextBlock";

/**
 * 랜딩 FORM 블록의 CTA 버튼(노출 방식 = 버튼 → 오버레이 / 버튼 → 풀스크린).
 * 공개 랜딩(LandingView)과 관리 앱 랜딩 편집기 미리보기가 같은 컴포넌트를 써서 모양이 갈라지지 않게 한다.
 *
 * 꾸밈 값은 랜딩 블록(content_json 의 FORM 블록)에 저장한다(전부 선택, 없으면 예전 버튼 그대로):
 * - `btnTextFx`: 버튼 글자 효과({@link CTA_TEXT_EFFECTS}) — 리드폼 텍스트 블록 효과(.fr-fx-*)를 그대로 재사용
 * - `btnFx`: 버튼 자체 움직임({@link CTA_BUTTON_EFFECTS}) — landing.css `.landing-cta-fx-*`
 * - `btnSize`: 버튼 크기({@link CTA_SIZES})
 * - `btnFontSize`: 글자 크기({@link CTA_FONT_SIZES}, "auto" = 버튼 크기에 맞춘 기본 글자 크기)
 * - `btnBold`: 글자 굵게 / `btnShadow`: 그림자
 * - `btnRadius`: 모서리({@link CTA_RADII})
 * - `btnColor`·`btnTextColor`: 버튼·글자색(#rrggbb, 빈 값 = 연결된 리드폼의 버튼 색을 따라감)
 *
 * 효과는 전부 CSS 애니메이션이라 SSR 에서도 그대로 돌고, '동작 줄이기'를 켠 기기에선 멈춘다.
 *
 * 같은 꾸밈 키(btn*)를 리드폼 `styleConfig` 에도 저장해 **리드폼 제출 버튼**({@link SubmitCtaButton})에
 * 그대로 쓴다 — 랜딩 CTA 와 리드폼 제출 버튼의 효과 목록·해석이 갈라지지 않게 한 곳에 둔다.
 */

/** 글자 효과 — 확대·흔들림은 버튼 움직임 쪽에 있으므로 글자에는 글자 단위 효과만 둔다. */
export const CTA_TEXT_EFFECTS: readonly { value: string; label: string }[] = TEXT_EFFECTS.filter(
  (e) => e.value !== "pulse" && e.value !== "shake",
);

export const CTA_BUTTON_EFFECTS: readonly { value: string; label: string }[] = [
  { value: "none", label: "움직임 없음" },
  { value: "pulse", label: "커졌다 작아졌다" },
  { value: "shake", label: "흔들림" },
  { value: "bounce", label: "통통 튀기" },
  { value: "ring", label: "물결 (테두리가 퍼져나감)" },
  { value: "sheen", label: "빛줄기 (버튼 위로 빛이 지나감)" },
];

export const CTA_SIZES: readonly { value: string; label: string }[] = [
  { value: "normal", label: "보통" },
  { value: "large", label: "크게" },
  { value: "xlarge", label: "아주 크게" },
];

/** 글자 크기 — 값은 px 숫자 문자열. 모바일(≈375px)에서 한 줄에 들어가는 범위로 제한한다. */
export const CTA_FONT_SIZES: readonly { value: string; label: string }[] = [
  { value: "auto", label: "기본 (버튼 크기에 맞춤)" },
  ...["14", "16", "18", "20", "22", "24", "26", "28", "32"].map((v) => ({ value: v, label: `${v}px` })),
];

export const CTA_RADII: readonly { value: string; label: string }[] = [
  { value: "pill", label: "알약형(기본)" },
  { value: "round", label: "둥근 사각" },
  { value: "square", label: "각진 사각" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface CtaStyle {
  textFx: string;
  buttonFx: string;
  size: string;
  /** "auto" 또는 px 숫자 문자열 */
  fontSize: string;
  radius: string;
  bold: boolean;
  shadow: boolean;
  color: string;
  textColor: string;
}

function pick(list: readonly { value: string }[], v: unknown, fallback: string): string {
  return typeof v === "string" && list.some((x) => x.value === v) ? v : fallback;
}

/**
 * 저장된 꾸밈 값을 안전한 값으로 해석한다(잘못된 값은 기본값).
 * 랜딩 FORM/EMBED 블록이나 리드폼 `styleConfig` 처럼 btn* 키를 가진 객체면 무엇이든 받는다.
 */
export function resolveCtaStyle(b: Record<string, unknown> | null | undefined): CtaStyle {
  b = b ?? {};
  return {
    textFx: pick(CTA_TEXT_EFFECTS, b.btnTextFx, "none"),
    buttonFx: pick(CTA_BUTTON_EFFECTS, b.btnFx, "none"),
    size: pick(CTA_SIZES, b.btnSize, "normal"),
    fontSize: pick(CTA_FONT_SIZES, typeof b.btnFontSize === "number" ? String(b.btnFontSize) : b.btnFontSize, "auto"),
    radius: pick(CTA_RADII, b.btnRadius, "pill"),
    bold: b.btnBold === true,
    shadow: b.btnShadow === true,
    color: typeof b.btnColor === "string" && HEX_RE.test(b.btnColor) ? b.btnColor : "",
    textColor: typeof b.btnTextColor === "string" && HEX_RE.test(b.btnTextColor) ? b.btnTextColor : "",
  };
}

/** 크기·모서리·굵게·그림자·움직임 클래스. `base` 는 화면별 레이아웃 클래스(랜딩 CTA / 리드폼 제출 버튼). */
function ctaClassName(s: CtaStyle, base: string): string {
  return [
    base,
    s.size !== "normal" && `landing-cta-size-${s.size}`,
    s.radius !== "pill" && `landing-cta-radius-${s.radius}`,
    s.bold && "landing-cta-bold",
    s.shadow && "landing-cta-shadow",
    s.buttonFx !== "none" && `landing-cta-fx-${s.buttonFx}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** 버튼 인라인 스타일 — 색 + (지정 시) 글자 크기. --cta-color 는 물결 효과가 쓴다. */
function ctaInlineStyle(s: CtaStyle, bg: string, fg: string, extra?: CSSProperties): CSSProperties {
  const st: CSSProperties & Record<string, string | number> = { ...extra, background: bg, color: fg, "--cta-color": bg };
  if (s.fontSize !== "auto") st.fontSize = `${s.fontSize}px`;
  return st;
}

/** 버튼 글자 — 글자 효과가 있으면 리드폼 텍스트 블록 효과(.fr-fx-*)로 감싼다. */
function CtaLabel({ s, fg, label }: { s: CtaStyle; fg: string; label: string }) {
  if (s.textFx === "none") return <>{label}</>;
  const textStyle: CSSProperties & Record<string, string> = { "--fr-fx-color": fg };
  return (
    <span className={`fr-fx fr-fx-${s.textFx}`} style={textStyle}>
      <span className="fr-fx-inner">{label}</span>
    </span>
  );
}

export function LandingCtaButton({
  block,
  baseColor,
  baseTextColor,
  style,
  onClick,
  disabled,
}: {
  block: LandingBlock;
  /** 연결된 리드폼의 버튼 색(styleConfig.buttonColor) — 블록에서 따로 지정하지 않으면 이 색을 쓴다. */
  baseColor: string;
  baseTextColor: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const s = resolveCtaStyle(block);
  const label = (block.buttonLabel as string) || "신청하기";
  const description = block.buttonDescription as string | undefined;
  const bg = s.color || baseColor;
  const fg = s.textColor || baseTextColor;

  return (
    <Fragment>
      <button
        className={ctaClassName(s, "btn landing-cta")}
        type="button"
        style={ctaInlineStyle(s, bg, fg, style)}
        onClick={onClick}
        disabled={disabled}
      >
        <CtaLabel s={s} fg={fg} label={label} />
      </button>
      {description && <p className="landing-cta-desc">{description}</p>}
    </Fragment>
  );
}

/**
 * 리드폼 제출 버튼 — 기본형 마지막 버튼·스텝형 연락처 단계 버튼 공용.
 * 꾸밈은 리드폼 `styleConfig` 의 btn* 키(랜딩 CTA 와 같은 키·같은 해석). 색은 styleConfig.buttonColor 를
 * 호출부가 넘긴다. 아무 꾸밈도 없으면 예전 제출 버튼과 똑같이 보인다.
 */
export function SubmitCtaButton({
  styleConfig,
  background,
  color,
  label,
  type = "button",
  disabled,
  onClick,
  style,
}: {
  styleConfig: Record<string, unknown> | null | undefined;
  background: string;
  color: string;
  label: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const s = resolveCtaStyle(styleConfig);
  return (
    <button className={ctaClassName(s, "btn fr-submit-cta")} type={type} disabled={disabled} onClick={onClick} style={ctaInlineStyle(s, background, color, style)}>
      <CtaLabel s={s} fg={color} label={label} />
    </button>
  );
}
