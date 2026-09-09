import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 호스트 기반 라우팅. Next.js는 파일시스템 기반 라우팅이라 호스트를 직접 구분하지 못하므로,
 * 여기서 Host 헤더를 읽어 내부 경로로 바꿔준다.
 *
 * - `go.lead-pot.com/{sub}/{identifier}` → 공개 랜딩 고정 호스트(2026-09-09~, 아래
 *   `PUBLIC_SITE_HOST` 참고) → `/site/{sub}/{identifier}` 로 재작성.
 * - `{sub}.lead-pot.com/{identifier}` → 구 서브도메인 호스트(전환기 한시적 지원) →
 *   `go.lead-pot.com/{sub}/{identifier}` 로 301 리다이렉트만 하고 콘텐츠는 안 준다.
 *
 * 예약 호스트 판정은 frontend `@leadpot/public-ui` 의 `currentSubdomain()`(lib/site.ts) 과
 * 반드시 같게 유지한다 — 여기 목록이 어긋나면 app/api 같은 관리용 호스트가 실수로 이
 * 렌더러의 "구 서브도메인" 경로로 잘못 빠질 수 있다.
 *
 * ⚠️ **"Cloudflare 가 app/api/www 를 걸러줄 것"이라는 가정은 틀렸다(2026-09-08 실제 장애로 확인)**.
 * Workers 라우트 `*.lead-pot.com/*` 는 와일드카드라 `app.lead-pot.com` 도 그대로 매칭해서 이
 * 워커로 들여보낸다 — DNS/커스텀 도메인 설정과 무관하게, 라우트가 걸려 있는 한 항상 그렇다.
 * 그래서 `app` 은 더 이상 "플레이스홀더만 보여주고 끝"이 아니라, 아래 `proxyToAdminApp()` 로
 * 실제 관리 앱(Cloudflare Pages)에 그대로 리버스 프록시한다 — Cloudflare 라우팅 우선순위에
 * 기대지 않고 코드로 확실하게 보장한다. `api`·`www`·`admin`·`dashboard` 는 실제 서비스 중인
 * 랜딩 콘텐츠가 없어 플레이스홀더로 충분하다(운영에서 이 호스트로 들어올 일이 없다).
 */
const RESERVED_HOSTS = new Set(["www", "api", "admin", "dashboard", "go"]);

/** 관리 앱(Cloudflare Pages)의 진짜 오리진 — 커스텀 도메인이 아니라 항상 살아있는 *.pages.dev 를 쓴다. */
const ADMIN_APP_ORIGIN = process.env.ADMIN_APP_ORIGIN || "https://leadpot-app.pages.dev";

/**
 * 공개 랜딩 전용 고정 호스트 — 예전엔 고객마다 다른 서브도메인({sub}.lead-pot.com)을 썼지만,
 * 2026-09-09부터 전부 이 호스트 밑에서 **경로**로 구분한다: `go.lead-pot.com/{sub}/{identifier}`.
 *
 * 🔴 **왜 바꿨나**: 구글 광고 심사가 "손상된 사이트"로 `the-law.lead-pot.com`(고객 1명의 서브도메인)을
 * 콕 집어 악성 호스트로 판정한 사고(2026-09) 때문. 구글 등 보안/평판 시스템은 URL 단위가 아니라
 * "호스트" 단위로 신뢰도를 매기는데, 고객마다 새 서브도메인(=새 호스트)을 발급하는 구조에서는
 * 신규 고객마다 매번 평판 0에서 시작하고, 그중 한 명이라도 의심스러운 콘텐츠를 올리면 그 호스트
 * 전체(그 고객의 다른 모든 랜딩 포함)가 같이 낙인 찍힌다. 전부 고정 호스트 하나 밑의 경로로 옮기면
 * 구글 입장에서 우리는 "평판을 꾸준히 쌓아가는 사이트 1개"가 된다.
 *
 * 기존 서브도메인 호스트는 당분간 살려두되(이미 뿌려진 광고 URL 보호), 콘텐츠를 직접 서빙하지
 * 않고 이 호스트로 301 리다이렉트만 한다({@link redirectToPublicSiteHost}).
 */
const PUBLIC_SITE_HOST = "go";

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
 * `go.lead-pot.com/{subdomain}/{identifier...}` 를 `/site/{subdomain}/{identifier...}` 로
 * 재작성한다 — 서브도메인 시절과 내부적으로 완전히 같은 페이지(`site/[subdomain]/[identifier]`)를
 * 그대로 재사용한다(백엔드 API 계약도 `resolveSite(subdomain, identifier)` 그대로 안 바뀜).
 */
function rewritePublicSiteHost(request: NextRequest): Response {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const [subdomain, ...rest] = segments;
  // "/" 또는 "/{subdomain}" 만 있고 식별자가 없음 — 매칭되는 라우트가 없어 Next 기본 404.
  if (!subdomain) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/site/${subdomain}/${rest.join("/")}`;
  return NextResponse.rewrite(url);
}

/**
 * 구 서브도메인 호스트({sub}.lead-pot.com)로 들어온 요청을 새 고정 호스트로 301 리다이렉트한다
 * (전환기 한시적 조치 — 이미 뿌려진 광고 Final URL이 당장 깨지지 않도록).
 */
function redirectToPublicSiteHost(request: NextRequest, host: string, subdomain: string): Response {
  const [hostname, port] = host.split(":");
  // "the-law.lead-pot.com" → "lead-pot.com" (첫 라벨만 벗겨낸다 — publicSiteUrl() 과 같은 방식)
  const base = hostname.split(".").slice(1).join(".");
  const portPart = port ? `:${port}` : "";
  const target = new URL(`${request.nextUrl.protocol}//${PUBLIC_SITE_HOST}.${base}${portPart}`);
  target.pathname = `/${subdomain}${request.nextUrl.pathname}`;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 301);
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

  // "go.lead-pot.com" — 공개 랜딩 전용 고정 호스트(2026-09-09~). 경로의 첫 세그먼트가 subdomain.
  if (firstLabel === PUBLIC_SITE_HOST) {
    return rewritePublicSiteHost(request);
  }

  const subdomain = extractSubdomain(host);

  // 서브도메인이 없거나 예약 호스트 — 이 렌더러가 처리할 대상이 아니다. 그대로 통과시켜
  // app/page.tsx(플레이스홀더) 또는 Next 기본 404 로 떨어지게 둔다.
  if (!subdomain) return NextResponse.next();

  // 구 서브도메인 호스트 — 콘텐츠를 직접 서빙하지 않고 새 고정 호스트로 301 리다이렉트한다.
  return redirectToPublicSiteHost(request, host, subdomain);
}

export const config = {
  // 정적 자산·Next 내부 경로는 재작성 대상에서 뺀다.
  matcher: ["/((?!_next/|favicon\\.ico$).*)"],
};
