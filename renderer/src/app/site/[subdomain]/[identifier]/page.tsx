import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveSite,
  getLandingLive,
  setApiBaseUrl,
  LandingView,
  type ForwardedRequestContext,
} from "@leadpot/public-ui";

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

export default async function SiteLandingPage({ params }: { params: Promise<Params> }) {
  const { subdomain, identifier } = await params;
  const ctx = await forwardedContext();

  const landing = await resolveSite(subdomain, identifier, ctx).catch(() => null);
  if (!landing) notFound();

  const live = needsLiveData(landing.content) ? await getLandingLive(landing.id, ctx).catch(() => null) : null;

  return (
    <div className="landing-public">
      <LandingView landing={landing} initialLive={live} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { subdomain, identifier } = await params;
  // IP 차단된 방문자에게는 랜딩 존재 자체를 숨긴다(백엔드 LandingService 의도) — 그래서 메타데이터도
  // 본문과 똑같이 ctx 를 넘긴다. 같은 인자의 fetch 라 Next 가 자동으로 한 번만 호출한다(중복 요청 없음).
  const ctx = await forwardedContext();
  const landing = await resolveSite(subdomain, identifier, ctx).catch(() => null);
  if (!landing) return { title: "페이지를 찾을 수 없습니다" };
  return { title: landing.title };
}
