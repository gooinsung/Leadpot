/**
 * 공개 사이트(서브도메인) 라우팅 판별.
 * - 관리자 앱: localhost / IP / app.도메인 / www.도메인 등 → null
 * - 사용자 서브도메인: bali.localhost / bali.lead-pot.com → "bali"
 *
 * 로컬 검증: 브라우저에서 `bali.localhost:5173/12` 로 접속하면 *.localhost 가 127.0.0.1 로 잡힌다.
 *
 * ⚠️ SSR(Next.js/Cloudflare Workers)에서는 `window` 가 없다 — 렌더러는 요청의 `Host` 헤더를
 * `hostname` 인자로 넘겨서 쓴다. 인자를 생략하면(브라우저) 지금처럼 `window.location.hostname` 을 읽는다.
 */

/** 서브도메인으로 취급하지 않는 예약 호스트(관리자/시스템/공개 랜딩 고정 호스트). */
const RESERVED_HOSTS = new Set(["www", "app", "api", "admin", "dashboard", "go"]);

/**
 * 공개 랜딩 전용 고정 호스트 — 2026-09-09부터 고객마다 다른 서브도메인 대신 이 호스트 밑에서
 * 경로로 구분한다: `go.lead-pot.com/{subdomain}/{identifier}`. {@link renderer/src/proxy.ts} 의
 * `PUBLIC_SITE_HOST` 와 반드시 같은 값을 유지한다.
 */
const PUBLIC_SITE_HOST = "go";

export function currentSubdomain(hostname?: string): string | null {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  // localhost 단독 또는 IP → 관리자 앱
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;

  const parts = host.split(".");
  let sub: string | null = null;
  if (parts[parts.length - 1] === "localhost" && parts.length >= 2) {
    // bali.localhost → "bali"
    sub = parts[0];
  } else if (parts.length >= 3) {
    // bali.lead-pot.com → "bali" (도메인이 2레벨이라고 가정: sub.name.tld)
    sub = parts[0];
  }

  if (!sub || RESERVED_HOSTS.has(sub)) return null;
  return sub;
}

/**
 * `appBaseUrl()` 이 브라우저 없이도(SSR) 쓸 수 있게 미리 설정해두는 값 — frontend·renderer 가
 * 시작 시 한 번 호출한다(`setApiBaseUrl` 과 같은 패턴). Vite 의 `import.meta.env` 는 Next.js
 * 번들러가 이해하지 못하므로, 이 파일에 직접 두지 않고 앱 진입점에서 주입받는다.
 */
let configuredAppBaseUrl: string | undefined;
export function setAppBaseUrl(url: string) {
  configuredAppBaseUrl = url.replace(/\/+$/, "");
}

/**
 * 앱 도메인의 절대 URL 기준값. **앱 도메인에만 있는 경로**(동의문서 `/consent/:id` 등)를 링크할 때 쓴다.
 *
 * 왜 절대 URL 이어야 하나 — 상대 경로(`/consent/1`)는 그 링크를 여는 쪽 도메인에 붙는다.
 * 공개 폼은 앱 도메인 밖에서도 렌더된다:
 *  - 서브도메인 사이트(`{sub}.lead-pot.com`) — 라우터에 `/:identifier` 한 칸짜리 경로만 있어 404
 *  - **외부 사이트 임베드**(embed.js) — iframe 이 아니라 Shadow DOM 인라인이라 `location` 이 고객 도메인이다
 *  - **SSR 랜딩(renderer)** — 브라우저가 아예 없는 서버에서 렌더링된다
 * 그래서 상대 경로로 두면 그 도메인에 없는 경로가 되어 404 가 난다(2026-08-04 실제 발생).
 *
 * 배포 빌드는 `setAppBaseUrl()` 로 값을 주입한다(frontend: `VITE_APP_BASE_URL`, main.tsx·embed.tsx).
 * 없고 브라우저 환경이면(로컬 개발) 현재 오리진에서 서브도메인 라벨만 떼어 쓴다 —
 * `bali.localhost:5173` → `localhost:5173`. 둘 다 없으면(SSR인데 설정을 안 한 경우) 에러를 던진다 —
 * 잘못된 URL을 조용히 만들어 404 를 나중에 겪는 것보다 낫다.
 */
export function appBaseUrl(): string {
  if (configuredAppBaseUrl) return configuredAppBaseUrl;
  if (typeof window === "undefined") {
    throw new Error("appBaseUrl(): 브라우저 밖(SSR)에서는 setAppBaseUrl() 을 먼저 호출해야 합니다.");
  }
  const { protocol, hostname, port } = window.location;
  const sub = currentSubdomain();
  const host = sub ? hostname.split(".").slice(1).join(".") : hostname;
  return `${protocol}//${host}${port ? `:${port}` : ""}`;
}

/** 동의문서 공개 뷰의 절대 URL. 동의문서 링크는 **반드시** 이걸 쓴다(이유는 {@link appBaseUrl}). */
export function consentDocUrl(documentId: number | string): string {
  return `${appBaseUrl()}/consent/${documentId}`;
}

/**
 * 현재 접속 호스트를 기준으로 공개 사이트 절대 URL을 만든다.
 * 관리자 호스트의 선행 라벨(app/www/admin 등)은 제거하고, 공개 랜딩 고정 호스트({@link
 * PUBLIC_SITE_HOST})를 붙인 뒤 subdomain·identifier 를 **경로**로 붙인다(2026-09-09~ — 예전엔
 * subdomain 을 서브도메인 라벨로 붙였으나, 구글 광고 심사가 고객별 서브도메인을 "손상된 사이트"로
 * 오판한 사고 이후 경로 방식으로 전환했다. `renderer/src/proxy.ts` 의 `PUBLIC_SITE_HOST` 참고).
 * - localhost:5173 → http://go.localhost:5173/{subdomain}/{identifier}
 * - app.lead-pot.com → https://go.lead-pot.com/{subdomain}/{identifier}
 */
export function publicSiteUrl(subdomain: string, identifier: string | number): string {
  const { protocol, hostname, port } = window.location;
  let base = hostname;
  const parts = hostname.split(".");
  if (parts.length > 1 && RESERVED_HOSTS.has(parts[0])) {
    base = parts.slice(1).join(".");
  }
  const portPart = port ? `:${port}` : "";
  return `${protocol}//${PUBLIC_SITE_HOST}.${base}${portPart}/${subdomain}/${identifier}`;
}
