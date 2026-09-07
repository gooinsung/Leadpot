import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 서브도메인 라우팅 — {sub}.lead-pot.com/{identifier} 를 /site/{sub}/{identifier} 로 재작성한다.
 * Next.js 는 파일시스템 기반 라우팅이라 서브도메인을 직접 구분하지 못하므로, 여기서 Host 헤더를
 * 읽어 내부 경로로 바꿔준다. 예약 호스트 판정은 frontend `@leadpot/public-ui` 의
 * `currentSubdomain()`(lib/site.ts) 과 반드시 같게 유지한다 — 여기 목록이 어긋나면
 * app/api 같은 관리용 호스트가 실수로 이 렌더러에 걸릴 수 있다.
 *
 * ⚠️ 실제 운영에서는 Cloudflare 라우팅이 `app`·`api`·`www` 를 개별 DNS 레코드로 먼저 걸러내므로
 * 이 워커는 사실상 항상 유효한 서브도메인만 받는다(docs/SSR-LANDING-PLAN.md §4). 이 코드는
 * 로컬 개발·직접 접속 등 그 경로를 안 거치는 경우의 방어선이다.
 */
const RESERVED_HOSTS = new Set(["www", "app", "api", "admin", "dashboard"]);

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;

  const parts = hostname.split(".");
  let sub: string | null = null;
  if (parts[parts.length - 1] === "localhost" && parts.length >= 2) {
    sub = parts[0]; // bali.localhost → "bali"
  } else if (parts.length >= 3) {
    sub = parts[0]; // bali.lead-pot.com → "bali"
  }

  if (!sub || RESERVED_HOSTS.has(sub)) return null;
  return sub;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(host);

  // 서브도메인이 없거나 예약 호스트 — 이 렌더러가 처리할 대상이 아니다. 그대로 통과시켜
  // app/page.tsx(플레이스홀더) 또는 Next 기본 404 로 떨어지게 둔다.
  if (!subdomain) return NextResponse.next();

  // "/12" → "/site/bali/12". 루트("/", 식별자 없음)는 재작성해도 매칭되는 라우트가 없어
  // Next 기본 404 로 떨어진다 — frontend App.tsx 의 "루트는 404" 규칙과 동일한 결과.
  const url = request.nextUrl.clone();
  url.pathname = `/site/${subdomain}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // 정적 자산·Next 내부 경로는 재작성 대상에서 뺀다.
  matcher: ["/((?!_next/|favicon\\.ico$).*)"],
};
