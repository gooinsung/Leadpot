/**
 * 공개 사이트(서브도메인) 라우팅 판별.
 * - 관리자 앱: localhost / IP / app.도메인 / www.도메인 등 → null
 * - 사용자 서브도메인: bali.localhost / bali.lead-pot.com → "bali"
 *
 * 로컬 검증: 브라우저에서 `bali.localhost:5173/12` 로 접속하면 *.localhost 가 127.0.0.1 로 잡힌다.
 */

/** 서브도메인으로 취급하지 않는 예약 호스트(관리자/시스템). */
const RESERVED_HOSTS = new Set(["www", "app", "api", "admin", "dashboard"]);

export function currentSubdomain(): string | null {
  const host = window.location.hostname;
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
 * 앱 도메인의 절대 URL 기준값. **앱 도메인에만 있는 경로**(동의문서 `/consent/:id` 등)를 링크할 때 쓴다.
 *
 * 왜 절대 URL 이어야 하나 — 상대 경로(`/consent/1`)는 그 링크를 여는 쪽 도메인에 붙는다.
 * 공개 폼은 앱 도메인 밖에서도 렌더된다:
 *  - 서브도메인 사이트(`{sub}.lead-pot.com`) — 라우터에 `/:identifier` 한 칸짜리 경로만 있어 404
 *  - **외부 사이트 임베드**(embed.js) — iframe 이 아니라 Shadow DOM 인라인이라 `location` 이 고객 도메인이다
 * 그래서 상대 경로로 두면 그 도메인에 없는 경로가 되어 404 가 난다(2026-08-04 실제 발생).
 *
 * 배포 빌드는 `VITE_APP_BASE_URL` 을 주입한다(.github/workflows/deploy-frontend.yml).
 * 없으면(로컬 개발) 현재 오리진에서 서브도메인 라벨만 떼어 쓴다 — `bali.localhost:5173` → `localhost:5173`.
 */
export function appBaseUrl(): string {
  const configured = import.meta.env.VITE_APP_BASE_URL as string | undefined;
  if (configured) {
    return configured.replace(/\/+$/, "");
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
 * 관리자 호스트의 선행 라벨(app/www/admin 등)은 제거하고 서브도메인을 붙인다.
 * - localhost:5173 → http://{sub}.localhost:5173/{identifier}
 * - app.lead-pot.com → https://{sub}.lead-pot.com/{identifier}
 */
export function publicSiteUrl(subdomain: string, identifier: string | number): string {
  const { protocol, hostname, port } = window.location;
  let base = hostname;
  const parts = hostname.split(".");
  if (parts.length > 1 && RESERVED_HOSTS.has(parts[0])) {
    base = parts.slice(1).join(".");
  }
  const portPart = port ? `:${port}` : "";
  return `${protocol}//${subdomain}.${base}${portPart}/${identifier}`;
}
