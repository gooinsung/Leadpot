import type { LandingBlock } from "../api/client";

/**
 * 랜딩 블록 등장 애니메이션(2026-11-25, 사용자 요청 — docs/superpowers/specs/2026-11-25-landing-block-animation-design.md).
 *
 * 블록 키(content_json 자유 키 — 백엔드·DB 변경 없음):
 * - `anim`: 효과({@link BLOCK_ANIMS}). 없거나 모르는 값이면 애니메이션 없음(기존 랜딩 영향 0).
 * - `animDelay`: 지연(ms). 0~{@link MAX_ANIM_DELAY} 로 정리한다.
 *
 * HTML 블록 안쪽 요소는 `data-lp-anim="fade-up"`(+ 선택 `data-lp-anim-delay="200"`) 속성으로 따로 등장시킨다.
 * 실제 재생은 `useRevealAnimations` + `styles/features/animation.css`.
 */
export type BlockAnim = "fade-up" | "fade" | "zoom-in" | "slide-left" | "slide-right";

export const BLOCK_ANIMS: readonly { value: BlockAnim; label: string }[] = [
  { value: "fade-up", label: "아래에서 위로" },
  { value: "fade", label: "서서히 나타나기" },
  { value: "zoom-in", label: "확대되며 나타나기" },
  { value: "slide-left", label: "왼쪽에서 들어오기" },
  { value: "slide-right", label: "오른쪽에서 들어오기" },
];

export const BLOCK_ANIM_DELAYS: readonly number[] = [0, 100, 200, 300, 500];

const MAX_ANIM_DELAY = 2000;
const ANIM_VALUES = new Set<string>(BLOCK_ANIMS.map((a) => a.value));

/** 지연 값 정리 — 숫자가 아니면 0, 0~2000ms 로 자른다. HTML 속성(`data-lp-anim-delay`)에도 쓴다. */
export function clampAnimDelay(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_ANIM_DELAY, Math.max(0, Math.round(n)));
}

/** 블록의 애니메이션 설정. 효과가 없거나 모르는 값이면 null(=감싸지 않고 그대로 렌더). */
export function resolveBlockAnim(b: LandingBlock): { anim: BlockAnim; delay: number } | null {
  const anim = typeof b.anim === "string" ? b.anim : "";
  if (!ANIM_VALUES.has(anim)) return null;
  return { anim: anim as BlockAnim, delay: clampAnimDelay(b.animDelay) };
}

/** 이 랜딩이 등장 애니메이션을 쓰는지 — 쓰지 않으면 부팅 스크립트·관찰 훅을 아예 켜지 않는다. */
export function usesAnimations(blocks: LandingBlock[]): boolean {
  return blocks.some(
    (b) => resolveBlockAnim(b) != null || ((b.type === "HTML" || b.type === "EMBED") && /\bdata-lp-anim\s*=/.test(String(b.html ?? ""))),
  );
}

/** 숨김 CSS 를 켜는 `<html>` 클래스. animation.css 가 이 클래스 아래에서만 요소를 숨긴다. */
export const ANIM_ON_CLASS = "lp-anim-on";

/**
 * SSR HTML 에 그대로 박히는 부팅 스크립트 — 브라우저가 HTML 을 읽는 도중(첫 페인트 전) 실행돼
 * 숨김 클래스를 붙인다(서버가 그린 콘텐츠가 보였다 사라지는 깜빡임 방지).
 * - JS 가 없는 크롤러·광고 심사 봇: 실행되지 않으므로 클래스가 없어 전부 보인다.
 * - 페일세이프: 3초 안에 훅(`useRevealAnimations`)이 `window.__lpAnim` 을 세우지 않으면(하이드레이션 실패 등)
 *   클래스를 떼서 전부 보이게 한다 — 블록이 영영 투명한 채 남지 않게.
 * - '동작 줄이기' 기기는 처음부터 붙이지 않는다.
 */
export const ANIM_BOOT_SCRIPT =
  `(function(){try{var d=document.documentElement;` +
  `if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;` +
  `if(!('IntersectionObserver' in window))return;` +
  `d.classList.add('${ANIM_ON_CLASS}');` +
  `setTimeout(function(){if(!window.__lpAnim)d.classList.remove('${ANIM_ON_CLASS}');},3000);` +
  `}catch(e){}})();`;
