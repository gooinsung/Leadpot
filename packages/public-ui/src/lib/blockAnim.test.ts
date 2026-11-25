import { describe, expect, it } from "vitest";
import { resolveBlockAnim, usesAnimations } from "./blockAnim";

describe("resolveBlockAnim", () => {
  it("효과와 지연을 그대로 읽는다", () => {
    expect(resolveBlockAnim({ type: "IMAGE", anim: "fade-up", animDelay: 200 })).toEqual({ anim: "fade-up", delay: 200 });
  });

  it("효과가 없거나 모르는 값이면 null — 애니메이션 없이 그대로 보인다", () => {
    expect(resolveBlockAnim({ type: "IMAGE" })).toBeNull();
    expect(resolveBlockAnim({ type: "IMAGE", anim: "wobble" })).toBeNull();
    expect(resolveBlockAnim({ type: "IMAGE", anim: "none" })).toBeNull();
  });

  it("지연은 숫자로 바꾸고 0~2000ms 로 자른다", () => {
    expect(resolveBlockAnim({ type: "TEXT", anim: "fade", animDelay: "300" })?.delay).toBe(300);
    expect(resolveBlockAnim({ type: "TEXT", anim: "fade", animDelay: -5 })?.delay).toBe(0);
    expect(resolveBlockAnim({ type: "TEXT", anim: "fade", animDelay: 99999 })?.delay).toBe(2000);
    expect(resolveBlockAnim({ type: "TEXT", anim: "fade", animDelay: "abc" })?.delay).toBe(0);
    expect(resolveBlockAnim({ type: "TEXT", anim: "fade" })?.delay).toBe(0);
  });
});

describe("usesAnimations", () => {
  it("블록에 효과가 있으면 true", () => {
    expect(usesAnimations([{ type: "IMAGE" }, { type: "TEXT", anim: "zoom-in" }])).toBe(true);
  });

  it("HTML·외부 폼 블록 안에 data-lp-anim 이 있으면 true", () => {
    expect(usesAnimations([{ type: "HTML", html: '<div data-lp-anim="fade-up">a</div>' }])).toBe(true);
    expect(usesAnimations([{ type: "EMBED", html: "<p data-lp-anim='fade'>b</p>" }])).toBe(true);
  });

  it("아무 데도 없으면 false", () => {
    expect(usesAnimations([{ type: "IMAGE" }, { type: "HTML", html: "<p>x</p>" }, { type: "TEXT", anim: "wobble" }])).toBe(false);
  });
});
