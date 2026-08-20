/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 광고 픽셀(I1) — 공개 페이지에서 여러 플랫폼 픽셀을 동시에 삽입.
 * initPixels: 페이지 로드 1회(스크립트 삽입 + PageView).
 * firePixelLead: 리드 제출 성공 시 각 플랫폼 전환(Lead) 이벤트.
 *
 * 전환 귀속은 각 플랫폼이 클릭ID(fbclid/gclid/ttclid)·쿠키로 자체 판단하므로,
 * 설정된 픽셀은 모두 발사한다(표준). "매칭 플랫폼만 발사"는 하지 않는다.
 */

export interface PixelConfig {
  google?: string; // gtag ID (G-XXXX / AW-XXXX)
  meta?: string; // Meta(Facebook) Pixel ID
  metaEvent?: string; // 메타 전환 이벤트(Lead | CompleteRegistration | SubmitApplication | Contact | Schedule), 기본 Lead
  tiktok?: string; // TikTok Pixel ID
  kakao?: string; // Kakao 픽셀 트랙 ID
  daangn?: string; // 당근(Karrot) 픽셀 ID
  daangnEvent?: string; // 당근 전환 이벤트(Purchase | Lead | SubmitApplication), 기본 Purchase
  toss?: string; // 토스애즈 전환 코드(픽셀 ID)
}

function val(cfg: unknown, key: string): string {
  if (!cfg || typeof cfg !== "object") return "";
  const v = (cfg as Record<string, unknown>)[key];
  return v == null ? "" : String(v).trim();
}

/**
 * Google Ads 전환 send_to 값 추출.
 * 'AW-123456/LABEL' 은 그대로, 통째로 붙여넣은 스니펫(gtag('event','conversion',{send_to:'...'}))에서도 뽑아낸다.
 */
function parseSendTo(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/AW-[\w-]+\/[\w-]+/);
  return m ? m[0] : raw.trim();
}

let initialized = false;

