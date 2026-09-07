import type { LandingLive } from "../api/client";

/**
 * `data-lp-live` 마커가 박힌 HTML 블록 문자열에 실제 값을 채워 넣는다 — **문자열 단계**에서
 * 치환하므로 SSR(서버가 만드는 원본 HTML)·CSR(브라우저) 어디서나 똑같이 동작한다.
 *
 * ⚠️ 왜 이게 필요한가(2026-09 Phase 3 에서 발견, docs/SSR-LANDING-PLAN.md §Phase 2·3):
 * 예전에는 `LandingView`가 렌더된 **DOM 을 나중에 `querySelectorAll`+`textContent` 로 고쳐썼다**.
 * 이 방식은 브라우저에서는 잘 보이지만, **크롤러가 받는 원본 HTML 문자열에는 반영되지 않는다**
 * (`0명`·`100개` 같은 초기 템플릿 값이 그대로 노출됨 — 구글 광고 "시스템 우회" 판정의 원인 중 하나였다).
 * 그래서 DOM 을 고치는 대신 **HTML 블록의 문자열 자체를 렌더 전에 바꾼다** — SSR 이면 서버가 만드는
 * HTML 에 실제 숫자가 이미 박히고, CSR 이면 `live` state 가 갱신될 때 `LandingView` 가 다시 렌더되며
 * 새 문자열이 `HtmlBlock` 에 전달돼 똑같이 반영된다(별도 DOM 조작 코드가 필요 없다).
 *
 * 마커 형식은 `lib/dynamicSnippets.ts` 가 만드는 그대로다:
 *   `<span data-lp-live="count">0</span>`
 *   `<span data-lp-live="slots" data-target="100">100</span>`
 *
 * ⚠️ 정규식 기반이다(`sanitizeHtml.ts` 와 같은 이유 — Workers/Node 어디서나 의존성 없이 동작해야
 * 한다). 마케터가 마커의 속성 순서를 손으로 바꾸는 등 형식을 벗어나면 치환이 안 될 수 있는데,
 * 이 경우 원래 템플릿 값이 그대로 보일 뿐 렌더가 깨지지는 않는다(안전한 실패).
 */
export function hydrateLiveMarkers(html: string, live: LandingLive): string {
  if (!html.includes("data-lp-live")) return html;

  let out = html.replace(
    /(data-lp-live="count"[^>]*>)[^<]*(<)/g,
    (_m, open: string, close: string) => `${open}${live.count.toLocaleString("ko-KR")}${close}`,
  );

  out = out.replace(
    /(data-lp-live="slots"[^>]*data-target="(\d+)"[^>]*>)[^<]*(<)/g,
    (_m, open: string, target: string, close: string) =>
      `${open}${Math.max(0, Number(target) - live.count)}${close}`,
  );

  return out;
}
