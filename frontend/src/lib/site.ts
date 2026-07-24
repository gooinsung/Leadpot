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
