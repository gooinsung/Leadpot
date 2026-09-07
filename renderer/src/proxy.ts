import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 서브도메인 라우팅 — {sub}.lead-pot.com/{identifier} 를 /site/{sub}/{identifier} 로 재작성한다.
 * Next.js 는 파일시스템 기반 라우팅이라 서브도메인을 직접 구분하지 못하므로, 여기서 Host 헤더를
 * 읽어 내부 경로로 바꿔준다. 예약 호스트 판정은 frontend `@leadpot/public-ui` 의
 * `currentSubdomain()`(lib/site.ts) 과 반드시 같게 유지한다 — 여기 목록이 어긋나면
 * app/api 같은 관리용 호스트가 실수로 이 렌더러에 걸릴 수 있다.
 *
 * ⚠️ **"Cloudflare 가 app/api/www 를 걸러줄 것"이라는 가정은 틀렸다(2026-09-08 실제 장애로 확인)**.
 * Workers 라우트 `*.lead-pot.com/*` 는 와일드카드라 `app.lead-pot.com` 도 그대로 매칭해서 이
 * 워커로 들여보낸다 — DNS/커스텀 도메인 설정과 무관하게, 라우트가 걸려 있는 한 항상 그렇다.
 * 그래서 `app` 은 더 이상 "플레이스홀더만 보여주고 끝"이 아니라, 아래 `proxyToAdminApp()` 로
 * 실제 관리 앱(Cloudflare Pages)에 그대로 리버스 프록시한다 — Cloudflare 라우팅 우선순위에
 * 기대지 않고 코드로 확실하게 보장한다. `api`·`www`·`admin`·`dashboard` 는 실제 서비스 중인
 * 랜딩 콘텐츠가 없어 플레이스홀더로 충분하다(운영에서 이 호스트로 들어올 일이 없다).
 */
const RESERVED_HOSTS = new Set(["www", "api", "admin", "dashboard"]);

/** 관리 앱(Cloudflare Pages)의 진짜 오리진 — 커스텀 도메인이 아니라 항상 살아있는 *.pages.dev 를 쓴다. */
const ADMIN_APP_ORIGIN = process.env.ADMIN_APP_ORIGIN || "https://leadpot-app.pages.dev";

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

/**
 * app.lead-pot.com 요청을 실제 관리 앱(Cloudflare Pages)으로 그대로 넘긴다(리버스 프록시).
 * 이 워커가 app 요청을 받는 일 자체가 원래는 없어야 하지만(§4 와일드카드 라우트가 잘못 걸리는
 * 사고, 2026-09-08), 받더라도 서비스가 안 깨지도록 하는 안전장치다.
 */
async function proxyToAdminApp(request: NextRequest): Promise<Response> {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, ADMIN_APP_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host"); // fetch 가 target 기준으로 알아서 올바르게 설정한다.
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
    // @ts-expect-error Cloudflare Workers 런타임 fetch 는 스트리밍 바디에 duplex 를 요구한다.
    duplex: "half",
  });
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];

  // "app.lead-pot.com" 또는 로컬 테스트용 "app.localhost" — 첫 라벨이 정확히 "app" 일 때만.
  // (서브도메인 이름이 우연히 "app"으로 시작하는 경우, 예: "application.lead-pot.com" 과 혼동하지
  // 않도록 split(".")[0] 로 정확히 첫 라벨만 비교한다.)
  if (hostname.split(".")[0] === "app") {
    return proxyToAdminApp(request);
  }

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
