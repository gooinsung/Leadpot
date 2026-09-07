/**
 * HTML 블록 정화(sanitize) — "구글 광고용" 랜딩(`google_ads_safe`)에만 선택 적용한다(§5-4·5-5).
 *
 * <p>목적은 완벽한 XSS 방어가 아니다(그건 이미 신뢰하는 랜딩 소유자 본인이 작성한 콘텐츠다 —
 * HtmlBlock.tsx 주석 참고). 목적은 **구글 광고 심사가 "손상된 사이트"·"시스템 우회"로 잡아내는
 * 신호(임의 스크립트 실행)를 랜딩 소유자가 스스로 끌 수 있게** 하는 것이다.
 *
 * <p>제거 대상: `<script>`, `<iframe>`, 인라인 이벤트 핸들러(`onerror`·`onclick` 등),
 * `javascript:` 스킴 링크. 마크업(텍스트·이미지·스타일)은 그대로 둔다.
 *
 * <p>⚠️ 정규식 기반이다 — 진짜 HTML 파서가 아니다. Workers/Node 어디서나 의존성 없이 돌아가야 해서
 * 이렇게 했다(브라우저 DOM 이 없는 SSR 환경도 지원). 완전한 HTML 파서가 필요해지면
 * (예: `<div class="a>b">` 처럼 속성값에 `>` 가 들어간 경계 케이스) 그때 교체한다.
 */
export function sanitizeHtml(html: string): string {
  let out = html;

  // <script> ... </script> 통째로 제거 (self-closing 은 실무상 없지만 방어적으로 함께 처리)
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<script\b[^>]*\/?>/gi, "");

  // <iframe> ... </iframe> 통째로 제거
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "");
  out = out.replace(/<iframe\b[^>]*\/?>/gi, "");

  // 인라인 이벤트 핸들러 속성 제거: onXxx="..." / onXxx='...' / onXxx=... (따옴표 없는 값)
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // href/src 의 javascript: 스킴 무력화
  out = out.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");

  return out;
}
