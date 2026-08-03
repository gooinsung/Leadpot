import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 기기 미리보기 틀 — 자식을 **iframe 안에** 렌더한다.
 *
 * **왜 iframe 인가**: 예전 미리보기는 그냥 `max-width: 360px` 박스였다. 박스만 좁힌 것이라
 * `@media (max-width: 768px)` 는 **브라우저 창 폭**(예: 1280px)을 보고 적용되지 않았고,
 * 그래서 실제 폰에서는 멀쩡한 랜딩이 미리보기에서만 글자가 넘쳐 보였다.
 * iframe 은 **자기만의 뷰포트**를 가지므로 폭을 375px 로 주면 미디어쿼리가 실제 폰과 똑같이 평가된다.
 *
 * 덤으로 얻는 것:
 * - `position: fixed` 플로팅 헤더가 **미리보기 화면 기준**으로 붙는다(관리자 UI 를 덮지 않는다).
 * - 블록 스크립트의 `document` 가 iframe 문서라 관리자 화면과 완전히 분리된다.
 *
 * 앱 스타일시트는 부모 문서에서 복사해 넣는다(공개 랜딩과 같은 룩을 유지하기 위해).
 */
export function DevicePreviewFrame({
  width,
  fitHeight,
  children,
  title = "미리보기",
}: {
  /** iframe 뷰포트 폭(px). 이 값이 미디어쿼리 기준이 된다. */
  width: number;
  /**
   * 화면에서 차지할 높이(px). 축소된 뒤의 최종 높이다.
   * 기기 높이는 `fitHeight / scale` 로 잡아, 축소해도 이만큼 보이게 한다.
   * 스크롤은 **iframe 안에서만** 일어난다(바깥 스테이지는 스크롤하지 않는다 — 이중 스크롤 방지).
   */
  fitHeight: number;
  children: ReactNode;
  title?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);

  // 패널보다 넓은 기기(PC 1280px 등)는 실제 폭으로 렌더한 뒤 축소해서 보여준다.
  // 폭을 줄이는 게 아니라 축소하는 것이라 미디어쿼리는 실제 기기 폭 그대로 평가된다.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => setScale(Math.min(1, wrap.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;

    // about:blank 문서를 우리 앱 스타일로 채운다.
    doc.open();
    doc.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
    doc.close();

    copyStyles(document, doc);

    // 공개 랜딩과 같은 기본값(여백 0 · 흰 배경 · 세로 스크롤).
    const base = doc.createElement("style");
    base.textContent = `
      html, body { margin: 0; padding: 0; background: #fff; }
      body { -webkit-text-size-adjust: 100%; }
    `;
    doc.head.appendChild(base);

    setMountNode(doc.body);
    return () => setMountNode(null);
    // width 가 바뀌면 iframe 을 다시 만들지 않고 폭만 바꾼다(문서 유지).
  }, []);

  return (
    <div ref={wrapRef} className="lp-device-wrap" style={{ height: fitHeight }}>
      <iframe
        ref={frameRef}
        title={title}
        className="lp-device-frame"
        style={{ width, height: fitHeight / scale, transform: `scale(${scale})` }}
        // 같은 오리진이어야 부모 스타일 복사·포털이 가능하다. 스크립트는 허용(블록 JS 실행).
        sandbox="allow-scripts allow-same-origin"
      />
      {mountNode ? createPortal(children, mountNode) : null}
    </div>
  );
}

/** 부모 문서의 스타일시트를 iframe 문서로 복사한다(link 는 그대로, style 은 내용째). */
function copyStyles(from: Document, to: Document) {
  for (const node of Array.from(from.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (node.tagName === "LINK") {
      const link = to.createElement("link");
      link.rel = "stylesheet";
      link.href = (node as HTMLLinkElement).href;
      to.head.appendChild(link);
    } else {
      const style = to.createElement("style");
      style.textContent = node.textContent;
      to.head.appendChild(style);
    }
  }
}
