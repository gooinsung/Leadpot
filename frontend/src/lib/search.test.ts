import { describe, expect, it } from "vitest";
import { matchesSearch } from "./search";

describe("목록 검색", () => {
  it("빈 검색어는 모두 일치", () => {
    expect(matchesSearch("  ", "아무거나")).toBe(true);
  });
  it("대소문자·공백을 무시한다", () => {
    expect(matchesSearch("개인 회생", "개인회생 DB")).toBe(true);
    expect(matchesSearch("db", "개인회생 DB")).toBe(true);
  });
  it("여러 칸 중 하나만 맞아도 일치, null 은 건너뛴다", () => {
    expect(matchesSearch("law", null, "제목", "the-law")).toBe(true);
    expect(matchesSearch("없음", null, "제목")).toBe(false);
  });
});
