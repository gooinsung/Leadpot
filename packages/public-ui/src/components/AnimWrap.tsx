"use client";
import { useLayoutEffect, useEffect, type CSSProperties, type ReactNode } from "react";
import type { LandingBlock } from "../api/client";
import { ANIM_ON_CLASS, clampAnimDelay, resolveBlockAnim } from "../lib/blockAnim";

/** SSR 에서는 useLayoutEffect 가 돌지 않으므로(경고 회피) 서버에서는 useEffect 로 바꿔 쓴다. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 블록 등장 애니메이션 래퍼. `anim` 이 없는 블록은 감싸지 않고 그대로 돌려준다(기존 랜딩 DOM 영향 0).
 *
 * 래퍼(div)에 효과를 거는 이유: CTA 버튼은 자체 움직임 효과(커지기·흔들림)를 transform 으로 쓰므로
 * 같은 요소에 등장 transform 을 걸면 서로 덮어쓴다. 블록 여백(margin)은 안쪽 요소에 그대로 있어 모양이 같다.
 *
 * `key` 에 효과·지연을 넣는다 — 편집기에서 값을 바꾸면 래퍼가 새로 만들어져 그 블록이 다시 재생된다.
 */
export function withAnim(b: LandingBlock, key: number, node: ReactNode): ReactNode {
  const a = resolveBlockAnim(b);
  if (!a || node == null || b.floating) return node;
  return (
    <div
      key={`${key}-${a.anim}-${a.delay}`}
      className="lp-anim"
      data-lp-anim={a.anim}
      style={{ "--lp-anim-delay": `${a.delay}ms` } as CSSProperties}
    >
      {node}
    </div>
  );
}

/**
 * `root` 안의 `[data-lp-anim]`(블록 래퍼 + HTML 블록 안쪽 요소)을 지켜보다 화면에 들어오면 `.lp-in` 을 붙인다(한 번만).
 *
 * - 문서(`<html>`)에 `lp-anim-on` 을 붙여 숨김 CSS 를 켠다 — SSR 에선 부팅 스크립트가 먼저 붙여 두었고,
 *   클라이언트 렌더(관리 앱 미리보기·CSR 공개 페이지)에선 여기서 첫 페인트 전에 붙인다.
 * - `window.__lpAnim` 을 세워 부팅 스크립트의 3초 페일세이프가 클래스를 떼지 않게 한다.
 * - 편집기 미리보기는 iframe 안이므로 요소가 속한 문서·창의 IntersectionObserver 를 쓴다.
 * - HTML 블록 스크립트가 나중에 그린 요소나, 편집기에서 다시 만들어진 래퍼는 MutationObserver 로 잡는다.
 * - IntersectionObserver 가 없거나 '동작 줄이기'면 클래스를 붙이지 않는다(= 전부 그대로 보인다).
 */
export function useRevealAnimations(root: HTMLElement | null, enabled: boolean): void {
  // ref 객체가 아니라 요소를 받는다 — 편집기 미리보기는 iframe 포털이라 요소가 나중 렌더에 붙는데,
  // 그때 다시 실행되려면 요소가 의존성에 있어야 한다(콜백 ref + state 로 넘길 것).
  useIsoLayoutEffect(() => {
    if (!enabled || !root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView as (Window & typeof globalThis & { __lpAnim?: boolean }) | null;
    if (!win) return;
    const html = doc.documentElement;
    const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof win.IntersectionObserver !== "function") {
      html.classList.remove(ANIM_ON_CLASS);
      return;
    }
    win.__lpAnim = true;
    html.classList.add(ANIM_ON_CLASS);

    // 화면 아래 10% 를 넘어 올라오면 재생(살짝 올라온 뒤). threshold 0 이라 화면보다 훨씬 긴 블록도 잡힌다.
    const pending = new Set<Element>();
    const show = (el: Element) => {
      el.classList.add("lp-in");
      pending.delete(el);
      io.unobserve(el);
    };
    const io = new win.IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && show(e.target)),
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    // 페이지 맨 끝의 짧은 요소는 끝까지 스크롤해도 아래 10% 안에 머물러 위 조건에 안 걸린다(실측 2026-11-25).
    // 그래서 맨 끝까지 내려왔으면(또는 스크롤할 게 없는 짧은 페이지면) 화면에 걸친 남은 요소를 모두 재생한다.
    const atBottom = () => {
      const se = doc.scrollingElement ?? html;
      if (win.scrollY + win.innerHeight < se.scrollHeight - 2) return;
      pending.forEach((el) => el.getBoundingClientRect().top < win.innerHeight && show(el));
    };
    win.addEventListener("scroll", atBottom, { passive: true });
    const bottomTimer = win.setTimeout(atBottom, 300);
    const watch = (el: Element) => {
      if (el.classList.contains("lp-in")) return;
      // HTML 안쪽 요소의 지연 속성 → CSS 변수(블록 래퍼는 이미 style 로 갖고 있다).
      const d = el.getAttribute("data-lp-anim-delay");
      if (d != null) (el as HTMLElement).style.setProperty("--lp-anim-delay", `${clampAnimDelay(d)}ms`);
      pending.add(el);
      io.observe(el);
    };
    const scan = (node: Element) => {
      if (node.hasAttribute("data-lp-anim")) watch(node);
      node.querySelectorAll("[data-lp-anim]").forEach(watch);
    };
    scan(root);

    const mo = new win.MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n.nodeType === 1 && scan(n as Element));
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      win.removeEventListener("scroll", atBottom);
      win.clearTimeout(bottomTimer);
      html.classList.remove(ANIM_ON_CLASS);
    };
  }, [root, enabled]);
}
