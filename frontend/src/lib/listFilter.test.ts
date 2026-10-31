import { describe, expect, it } from "vitest";
import { matchesQuery, matchesTags, parseSort, sortList } from "./listFilter";

describe("matchesQuery", () => {
  it("빈 검색어는 모두 통과", () => {
    expect(matchesQuery("  ", ["아무거나"])).toBe(true);
  });
  it("대소문자·공백 무시", () => {
    expect(matchesQuery("모두 이사", ["모두이사(디비딥/구글)"])).toBe(true);
    expect(matchesQuery("META", ["손평사(디비딥/meta)"])).toBe(true);
  });
  it("여러 칸 중 하나라도 맞으면 통과, 숫자도 검색", () => {
    expect(matchesQuery("37", ["랜딩", 37])).toBe(true);
    expect(matchesQuery("없는말", ["랜딩", null, undefined])).toBe(false);
  });
});

describe("sortList", () => {
  const items = [
    { id: 1, name: "다", updatedAt: "2026-10-01T00:00:00Z", rev: 100 },
    { id: 3, name: "가", updatedAt: "2026-10-03T00:00:00Z", rev: 0 },
    { id: 2, name: "나10", updatedAt: "2026-10-02T00:00:00Z", rev: 500 },
    { id: 4, name: "나9", updatedAt: "2026-09-01T00:00:00Z", rev: 500 },
  ];
  const get = { name: (x: (typeof items)[number]) => x.name, revenue: (x: (typeof items)[number]) => x.rev };
  const ids = (s: Parameters<typeof sortList>[1]) => sortList(items, s, get).map((x) => x.id);

  it("수정일 최신/오래된", () => {
    expect(ids("updated")).toEqual([3, 2, 1, 4]);
    expect(ids("oldest")).toEqual([4, 1, 2, 3]);
  });
  it("최근 만든순은 id 내림차순", () => {
    expect(ids("created")).toEqual([4, 3, 2, 1]);
  });
  it("이름순은 숫자를 자연스럽게(나9 < 나10)", () => {
    expect(ids("name")).toEqual([3, 4, 2, 1]);
  });
  it("수익 높은순, 같으면 최근 수정순", () => {
    expect(ids("revenue")).toEqual([2, 4, 1, 3]);
  });
  it("원본 배열은 건드리지 않는다", () => {
    sortList(items, "name", get);
    expect(items.map((x) => x.id)).toEqual([1, 3, 2, 4]);
  });
  it("모르는 정렬값은 최근 수정순", () => {
    expect(parseSort("xx")).toBe("updated");
    expect(parseSort(null)).toBe("updated");
  });
});

describe("matchesTags", () => {
  it("고른 태그가 없으면 모두 통과", () => {
    expect(matchesTags(null, [], "and")).toBe(true);
  });
  it("and: 모두 가져야 통과", () => {
    expect(matchesTags(["이사", "당근"], ["이사", "당근"], "and")).toBe(true);
    expect(matchesTags(["이사"], ["이사", "당근"], "and")).toBe(false);
  });
  it("or: 하나라도 가지면 통과", () => {
    expect(matchesTags(["이사"], ["이사", "당근"], "or")).toBe(true);
    expect(matchesTags(["메타"], ["이사", "당근"], "or")).toBe(false);
    expect(matchesTags(undefined, ["이사"], "or")).toBe(false);
  });
});
