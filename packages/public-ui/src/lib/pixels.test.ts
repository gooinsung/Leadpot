import { afterEach, describe, expect, it, vi } from "vitest";
import { firePixelLead, googleOnlyPixels, mergeFormPixels } from "./pixels";

describe("mergeFormPixels", () => {
  it("여러 폼의 픽셀 설정을 키별 첫 유효값 우선으로 합친다", () => {
    const forms = {
      "1": { trackingConfig: { google: "G-1", meta: "M-1" } },
      "2": { trackingConfig: { google: "G-2", kakao: "K-1" } },
    };
    expect(mergeFormPixels(forms)).toEqual({ google: "G-1", meta: "M-1", kakao: "K-1" });
  });

  it("트래킹 설정이 없는 폼은 건너뛴다", () => {
    const forms = { "1": {}, "2": { trackingConfig: null } };
    expect(mergeFormPixels(forms)).toEqual({});
  });

  it("빈 문자열 값은 무시한다", () => {
    const forms = { "1": { trackingConfig: { google: "", meta: "M-1" } } };
    expect(mergeFormPixels(forms)).toEqual({ meta: "M-1" });
  });
});

describe("googleOnlyPixels", () => {
  it("구글(google/googleAds)만 남기고 다른 매체는 제거한다", () => {
    const cfg = { google: "G-1", googleAds: "AW-1/LABEL", meta: "M-1", tiktok: "T-1", kakao: "K-1", daangn: "D-1", toss: "TO-1", naver: "s_1" };
    expect(googleOnlyPixels(cfg)).toEqual({ google: "G-1", googleAds: "AW-1/LABEL" });
  });

  it("구글 설정이 없으면 빈 객체를 반환한다", () => {
    expect(googleOnlyPixels({ meta: "M-1" })).toEqual({});
  });

  it("cfg 가 없어도 안전하게 빈 객체를 반환한다", () => {
    expect(googleOnlyPixels(null)).toEqual({});
    expect(googleOnlyPixels(undefined)).toEqual({});
  });
});

describe("firePixelLead — 네이버", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubWcs() {
    const trans = vi.fn();
    const win: Record<string, unknown> = { wcs: { trans } };
    vi.stubGlobal("window", win);
    return { trans, win };
  }

  it("전환 유형 미설정이면 lead 로 wcs.trans 를 호출하고 공통키를 wcs_add 에 싣는다", () => {
    const { trans, win } = stubWcs();
    firePixelLead({ naver: "s_abc" });
    expect(trans).toHaveBeenCalledWith({ type: "lead" });
    expect((win.wcs_add as Record<string, string>).wa).toBe("s_abc");
  });

  it("리드폼에서 고른 전환 유형을 그대로 보낸다", () => {
    const { trans } = stubWcs();
    firePixelLead({ naver: "s_abc", naverEvent: "sign_up" });
    expect(trans).toHaveBeenCalledWith({ type: "sign_up" });
  });

  it("공통키가 없으면 보내지 않는다", () => {
    const { trans } = stubWcs();
    firePixelLead({ meta: "M-1" });
    expect(trans).not.toHaveBeenCalled();
  });
});
