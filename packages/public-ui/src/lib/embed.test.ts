import { describe, expect, it } from "vitest";
import { allowIframeScroll } from "./embed";

describe("allowIframeScroll", () => {
  it("iframe 의 scrolling=no 를 auto 로 바꾼다(따옴표 유무·대소문자 무관)", () => {
    expect(allowIframeScroll('<iframe src="a" scrolling="no" height="600"></iframe>')).toBe('<iframe src="a" scrolling="auto" height="600"></iframe>');
    expect(allowIframeScroll("<IFRAME src='a' SCROLLING='NO'></IFRAME>")).toBe("<IFRAME src='a' scrolling=\"auto\"></IFRAME>");
    expect(allowIframeScroll('<iframe src="a" scrolling=no>')).toBe('<iframe src="a" scrolling="auto">');
  });

  it("iframe 이 아닌 태그나 다른 값은 건드리지 않는다", () => {
    const html = '<div scrolling="no"></div><iframe src="b" scrolling="yes"></iframe><iframe src="c" data-scrolling="none"></iframe>';
    expect(allowIframeScroll(html)).toBe(html);
  });
});
