/**
 * 외부 폼(EMBED 블록)을 오버레이/풀스크린에 띄울 때 — iframe 의 `scrolling="no"` 를 `auto` 로 바꾼다.
 *
 * 외부 폼 서비스의 퍼가기 코드엔 `scrolling="no"` 가 흔히 들어 있다(자기 페이지에선 높이를 내용에 맞춰 쓰는 전제).
 * 우리 창은 화면 높이로 고정되므로 그대로 두면 iframe 안 폼이 잘리고, 휠·터치가 뒤 페이지로 넘어가
 * "모달 대신 메인 페이지가 스크롤"된다(2026-10-20 실사용 제보). 이 속성은 CSS 로 덮을 수 없고 붙인 뒤
 * 바꾸면 브라우저마다 반영이 달라서, 렌더하기 전에 코드 문자열에서 바꾼다.
 */
export function allowIframeScroll(html: string): string {
  return html.replace(/(<iframe\b[^>]*?)\sscrolling\s*=\s*(["']?)no\2(?=[\s/>])/gi, '$1 scrolling="auto"');
}
