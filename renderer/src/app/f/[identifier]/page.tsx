import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublicForm,
  setApiBaseUrl,
  PublicFormPageView,
  ApiError,
  type ForwardedRequestContext,
  type FormDetail,
} from "@leadpot/public-ui";

// 서버 쪽 @leadpot/public-ui 모듈 인스턴스 설정 — 클라이언트 쪽은 ApiBaseInit.tsx 가 따로 한다.
setApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080");

type Params = { identifier: string };

/**
 * 단독 공개 리드폼(`/f/{id}`)의 SSR 라우트. 랜딩(`site/[subdomain]/[identifier]`)과 달리 서브도메인이
 * 없다 — 폼은 계정과 무관하게 번호만으로 전역 조회된다(2026-09-08, 랜딩과 같은 이유로 SSR 범위에 포함).
 * `app.lead-pot.com/f/*` 요청이 여기로 오도록 `proxy.ts` 가 분기한다(그 외 app 경로는 관리 앱으로 프록시).
 */
async function forwardedContext(): Promise<ForwardedRequestContext> {
  const h = await headers();
  return {
    clientIp: h.get("cf-connecting-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/** 진짜 미존재/IP 차단(백엔드 404)만 notFound() 로, 그 외 실패는 던져 error.tsx 가 폴백을 렌더하게 한다. */
async function loadForm(identifier: string, ctx: ForwardedRequestContext): Promise<FormDetail> {
  const id = Number(identifier);
  if (!Number.isFinite(id)) notFound();
  try {
    return await getPublicForm(id, ctx);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function PublicFormSsrPage({ params }: { params: Promise<Params> }) {
  const { identifier } = await params;
  const ctx = await forwardedContext();
  const form = await loadForm(identifier, ctx);
  return <PublicFormPageView form={form} />;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { identifier } = await params;
  const id = Number(identifier);
  if (!Number.isFinite(id)) return { title: "페이지를 찾을 수 없습니다" };
  const ctx = await forwardedContext();
  const form = await getPublicForm(id, ctx).catch(() => null);
  if (!form) return { title: "페이지를 찾을 수 없습니다" };
  return { title: form.name, description: "Leadpot — 상담 신청 폼" };
}
