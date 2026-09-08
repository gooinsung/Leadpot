/**
 * 서브도메인 랜딩 라우트(`site/[subdomain]/[identifier]`)의 `identifier` 동적 세그먼트 정규화.
 *
 * 🔴 **실측 버그(2026-09-08)**: `proxy.ts` 가 `NextResponse.rewrite()` 로 넘긴 요청에서, 한글 등
 * 비ASCII 슬러그가 `generateMetadata()` 에는 디코딩된 원문으로, 같은 요청의 페이지 본문
 * 컴포넌트에는 URL-인코딩된 그대로(`%EA%B0%9C...`) 전달되는 불일치가 확인됐다 — 같은 페이지의
 * 두 진입점이 Next 내부적으로 서로 다른 디코딩 단계를 거친다. 후자의 경우 `resolveSite()` 가
 * 내부에서 다시 `encodeURIComponent()` 를 걸어 이중 인코딩(`%25EA%25B0...`)이 되고, 백엔드가
 * 이 문자열을 실제 슬러그로 찾지 못해 랜딩 조회가 깨진다(그리고 `error.tsx` 클라이언트 폴백도
 * 브라우저에서 같은 `identifier` 값으로 같은 호출을 하므로 동일하게 실패한다).
 *
 * 원인을 Next 내부에서 고치는 대신, 여기서 방어적으로 정규화한다: 이미 디코딩된 순수 텍스트(숫자
 * ID·정상적으로 디코딩된 슬러그)는 `%` 문자가 없어 `decodeURIComponent` 가 항등(no-op)이고,
 * 인코딩된 채로 들어온 값만 실제로 디코딩되어 원문을 복원한다.
 */
export function normalizeIdentifier(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    // 잘못된 %-이스케이프(디코딩 불가) — 원본 그대로 둔다. resolveSite 가 이후 그대로 인코딩해
    // 백엔드에 전달하고, 백엔드가 못 찾으면 정상적으로 404 로 처리된다.
    return raw;
  }
}
