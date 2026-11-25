# 랜딩 블록 등장 애니메이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랜딩 블록마다 스크롤 등장 애니메이션(효과 + 지연)을 고를 수 있게 한다.

**Architecture:** `anim` 이 있는 블록만 `<div class="lp-anim" data-lp-anim=… >` 래퍼로 감싼다(래퍼라서 CTA 버튼 자체의
transform 효과와 충돌하지 않고, `anim` 없는 기존 블록은 DOM 이 전과 같다). 공용 훅이 IntersectionObserver 로 `[data-lp-anim]`
(HTML 블록 안쪽 포함)을 지켜보다 `.lp-in` 을 붙인다. 숨김은 `<html class="lp-anim-on">` 일 때만 — SSR 인라인 스크립트가 첫 페인트 전에
붙이고, 3초 안에 훅이 안 뜨면 뗀다.

**Tech Stack:** React 19, TypeScript, vitest(public-ui, DOM 없음 — 순수 함수만), Playwright(실렌더 확인).

**Spec:** docs/superpowers/specs/2026-11-25-landing-block-animation-design.md

## Global Constraints

- 효과 값: `"fade-up" | "fade" | "zoom-in" | "slide-left" | "slide-right"`, 지연 선택지 0/100/200/300/500ms, 재생 0.7초.
- `anim` 없는 블록·랜딩은 출력 DOM 이 지금과 완전히 같아야 한다.
- 숨김 CSS 는 `.lp-anim-on` 아래에서만, `prefers-reduced-motion: reduce` 에서는 숨기지 않는다.
- floating CTA·오버레이/풀스크린 내부는 제외. 375px 에서 가로 스크롤 없음.
- UI 문구·주석 한국어.

## Review Focus

- 알 수 없는 `anim` 값(오타·옛 데이터) → 애니메이션 없이 그대로 보여야 한다(Task 1 테스트).
- `animDelay` 가 문자열/음수/거대값 → 0~2000ms 로 정리(Task 1 테스트).
- JS 가 없거나 훅이 실패 → 전부 보임(Task 2 Playwright: 스크립트 차단 렌더 확인).
- 편집기에서 효과 변경 → 해당 블록만 다시 재생(Task 3 수동 확인).
- HTML 블록이 나중에 그린 요소(`data-lp-anim`) → MutationObserver 로 잡힘(Task 2 Playwright).

---

### Task 1: 애니메이션 값 해석 + 훅 + CSS (public-ui)

**Files:**
- Create: `packages/public-ui/src/lib/blockAnim.ts`, `packages/public-ui/src/lib/blockAnim.test.ts`
- Create: `packages/public-ui/src/components/useRevealAnimations.ts`
- Create: `packages/public-ui/src/styles/features/animation.css`
- Modify: `packages/public-ui/src/index.ts`(export), `renderer/src/app/globals.css`, `frontend/src/index.css`(import)

**Interfaces — Produces:**
- `BLOCK_ANIMS: readonly {value: BlockAnim; label: string}[]`, `BLOCK_ANIM_DELAYS: readonly number[]`
- `resolveBlockAnim(b: LandingBlock): { anim: BlockAnim; delay: number } | null`
- `usesAnimations(blocks: LandingBlock[]): boolean` — 블록 `anim` 또는 HTML/EMBED 의 `data-lp-anim` 존재
- `ANIM_BOOT_SCRIPT: string` — SSR 인라인 스크립트(클래스 부착 + 3초 페일세이프, `window.__lpAnim` 확인)
- `useRevealAnimations(ref: RefObject<HTMLElement|null>, enabled: boolean): void`

- [ ] 테스트: `resolveBlockAnim({anim:"fade-up",animDelay:200})` → `{anim:"fade-up",delay:200}`; `anim:"wobble"` → null; 없음 → null;
  `animDelay:"300"` → 300, `-5` → 0, `99999` → 2000; `usesAnimations` 가 블록 키·HTML 속성 둘 다 감지, 둘 다 없으면 false.
- [ ] 실패 확인 → 구현 → `npm test -w @leadpot/public-ui` 통과.
- [ ] 훅: useLayoutEffect 에서 ownerDocument.documentElement 에 `lp-anim-on` 부착 + `win.__lpAnim = true`, 창의 IntersectionObserver
  (threshold 0.15) 로 관찰·한 번만, MutationObserver(subtree) 로 새 `[data-lp-anim]` 추가 관찰. IO 없으면 전부 `.lp-in`.
- [ ] CSS: 래퍼 `.lp-anim`(display:block), 효과별 시작 상태, `transition: .7s` + `transition-delay: var(--lp-anim-delay)`.
  HTML 안쪽 요소의 `data-lp-anim-delay` 는 훅이 `--lp-anim-delay` 로 옮긴다.
- [ ] 커밋.

### Task 2: LandingView 적용 + 실렌더 검증

**Files:** Modify `packages/public-ui/src/components/LandingView.tsx`

- [ ] 블록 렌더 결과를 `withAnim(b, i, node)` 로 감싼다(floating 이면 감싸지 않음, 오버레이 내부 미적용).
  래퍼 key 에 anim·delay 포함(편집기 재생용).
- [ ] `usesAnimations` 일 때만 inner 맨 앞에 `<script dangerouslySetInnerHTML={{__html: ANIM_BOOT_SCRIPT}} />` + 훅 활성화.
- [ ] Playwright(375px, 정적 페이지에 같은 CSS·로직): 스크롤 시 `.lp-in` 부착, JS 차단 시 opacity 1, 가로 스크롤 없음.
- [ ] tsc(public-ui·renderer·frontend) 통과, 커밋.

### Task 3: 편집기 UI + 미리보기

**Files:** Modify `frontend/src/pages/LandingEditPage.tsx`

- [ ] 여백 설정 아래 "등장 애니메이션"(없음 + BLOCK_ANIMS) / "지연"(BLOCK_ANIM_DELAYS) select. floating CTA 에선 숨김.
- [ ] HTML 블록 안내문: `data-lp-anim="fade-up"` 사용법.
- [ ] 미리보기 블록도 `withAnim` 과 같은 래퍼 + 컨테이너에 `useRevealAnimations`(public-ui 에서 export 한 `AnimWrap` 재사용).
- [ ] frontend tsc·build, 커밋. PROGRESS 갱신·푸시.
