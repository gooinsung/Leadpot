import type { CSSProperties } from "react";

/**
 * 리드폼 '텍스트' 블록 — 입력폼 안의 CTA 문구(예: "🔥 오늘만 무료 상담!")를 눈에 띄게 꾸민다.
 *
 * `block.content` 에 아래 키를 저장한다(전부 선택, 없으면 예전 텍스트 블록 그대로):
 * - `effect`: 움직임 효과({@link TEXT_EFFECTS}) — 하나만 고른다(확대·흔들림이 같은 transform 을 써서 섞으면 깨진다)
 * - `size`: 글자 크기({@link TEXT_SIZES})
 * - `color`: 글자색(#rrggbb, 빈 값 = 기본)
 * - `bold`: 굵게
 * - `align`: 정렬(left | center)
 * - `bg`: 배경 박스 색(#rrggbb, 빈 값 = 박스 없음)
 *
 * 효과는 전부 CSS 애니메이션이다(form-builder.css `.fr-fx-*`) — JS 타이머가 없어 SSR·임베드에서도
 * 똑같이 돌고, '동작 줄이기'를 켠 기기에서는 멈춘다.
 */
export const TEXT_EFFECTS: readonly { value: string; label: string }[] = [
  { value: "none", label: "효과 없음" },
  { value: "shine", label: "반짝임 (빛줄기가 지나감)" },
  { value: "glow", label: "글로우 (은은하게 빛남)" },
  { value: "pulse", label: "커졌다 작아졌다" },
  { value: "shake", label: "흔들림" },
  { value: "blink", label: "깜빡임" },
  { value: "highlight", label: "형광펜 (밑줄이 그어짐)" },
  { value: "gradient", label: "그라데이션 (색이 흐름)" },
];

export const TEXT_SIZES: readonly { value: string; label: string; px: number }[] = [
  { value: "normal", label: "보통", px: 14 },
  { value: "large", label: "크게", px: 18 },
  { value: "xlarge", label: "아주 크게", px: 22 },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EFFECT_VALUES = new Set(TEXT_EFFECTS.map((e) => e.value));

export interface TextBlockStyle {
  effect: string;
  size: string;
  color: string;
  bold: boolean;
  align: "left" | "center";
  bg: string;
}

/** 저장된 content 를 안전한 값으로 해석한다(잘못된 값은 기본값). */
export function resolveTextBlockStyle(content: Record<string, unknown> | null | undefined): TextBlockStyle {
  const c = content ?? {};
  const effect = typeof c.effect === "string" && EFFECT_VALUES.has(c.effect) ? c.effect : "none";
  const size = TEXT_SIZES.some((s) => s.value === c.size) ? (c.size as string) : "normal";
  const color = typeof c.color === "string" && HEX_RE.test(c.color) ? c.color : "";
  const bg = typeof c.bg === "string" && HEX_RE.test(c.bg) ? c.bg : "";
  return { effect, size, color, bold: c.bold === true, align: c.align === "center" ? "center" : "left", bg };
}

export function FormTextBlock({ content }: { content: Record<string, unknown> | null | undefined }) {
  const text = (content?.text as string) || "";
  const s = resolveTextBlockStyle(content);
  const px = TEXT_SIZES.find((x) => x.value === s.size)?.px ?? 14;

  const style: CSSProperties & Record<string, string | number> = {
    fontSize: px,
    textAlign: s.align,
  };
  if (s.bold) style.fontWeight = 800;
  if (s.color) {
    style.color = s.color;
    style["--fr-fx-color"] = s.color; // 반짝임·글로우·형광펜이 이 색을 기준으로 그린다
  }
  if (s.bg) {
    style.background = s.bg;
    style.padding = "12px 14px";
    style.borderRadius = 12;
  }

  const cls = `fr-text${s.effect !== "none" ? ` fr-fx fr-fx-${s.effect}` : ""}`;
  // 반짝임·형광펜·그라데이션은 글자 줄 단위로 그려야 해서 안쪽 span 에 효과를 건다.
  return (
    <p className={cls} style={style}>
      <span className="fr-fx-inner">{text}</span>
    </p>
  );
}
