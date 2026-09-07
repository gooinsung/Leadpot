import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("script 태그를 통째로 제거한다", () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe("<p>hi</p>");
  });

  it("여러 줄 script 도 제거한다", () => {
    const html = "<div>a</div>\n<script>\nconsole.log(1)\n</script>\n<div>b</div>";
    expect(sanitizeHtml(html)).toBe("<div>a</div>\n\n<div>b</div>");
  });

  it("속성이 붙은 script 태그도 제거한다", () => {
    expect(sanitizeHtml('<script src="https://evil.example/x.js"></script><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("iframe 을 통째로 제거한다", () => {
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("인라인 이벤트 핸들러를 제거한다(img onerror)", () => {
    expect(sanitizeHtml('<img src="x.png" onerror="alert(1)">')).toBe('<img src="x.png">');
  });

  it("따옴표 없는 이벤트 핸들러도 제거한다", () => {
    expect(sanitizeHtml("<div onclick=doEvil()>x</div>")).toBe("<div>x</div>");
  });

  it("javascript: 링크를 무력화한다", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a href="#">click</a>');
  });

  it("정상 마크업·스타일은 그대로 둔다", () => {
    const html = '<p style="color:red" class="foo">지금까지 <span data-lp-live="count">0</span>명이 신청했어요!</p>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});
