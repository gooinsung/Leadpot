import { describe, expect, it } from "vitest";
import { resolveTextBlockStyle } from "./FormTextBlock";

describe("resolveTextBlockStyle", () => {
  it("꾸밈 값이 없는 예전 텍스트 블록은 기본값(효과 없음)", () => {
    expect(resolveTextBlockStyle({ text: "안내" })).toEqual({
      effect: "none",
      size: "normal",
      color: "",
      bold: false,
      align: "left",
      bg: "",
    });
    expect(resolveTextBlockStyle(null).effect).toBe("none");
  });

  it("저장된 꾸밈 값을 그대로 읽는다", () => {
    const s = resolveTextBlockStyle({ effect: "pulse", size: "xlarge", color: "#F04452", bold: true, align: "center", bg: "#fff4c2" });
    expect(s).toEqual({ effect: "pulse", size: "xlarge", color: "#F04452", bold: true, align: "center", bg: "#fff4c2" });
  });

  it("잘못된 값(입력 중인 색, 모르는 효과)은 기본값으로", () => {
    const s = resolveTextBlockStyle({ effect: "explode", size: "huge", color: "#f04", bg: "red", bold: "yes", align: "right" });
    expect(s).toEqual({ effect: "none", size: "normal", color: "", bold: false, align: "left", bg: "" });
  });
});
