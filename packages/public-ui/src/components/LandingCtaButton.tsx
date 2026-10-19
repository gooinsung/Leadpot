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
 * - `btnBold`: 글자 굵게 / `btnShadow`: 그림자
 * - `btnRadius`: 모서리({@link CTA_RADII})
 * - `btnColor`·`btnTextColor`: 버튼·글자색(#rrggbb, 빈 값 = 연결된 리드폼의 버튼 색을 따라감)
 *
 * 효과는 전부 CSS 애니메이션이라 SSR 에서도 그대로 돌고, '동작 줄이기'를 켠 기기에선 멈춘다.
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
  radius: string;
  bold: boolean;
  shadow: boolean;
  color: string;
  textColor: string;
}

function pick(list: readonly { value: string }[], v: unknown, fallback: string): string {
  return typeof v === "string" && list.some((x) => x.value === v) ? v : fallback;
}

/** 저장된 블록 값을 안전한 값으로 해석한다(잘못된 값은 기본값). */
export function resolveCtaStyle(b: LandingBlock): CtaStyle {
  return {
    textFx: pick(CTA_TEXT_EFFECTS, b.btnTextFx, "none"),
    buttonFx: pick(CTA_BUTTON_EFFECTS, b.btnFx, "none"),
    size: pick(CTA_SIZES, b.btnSize, "normal"),
    radius: pick(CTA_RADII, b.btnRadius, "pill"),
    bold: b.btnBold === true,
    shadow: b.btnShadow === true,
    color: typeof b.btnColor === "string" && HEX_RE.test(b.btnColor) ? b.btnColor : "",
    textColor: typeof b.btnTextColor === "string" && HEX_RE.test(b.btnTextColor) ? b.btnTextColor : "",
  };
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

  const cls = [
    "btn landing-cta",
    `landing-cta-size-${s.size}`,
    `landing-cta-radius-${s.radius}`,
    s.bold && "landing-cta-bold",
    s.shadow && "landing-cta-shadow",
    s.buttonFx !== "none" && `landing-cta-fx-${s.buttonFx}`,
  ]
    .filter(Boolean)
    .join(" ");

  const btnStyle: CSSProperties & Record<string, string | number> = { ...style, background: bg, color: fg, "--cta-color": bg };
  const textStyle: CSSProperties & Record<string, string> = { "--fr-fx-color": fg };

  return (
    <Fragment>
      <button className={cls} type="button" style={btnStyle} onClick={onClick} disabled={disabled}>
        {s.textFx !== "none" ? (
          <span className={`fr-fx fr-fx-${s.textFx}`} style={textStyle}>
            <span className="fr-fx-inner">{label}</span>
          </span>
        ) : (
          label
        )}
      </button>
      {description && <p className="landing-cta-desc">{description}</p>}
    </Fragment>
  );
}
