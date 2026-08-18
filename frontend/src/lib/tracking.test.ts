import { describe, expect, it } from "vitest";
import { buildUtmFacets, leadSource, matchesUtm, sortUtmFacets, trackingKeyLabel } from "./tracking";

describe("leadSource", () => {
  it("자체 파라미터 media_from 이 있으면 그것을 쓴다", () => {
    expect(leadSource({ media_from: "danggun", source: "google" })).toBe("danggun");
  });

  it("media_from 이 없으면 표준 utm source 로 대신한다", () => {
    expect(leadSource({ source: "google" })).toBe("google");
  });

  it("둘 다 없거나 utm 자체가 없으면 null — 칩을 그리지 않는다", () => {
    expect(leadSource({ campaign_name: "summer" })).toBeNull();
    expect(leadSource(null)).toBeNull();
    expect(leadSource(undefined)).toBeNull();
    expect(leadSource({ media_from: "  " })).toBeNull();
  });
});

describe("matchesUtm", () => {
  it("정확히 같은 값만 통과한다(부분검색 아님)", () => {
    expect(matchesUtm({ media_from: "danggun" }, "media_from", "danggun")).toBe(true);
    expect(matchesUtm({ media_from: "danggun" }, "media_from", "dang")).toBe(false);
    expect(matchesUtm({ media_from: "danggun" }, "campaign_name", "danggun")).toBe(false);
    expect(matchesUtm(null, "media_from", "danggun")).toBe(false);
  });
});

describe("buildUtmFacets", () => {
  it("등장한 키만, 값은 많이 나온 순으로 담는다", () => {
    const facets = buildUtmFacets([
      { utm: { media_from: "danggun" } },
      { utm: { media_from: "danggun", campaign_name: "summer" } },
      { utm: { media_from: "meta" } },
      { utm: null },
      {},
    ]);
    expect(facets.map((f) => f.key)).toEqual(["media_from", "campaign_name"]);
    expect(facets[0].values).toEqual([
      { value: "danggun", count: 2 },
      { value: "meta", count: 1 },
    ]);
  });

  it("리드에 유입 파라미터가 하나도 없으면 빈 배열 — 필터 UI 를 숨긴다", () => {
    expect(buildUtmFacets([{ utm: null }, {}])).toEqual([]);
  });

  it("빈 문자열·공백 값은 세지 않는다(빈 칸이 드롭다운에 뜨지 않게)", () => {
    expect(buildUtmFacets([{ utm: { media_from: "  " } }])).toEqual([]);
  });
});

describe("sortUtmFacets", () => {
  it("서버 순서(표준 UTM 먼저)를 화면 순서(자체 3개 먼저)로 바꾼다", () => {
    const sorted = sortUtmFacets([
      { key: "source", values: [] },
      { key: "media_from", values: [] },
      { key: "campaign_name", values: [] },
    ]);
    expect(sorted.map((f) => f.key)).toEqual(["media_from", "campaign_name", "source"]);
  });
});

describe("trackingKeyLabel", () => {
  it("아는 키는 한국어 라벨, 모르는 키는 키 그대로", () => {
    expect(trackingKeyLabel("media_from")).toBe("광고 매체");
    expect(trackingKeyLabel("unknown_key")).toBe("unknown_key");
  });
});
