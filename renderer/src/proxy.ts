import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 호스트 기반 라우팅. Next.js는 파일시스템 기반 라우팅이라 호스트를 직접 구분하지 못하므로,
 * 여기서 Host 헤더를 읽어 내부 경로로 바꿔준다.
 *
 * - `{sub}.lead-pot.com/{identifier}` → 공개 랜딩 **본 호스트** → `/site/{sub}/{identifier}` 로 재작성.
 * - `go.lead-pot.com/{sub}/{identifier}` → 구 고정 호스트(2026-09-09~09-22 한시 운영) →
 *   `{sub}.lead-pot.com/{identifier}` 로 **302 리다이렉트**만 하고 콘텐츠는 안 준다.
 *
 * ⚠️ **2026-09-22 방향 전환**: 2026-09-09에 구글 광고 심사(gTech)가 고객 서브도메인을 "손상된
 * 사이트"로 오판한 사고 때문에 `go.lead-pot.com/{sub}/{id}` 고정 호스트로 옮겼었다. 그러나 그
 * 뒤로도 구글 승인은 끝내 나지 않았고(= 서브도메인이 원인이라는 가설이 검증되지 않았다),
 * 서브도메인 주소가 고객 신뢰도 면에서 낫다는 판단으로 **사용자 지시에 따라 되돌렸다**.
 * 구 `go` 주소는 이미 각 광고 플랫폼 Final URL에 박혀 있으므로 계속 살려두되 리다이렉트만 한다.
 *
 * 🔴 **왜 301이 아니라 302인가**: 2주 사이 URL 구조를 두 번 뒤집었다. 301(영구)은 브라우저가
 * 사실상 무기한 캐시하므로, 지난 전환 때 심어둔 `{sub}→go` 301 캐시를 가진 브라우저가 이번
 * `go→{sub}` 리다이렉트와 만나면 무한 루프(ERR_TOO_MANY_REDIRECTS)가 된다. 여기서 또 301을
 * 심으면 다음에 손댈 수 없으므로 302(임시)로 둔다. 공개 랜딩은 재방문이 거의 없어 캐시 이득도
 * 사실상 없다.
 *
 * 예약 호스트 판정은 frontend `@leadpot/public-ui` 의 `currentSubdomain()`(lib/site.ts) 과
 * 반드시 같게 유지한다 — 여기 목록이 어긋나면 app/api 같은 관리용 호스트가 실수로 고객
 * 서브도메인으로 잘못 해석될 수 있다.
 *
 * ⚠️ **"Cloudflare 가 app/api/www 를 걸러줄 것"이라는 가정은 틀렸다(2026-09-08 실제 장애로 확인)**.
 * Workers 라우트 `*.lead-pot.com/*` 는 와일드카드라 `app.lead-pot.com` 도 그대로 매칭해서 이
 * 워커로 들여보낸다 — DNS/커스텀 도메인 설정과 무관하게, 라우트가 걸려 있는 한 항상 그렇다.
 * 그래서 `app` 은 아래 `proxyToAdminApp()` 로 실제 관리 앱(Cloudflare Pages)에 그대로 리버스
 * 프록시한다 — Cloudflare 라우팅 우선순위에 기대지 않고 코드로 확실하게 보장한다.
 * `api`·`www`·`admin`·`dashboard` 는 실제 서비스 중인 랜딩 콘텐츠가 없어 플레이스홀더로 충분하다.
 */
const RESERVED_HOSTS = new Set(["www", "api", "admin", "dashboard", "go"]);

/** 관리 앱(Cloudflare Pages)의 진짜 오리진 — 커스텀 도메인이 아니라 항상 살아있는 *.pages.dev 를 쓴다. */
const ADMIN_APP_ORIGIN = process.env.ADMIN_APP_ORIGIN || "https://leadpot-app.pages.dev";

/**
 * 구 공개 랜딩 고정 호스트 — 2026-09-09~09-22 사이에만 본 호스트였다. 지금은 콘텐츠를 서빙하지
 * 않고 `{sub}.도메인/{identifier}` 로 302 리다이렉트만 한다({@link redirectToSubdomainHost}).
 *
 * 없애지 않는 이유: 이 기간에 구글 광고·당근광고 등의 캠페인 Final URL이 이미 이 형식
 * (`go.lead-pot.com/{sub}/{id}`)으로 갱신됐다. 지우면 실행 중인 광고가 즉시 깨진다.
 */
const LEGACY_PUBLIC_SITE_HOST = "go";

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

/**
 * 구 고정 호스트 `go.도메인/{subdomain}/{identifier...}` 로 들어온 요청을 본 호스트
 * `{subdomain}.도메인/{identifier...}` 로 302 리다이렉트한다(쿼리스트링 보존 — 광고 URL의
 * utm/gclid 가 날아가면 통계가 끊긴다).
 *
 * 식별자가 없는 `/{subdomain}` 이나 루트 `/` 도 그대로 넘긴다 — 목적지에서 재작성을 거쳐
 * 매칭되는 라우트가 없어 Next 기본 404 가 되며, 이는 서브도메인 시절과 같은 결과다.
 */
function redirectToSubdomainHost(request: NextRequest, host: string): Response {
  const [subdomain, ...rest] = request.nextUrl.pathname.split("/").filter(Boolean);
  // "go.도메인/" — 보낼 서브도메인 자체가 없다. 재작성 없이 통과시켜 플레이스홀더/404 로 둔다.
  if (!subdomain) return NextResponse.next();

  const [hostname, port] = host.split(":");
  // "go.lead-pot.com" → "lead-pot.com" (첫 라벨만 벗겨낸다 — publicSiteUrl() 과 같은 방식)
  const base = hostname.split(".").slice(1).join(".");
  const portPart = port ? `:${port}` : "";
  const target = new URL(`${request.nextUrl.protocol}//${subdomain}.${base}${portPart}`);
  target.pathname = `/${rest.join("/")}`;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 302);
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const firstLabel = hostname.split(".")[0];

  // "app.lead-pot.com" 또는 로컬 테스트용 "app.localhost" — 첫 라벨이 정확히 "app" 일 때만.
  // (서브도메인 이름이 우연히 "app"으로 시작하는 경우, 예: "application.lead-pot.com" 과 혼동하지
  // 않도록 split(".")[0] 로 정확히 첫 라벨만 비교한다.)
  if (firstLabel === "app") {
    // 단, /f/{id}(단독 공개 리드폼)는 예외 — 이 렌더러 자신이 SSR 로 처리한다
    // (app/f/[identifier]/page.tsx, 2026-09-08). 그 외 모든 app 경로(로그인·대시보드 등
    // 관리 화면)만 실제 관리 앱(Pages)으로 프록시한다.
    if (request.nextUrl.pathname.startsWith("/f/")) {
      return NextResponse.next();
    }
    return proxyToAdminApp(request);
  }

  // "go.lead-pot.com" — 구 고정 호스트. 콘텐츠를 직접 주지 않고 본 호스트로 302 리다이렉트.
  if (firstLabel === LEGACY_PUBLIC_SITE_HOST) {
    return redirectToSubdomainHost(request, host);
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
