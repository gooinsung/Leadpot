import { describe, expect, it } from "vitest";
import type { FormBlock } from "../api/client";
import { fieldBlockError } from "./fieldTypes";
import { ALL_SIDO, allowedSido, isRegionComplete, sigunguOf, splitRegion } from "./regions";

const region = (required: boolean, regions?: string[]) =>
  ({ blockType: "FIELD", fieldType: "region", label: "지역", required, options: { regions } }) as unknown as FormBlock;

describe("지역 선택", () => {
  it("전국 17개 시/도, 구/시 중복 없음", () => {
    expect(ALL_SIDO).toHaveLength(17);
    for (const s of ALL_SIDO) expect(new Set(sigunguOf(s)).size).toBe(sigunguOf(s).length);
    expect(sigunguOf("서울")).toHaveLength(25);
    expect(sigunguOf("경기")).toHaveLength(31);
    expect(sigunguOf("대구")).toContain("군위군");
    expect(sigunguOf("인천")).toEqual(expect.arrayContaining(["제물포구", "영종구", "검단구"]));
  });

  it("마케터가 고른 시/도만, 전국 순서로 — 비면 전국", () => {
    expect(allowedSido(["경기", "서울", "인천"])).toEqual(["서울", "인천", "경기"]);
    expect(allowedSido([])).toHaveLength(17);
    expect(allowedSido(undefined)).toHaveLength(17);
  });

  it("저장값 나누기·완성 여부", () => {
    expect(splitRegion("서울 강남구")).toEqual(["서울", "강남구"]);
    expect(splitRegion("세종")).toEqual(["세종", ""]);
    expect(isRegionComplete("서울 강남구")).toBe(true);
    expect(isRegionComplete("서울")).toBe(false);
    expect(isRegionComplete("세종")).toBe(true);
    expect(isRegionComplete("서울 해운대구")).toBe(false);
  });

  it("검증: 필수면 시/도부터, 시/도만 고르면 구/시까지 요구", () => {
    expect(fieldBlockError(region(true), "")).toBe("'지역' 시/도를 선택해주세요.");
    expect(fieldBlockError(region(false), "")).toBeNull();
    expect(fieldBlockError(region(false), "경기")).toBe("'지역' 구/시를 선택해주세요.");
    expect(fieldBlockError(region(true), "경기 수원시")).toBeNull();
    expect(fieldBlockError(region(true), "세종")).toBeNull();
  });
});