/** 공개 페이지 로드 시 1회: 설정된 픽셀 스크립트 삽입 + PageView. */
export function initPixels(cfg: unknown): void {
  if (initialized || !cfg) return;
  const google = val(cfg, "google");
  const googleAds = parseSendTo(val(cfg, "googleAds")); // AW-123/LABEL (Google Ads 전환)
  const meta = val(cfg, "meta");
  const tiktok = val(cfg, "tiktok");
  const kakao = val(cfg, "kakao");
  const daangn = val(cfg, "daangn");
  const toss = val(cfg, "toss");
  if (!(google || googleAds || meta || tiktok || kakao || daangn || toss)) return;
  initialized = true;

  const w = window as any;
  const d = document;

  if (meta) {
    try {
      (function (f: any, b: any, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        const t = b.createElement(e); t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(w, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
      w.fbq("init", meta);
      w.fbq("track", "PageView");
    } catch { /* 픽셀 실패는 무시 */ }
  }

  // 구글: GA4 측정ID(G-)/Google Ads ID(AW-) 페이지 태그 + Google Ads 전환용 태그.
  // google 필드가 비어도 전환(googleAds)만 있으면 그 AW-ID 로 gtag 를 로드·구성한다.
  const awId = googleAds ? googleAds.split("/")[0] : ""; // AW-17818553855
  const gtagLoaderId = google || awId;
  if (gtagLoaderId) {
    try {
      const s = d.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gtagLoaderId);
      d.head.appendChild(s);
      w.dataLayer = w.dataLayer || [];
      w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
      w.gtag("js", new Date());
      if (google) w.gtag("config", google);
      if (awId && awId !== google) w.gtag("config", awId); // 전환용 AW 태그 구성
    } catch { /* ignore */ }
  }

  if (tiktok) {
    try {
      (function (w2: any, d2: any, t: string) {
        w2.TiktokAnalyticsObject = t;
        const ttq: any = (w2[t] = w2[t] || []);
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
        ttq.setAndDefer = function (o: any, e: string) {
          o[e] = function () { o.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
        };
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (e: string) {
          const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
          ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
          const o = d2.createElement("script");
          o.type = "text/javascript"; o.async = true;
          o.src = r + "?sdkid=" + e + "&lib=" + t;
          const a = d2.getElementsByTagName("script")[0];
          a.parentNode.insertBefore(o, a);
        };
        ttq.load(tiktok);
        ttq.page();
      })(w, d, "ttq");
    } catch { /* ignore */ }
  }

  if (kakao) {
    try {
      const s = d.createElement("script");
      s.async = true;
      s.src = "//t1.daumcdn.net/kas/static/kp.js";
      s.onload = function () { try { w.kakaoPixel && w.kakaoPixel(kakao).pageView(); } catch { /* ignore */ } };
      d.head.appendChild(s);
    } catch { /* ignore */ }
  }

  // 당근 공식 스니펫(스텁+큐 방식) — 실제 SDK 로드 전에도 init/track 호출을 큐에 쌓아뒀다가
  // 로드 완료 후 처리한다. 2026-08 당근 요청으로 구버전(/0.2/karrot-pixel.umd.js, onload 대기)에서 교체.
  if (daangn) {
    try {
      if (!w.karrotPixel) {
        const k: any = { stub: true, queue: [] };
        k.init = function () { k.queue.push(["init", arguments, Date.now()]); };
        k.track = function () { k.queue.push(["track", arguments, Date.now()]); };
        w.karrotPixel = k;
        const s = d.createElement("script");
        s.async = true;
        s.src = "https://karrot-pixel.business.daangn.com/karrot-pixel.js";
        const f = d.getElementsByTagName("script")[0];
        if (f && f.parentNode) f.parentNode.insertBefore(s, f);
        else d.head.appendChild(s);
      }
      w.karrotPixel.init(daangn);
      w.karrotPixel.track("ViewPage");
    } catch { /* ignore */ }
  }

  // 토스애즈 픽셀. 사전 스텁 큐 없이 SDK 가 window.TossPixel 을 직접 정의하는 방식이라
  // (카카오와 같은 패턴) onload 뒤에만 호출한다 — 그 전에 리드가 제출되면 firePixelLead 쪽에서
  // 존재 여부만 확인하고 조용히 건너뛴다.
  if (toss) {
    try {
      const s = d.createElement("script");
      s.async = true;
      s.src = "https://static.toss.im/lex/v1.js";
      s.onload = function () {
        try { w.TossPixel && w.TossPixel(toss).pageView(); } catch { /* ignore */ }
      };
      d.head.appendChild(s);
    } catch { /* ignore */ }
  }
}

/** 리드 제출 성공 시: 각 플랫폼 전환(Lead) 이벤트 발사. */
export function firePixelLead(cfg: unknown): void {
  if (!cfg) return;
  const w = window as any;
  const google = val(cfg, "google");
  const googleAds = parseSendTo(val(cfg, "googleAds"));
  const meta = val(cfg, "meta");
  const tiktok = val(cfg, "tiktok");
  const kakao = val(cfg, "kakao");
  const daangn = val(cfg, "daangn");
  const toss = val(cfg, "toss");
  // 메타도 전환 이벤트를 리드폼별로 고를 수 있다(잠재고객/가입완료/신청서/문의/예약).
  // 미설정이면 Lead — components/PixelFields.tsx 의 META_EVENT_DEFAULT 와 같아야 한다.
  const metaEvent = val(cfg, "metaEvent") || "Lead";
  try { if (meta && w.fbq) w.fbq("track", metaEvent); } catch { /* ignore */ }
  try { if (google && w.gtag) w.gtag("event", "generate_lead"); } catch { /* ignore */ }
  // Google Ads 전환: send_to=AW-ID/LABEL 로 conversion 이벤트 발사(광고 전환 카운트).
  try { if (googleAds && w.gtag) w.gtag("event", "conversion", { send_to: googleAds }); } catch { /* ignore */ }
  try { if (tiktok && w.ttq) w.ttq.track("SubmitForm"); } catch { /* ignore */ }
  try { if (kakao && w.kakaoPixel) w.kakaoPixel(kakao).completeRegistration(); } catch { /* ignore */ }
  // 당근은 전환 이벤트를 리드폼별로 고를 수 있다(구매/잠재고객/서비스신청).
  // 미설정이면 Purchase — components/PixelFields.tsx 의 DAANGN_EVENT_DEFAULT 와 같아야 한다.
  const daangnEvent = val(cfg, "daangnEvent") || "Purchase";
  try { if (daangn && w.karrotPixel && w.karrotPixel.track) w.karrotPixel.track(daangnEvent); } catch { /* ignore */ }
  // 토스는 이벤트 선택 없이 잠재고객 수집(leadCollection)으로 고정 — 우리 리드폼 제출과 정확히 대응된다.
  try { if (toss && w.TossPixel) w.TossPixel(toss).leadCollection(); } catch { /* ignore */ }
}
