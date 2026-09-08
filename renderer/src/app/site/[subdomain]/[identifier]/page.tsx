import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveSite,
  getLandingLive,
  setApiBaseUrl,
  LandingView,
  ApiError,
  type ForwardedRequestContext,
  type PublicLanding,
} from "@leadpot/public-ui";
import { normalizeIdentifier } from "@/lib/decode-identifier";

// 서버 쪽 @leadpot/public-ui 모듈 인스턴스 설정 — 클라이언트 쪽은 ApiBaseInit.tsx 가 따로 한다.
setApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080");

type Params = { subdomain: string; identifier: string };

/**
 * 원 요청의 방문자 IP·User-Agent 를 읽어 백엔드로 그대로 전달할 컨텍스트를 만든다.
 *
 * 🔴 이게 없으면 IP 차단(K2)·중복 제출 방지·순방문 통계가 전부 조용히 깨진다 — 렌더러가
 * 대신 API 를 부르면 그 요청은 Cloudflare 입장에서 "Workers 가 보낸 새 요청"이라 원래 방문자의
 * IP 가 아니라 그 자리에서 잡히는 IP 가 찍힌다(docs/SSR-LANDING-PLAN.md §6-1).
 */
async function forwardedContext(): Promise<ForwardedRequestContext> {
  const h = await headers();
  return {
    clientIp: h.get("cf-connecting-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/** 이 랜딩이 실시간 신청수/남은자리(M8 동적 요소)를 쓰는지 — LandingView.tsx 의 판정과 반드시 같게 유지. */
function needsLiveData(content: { type: string; html?: unknown }[]): boolean {
  return content.some((b) => b.type === "HTML" && typeof b.html === "string" && b.html.includes("data-lp-live"));
}

/**
 * 진짜 미존재/IP 차단(백엔드가 404 로 응답, 존재 비노출)만 `notFound()` 로 처리하고, 그 밖의
 * 실패(네트워크 오류·백엔드 5xx 등)는 그대로 던져 `error.tsx` 가 클라이언트 폴백을 렌더하게 한다
 * (§5-5 — 여기서 전부 `catch(() => null)` 로 삼키면 진짜 장애도 조용히 404 가 되어 폴백이 못 뜬다).
 */
async function loadLanding(subdomain: string, identifier: string, ctx: ForwardedRequestContext): Promise<PublicLanding> {
  try {
    return await resolveSite(subdomain, identifier, ctx);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function SiteLandingPage({ params }: { params: Promise<Params> }) {
  const { subdomain, identifier } = await params;
  const ctx = await forwardedContext();

  const landing = await loadLanding(subdomain, normalizeIdentifier(identifier), ctx);
  const live = needsLiveData(landing.content) ? await getLandingLive(landing.id, ctx).catch(() => null) : null;

  return (
    <div className="landing-public">
      <LandingView landing={landing} initialLive={live} />
    </div>
  );
}

const DEFAULT_DESCRIPTION = "Leadpot — 랜딩페이지로 상담 신청을 받는 페이지입니다.";

/** 랜딩 콘텐츠의 첫 TEXT 블록을 og:description·meta description 으로 쓴다(I3 SEO, 별도 필드 없이). */
function firstText(content: PublicLanding["content"]): string | undefined {
  const b = content.find((b) => b.type === "TEXT" && typeof b.text === "string" && (b.text as string).trim());
  return b ? (b.text as string).trim() : undefined;
}

/** 첫 IMAGE 블록을 og:image·twitter:image 로 쓴다. 없으면 이미지 태그 자체를 생략한다. */
function firstImage(content: PublicLanding["content"]): string | undefined {
  const b = content.find((b) => b.type === "IMAGE" && typeof b.url === "string" && (b.url as string).trim());
  return b ? (b.url as string).trim() : undefined;
}

function toDescription(content: PublicLanding["content"]): string {
  const text = firstText(content);
  if (!text) return DEFAULT_DESCRIPTION;
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 155 ? oneLine.slice(0, 154) + "…" : oneLine;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { subdomain, identifier } = await params;
  // IP 차단된 방문자에게는 랜딩 존재 자체를 숨긴다(백엔드 LandingService 의도) — 그래서 메타데이터도
  // 본문과 똑같이 ctx 를 넘긴다.
  // ⚠️ 예전엔 "같은 인자의 fetch 라 Next 가 자동으로 한 번만 호출한다"고 적어뒀었는데, Phase 4
  // 실측(SPA 폴백 검증 중)에서 generateMetadata 와 페이지 컴포넌트가 실제로 각각 별도 네트워크
  // 호출을 하는 걸 확인했다 — 메모이제이션에 기대지 말 것. 응답이 가벼워서 랜딩당 요청 2회는 감수한다.
  const ctx = await forwardedContext();
  const landing = await resolveSite(subdomain, normalizeIdentifier(identifier), ctx).catch(() => null);
  if (!landing) {
    // 존재하지 않거나(또는 IP 차단으로 숨겨진) 페이지는 검색엔진이 색인하면 안 된다.
    // ⚠️ 여기서 robots 를 따로 지정할 필요가 없다 — page.tsx 의 notFound() 가 렌더하는
    // Next 내장 폴백(HTTPAccessFallbackBoundary)이 <meta name="robots" content="noindex"> 를
    // 항상 자동으로 박아 넣는다(실측 확인, node_modules/next 코드에 하드코딩돼 있음). 여기서
    // robots 를 지정해도 그 자동 삽입 태그에 덮여 반영이 안 된다.
    return { title: "페이지를 찾을 수 없습니다" };
  }

  const url = `https://${subdomain}.lead-pot.com/${identifier}`;
  const description = toDescription(landing.content);
  const image = firstImage(landing.content);

  return {
    title: landing.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: landing.title,
      description,
      url,
      type: "website",
      locale: "ko_KR",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: landing.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
