import { describe, expect, it } from "vitest";
import { hydrateLiveMarkers } from "./liveMarkers";

const live = { count: 37, recent: [] };

describe("hydrateLiveMarkers", () => {
  it("실시간 신청수 마커를 실제 값으로 채운다", () => {
    const html = '<p>지금까지 <span data-lp-live="count">0</span>명이 신청했어요!</p>';
    expect(hydrateLiveMarkers(html, live)).toBe(
      '<p>지금까지 <span data-lp-live="count">37</span>명이 신청했어요!</p>',
    );
  });

  it("남은 자리 마커를 target - count 로 채운다", () => {
    const html = '<p>남은 자리 <span data-lp-live="slots" data-target="100">100</span>개</p>';
    expect(hydrateLiveMarkers(html, live)).toBe(
      '<p>남은 자리 <span data-lp-live="slots" data-target="100">63</span>개</p>',
    );
  });

  it("신청수가 target 을 넘으면 0 아래로 내려가지 않는다", () => {
    const html = '<span data-lp-live="slots" data-target="10">10</span>';
    expect(hydrateLiveMarkers(html, { count: 999, recent: [] })).toBe(
      '<span data-lp-live="slots" data-target="10">0</span>',
    );
  });

  it("천 단위 콤마를 붙인다", () => {
    const html = '<span data-lp-live="count">0</span>';
    expect(hydrateLiveMarkers(html, { count: 12345, recent: [] })).toBe(
      '<span data-lp-live="count">12,345</span>',
    );
  });

  it("마커가 없는 HTML 은 그대로 둔다", () => {
    const html = "<p>그냥 텍스트</p>";
    expect(hydrateLiveMarkers(html, live)).toBe(html);
  });

  it("여러 마커를 한 문자열 안에서 전부 채운다", () => {
    const html =
      '<span data-lp-live="count">0</span> / <span data-lp-live="slots" data-target="50">50</span>';
    expect(hydrateLiveMarkers(html, live)).toBe(
      '<span data-lp-live="count">37</span> / <span data-lp-live="slots" data-target="50">13</span>',
    );
  });
});
