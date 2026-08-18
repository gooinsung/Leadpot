import { describe, expect, it } from "vitest";
import { AD_PARAM_KEYS, buildAdUrl } from "./adUrl";
import { parseUtm } from "./utm";

const BASE = "https://bali.lead-pot.com/17";

describe("buildAdUrl", () => {
  it("값이 있는 파라미터만 붙인다", () => {
    expect(buildAdUrl(BASE, { media_from: "danggun", campaign_name: "test-campaign" })).toBe(
      `${BASE}?media_from=danggun&campaign_name=test-campaign`,
    );
  });

  it("빈 값·공백만 있는 값은 붙이지 않는다", () => {
    expect(buildAdUrl(BASE, { media_from: "meta", campaign_name: "", ads_name: "   " })).toBe(
      `${BASE}?media_from=meta`,
    );
  });

  it("값 앞뒤 공백은 잘라낸다 — 붙여넣기 실수로 통계가 갈리지 않게", () => {
    expect(buildAdUrl(BASE, { media_from: "  meta  " })).toBe(`${BASE}?media_from=meta`);
  });

  it("아무 값도 없으면 원본 주소를 그대로 돌려준다", () => {
    expect(buildAdUrl(BASE, {})).toBe(BASE);
  });

  it("한글·공백이 든 값은 인코딩해서 붙인다(그대로 넣으면 주소가 깨진다)", () => {
    const url = buildAdUrl(BASE, { ads_name: "소재 A" });

    expect(url).not.toContain("소재 A");
    expect(new URL(url).searchParams.get("ads_name")).toBe("소재 A");
  });

  it("원본에 이미 쿼리가 있으면 & 로 이어 붙인다", () => {
    expect(buildAdUrl(`${BASE}?preview=1`, { media_from: "google" })).toBe(
      `${BASE}?preview=1&media_from=google`,
    );
  });

  it("붙는 순서는 AD_PARAM_KEYS 순서로 고정된다", () => {
    const url = buildAdUrl(BASE, { ads_name: "c", campaign_name: "b", media_from: "a" });
    expect(url).toBe(`${BASE}?media_from=a&campaign_name=b&ads_name=c`);
  });
});

/**
 * 빌더가 만든 주소를 수집 쪽이 실제로 읽어내는지 — 두 모듈이 같은 키를 쓰는지 확인한다.
 * 여기가 어긋나면 광고를 돌려도 리드에 출처가 비어 있고, 그걸 알아챌 방법이 없다.
 *
 * `parseUtm()` 은 `window.location.search` 를 읽는다. 이 프로젝트의 vitest 는 jsdom 없이
 * node 환경으로 돌기 때문에(계산기 테스트가 전부 순수 함수라 필요가 없었다) window 를 직접 세운다.
 */
describe("빌더 → 수집 왕복", () => {
  function withSearch(search: string, fn: () => void) {
    const g = globalThis as { window?: unknown };
    const had = "window" in g;
    const prev = g.window;
    g.window = { location: { search } };
    try {
      fn();
    } finally {
      if (had) g.window = prev;
      else delete g.window;
    }
  }

  it("만든 주소를 parseUtm 이 그대로 되읽는다", () => {
    const values = { media_from: "danggun", campaign_name: "여름-캠페인", ads_name: "소재 A" };
    const url = buildAdUrl(BASE, values);

    withSearch(new URL(url).search, () => {
      expect(parseUtm()).toEqual(values);
    });
  });

  it("표준 UTM 과 광고 파라미터를 함께 붙여도 서로 덮어쓰지 않는다", () => {
    withSearch("?utm_source=meta&utm_campaign=std&media_from=danggun&campaign_name=own", () => {
      expect(parseUtm()).toEqual({
        source: "meta",
        campaign: "std",
        media_from: "danggun",
        campaign_name: "own",
      });
    });
  });

  it("허용 목록에 없는 파라미터는 수집하지 않는다", () => {
    withSearch("?from=danggun&hacked=x", () => {
      expect(parseUtm()).toEqual({});
    });
  });
});

it("키 목록이 3개로 유지된다 — 늘릴 때는 utm.ts·TrackingParams 도 함께 고쳐야 한다", () => {
  expect(AD_PARAM_KEYS).toEqual(["media_from", "campaign_name", "ads_name"]);
});
