// 공개(비로그인) API 클라이언트 — frontend(/f/{id}·서브도메인 사이트·임베드)와
// renderer(SSR 공개 랜딩)가 함께 쓴다. frontend/src/api/client.ts 의 공개 전용 부분집합이다.
//
// ⚠️ 이 파일은 SSR(Next.js/Cloudflare Workers)에서도 실행된다 — `localStorage`·`navigator`·
// `import.meta.env` 등 브라우저 전용 API 를 여기 넣지 않는다(recordEventBeacon 은 예외, 항상
// 브라우저의 클라이언트 이벤트 핸들러 안에서만 호출된다). 인증이 필요 없는 순수 공개 API 만 다룬다.

let apiBaseUrl = "http://localhost:8080";

/** frontend·renderer 가 시작 시 한 번 호출해 API 서버 주소를 설정한다. */
export function setApiBaseUrl(url: string) {
  apiBaseUrl = url;
}

// ---------- 공통 에러 ----------
export interface ApiErrorBody {
  status: number;
  error: string;
  message: string;
  fieldErrors?: Record<string, string> | null;
}

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string> | null;

  constructor(status: number, body: Partial<ApiErrorBody> | null, fallback: string) {
    super(body?.message ?? fallback);
    this.status = status;
    this.code = body?.error ?? "UNKNOWN";
    this.fieldErrors = body?.fieldErrors ?? null;
  }
}

/**
 * 서버가 메시지를 주지 않았을 때 쓸 문구.
 * 예전엔 `${status} ${statusText}` 를 그대로 썼는데, HTTP/2 에는 reason phrase 가 없어
 * 화면에 "404" 같은 숫자만 노출됐다. 사용자가 읽을 수 있는 말로 바꾼다.
 */
function fallbackMessage(status: number): string {
  if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
  if (status === 409) return "이미 처리되었거나 조건이 맞지 않습니다.";
  if (status === 429) return "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.";
  if (status >= 500) return "서버에 문제가 생겼습니다. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했습니다.";
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = await res.json();
  } catch {
    // 본문 없음
  }
  return new ApiError(res.status, body, fallbackMessage(res.status));
}

// ---------- 저수준 요청 (인증 없음 — 공개 API 전용) ----------
interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- 리드폼(Form) ----------
export type FormType = "BASIC" | "STEP";
/**
 * `CALC` = 계산기 블록(content.calcKey). 앞 단계 답변으로 값을 계산해 결과 단계를 만든다.
 * 답변을 만드는 블록이 아니라 varKey 를 받지 않는다 — 계산 결과는 answers 에 fieldType="calc" 로 들어간다.
 */
export type BlockType = "FIELD" | "IMAGE" | "HTML" | "TEXT" | "DIVIDER" | "SPACER" | "CHOICE" | "CALC";

export interface FormBlock {
  id?: number;
  stepNo?: number | null;
  sortOrder: number;
  blockType: BlockType;
  fieldType?: string | null;
  /**
   * 항목명이 바뀌어도 변하지 않는 변수키(`f1`, `f2`, …). 메시지 템플릿이 이 키로 값을 찾는다.
   * 서버가 발급하므로 편집 화면은 **받은 값을 그대로 돌려보내기만** 하면 된다. 비우면 새 키가 발급된다.
   */
  varKey?: string | null;
  label?: string | null;
  required?: boolean;
  uniqueCheck?: boolean;
  placeholder?: string | null;
  options?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
}

/** 리드폼 유입 방식(V39). SELF = 우리 공개 URL 로 직접 제출(기본). WEBHOOK = 공개 렌더를 막고 외부 웹훅으로만 수신. */
export type FormSource = "SELF" | "WEBHOOK";

export interface FormInput {
  name: string;
  /** 분야(업종 구분: 개인회생·장기렌트 등, V34). 빈 값 = 미지정. ⚠️ 리드 '태그'와 별개 축 */
  category?: string | null;
  formType: FormType;
  requirePhoneVerification?: boolean;
  consentConfig?: Record<string, unknown> | null;
  submitButtonConfig?: Record<string, unknown> | null;
  successConfig?: Record<string, unknown> | null;
  typeConfig?: Record<string, unknown> | null;
  styleConfig?: Record<string, unknown> | null;
  settingsConfig?: Record<string, unknown> | null;
  trackingConfig?: Record<string, unknown> | null; // 광고 픽셀 {google,meta,tiktok,kakao,daangn}
  blocks: FormBlock[];
}

export interface FormDetail extends FormInput {
  id: number;
  /** 유입 방식(V39, 읽기 전용) — 웹훅 설정 API(get/enable/disableWebhook)로만 바뀐다. */
  source: FormSource;
  requirePhoneVerification: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 공개 리드폼 렌더 데이터(비로그인). */
export function getPublicForm(id: number): Promise<FormDetail> {
  return request<FormDetail>(`/api/public/forms/${id}`);
}

// ---------- 동의 항목(리드폼 consentConfig 안에 저장) ----------
export interface ConsentItem {
  title: string;
  required: boolean;
  defaultChecked?: boolean; // 공개 리드폼에서 기본 체크 여부
  linkType: "none" | "external" | "document"; // 보기 링크 종류
  url?: string; // external 일 때
  documentId?: number | null; // document 일 때
}

// ---------- 동의 문서(consent documents) ----------
export interface ConsentDocument {
  id: number;
  name: string;
  title: string;
  content: string;
  updatedAt: string;
}

/** 공개 조회 ('보기' 링크가 여는 문서). 비로그인. */
export function getPublicConsentDoc(id: number): Promise<ConsentDocument> {
  return request<ConsentDocument>(`/api/public/consent-documents/${id}`);
}

// ---------- 리드(수집 데이터) ----------
export interface LeadAnswer {
  label: string;
  fieldType?: string;
  value: string;
}
export interface LeadConsent {
  title: string;
  required: boolean;
  agreed: boolean;
}
export interface LeadSubmitInput {
  formId: number;
  landingPageId?: number | null;
  answers: LeadAnswer[];
  consents: LeadConsent[];
  utm?: Record<string, unknown> | null;
}

/** 공개 리드폼 제출(비로그인). */
export function submitLead(input: LeadSubmitInput): Promise<{ id: number; ok: boolean }> {
  return request<{ id: number; ok: boolean }>("/api/public/leads", { method: "POST", body: input });
}

// ---------- 랜딩페이지 ----------
export type LandingBlockType = "IMAGE" | "TEXT" | "HTML" | "FORM";
export interface LandingBlock {
  type: LandingBlockType;
  /** 편집 화면에서만 쓰는 블록 이름(예: "헤더 이미지", "선착순 HTML"). 공개 페이지에는 노출하지 않는다. */
  name?: string;
  // IMAGE: {url, alt} · TEXT: {text} · HTML: {html} · FORM: {formId, trigger:"inline"|"overlay"|"fullscreen", buttonLabel, buttonDescription}
  [key: string]: unknown;
}
export interface PublicLanding {
  id: number;
  title: string;
  content: LandingBlock[];
  forms: Record<string, FormDetail>;
  tracking?: Record<string, unknown> | null;
}

/** 공개 사이트 해석(비로그인): {subdomain}.도메인/{랜딩번호|슬러그}. published 만 열림. */
export function resolveSite(subdomain: string, identifier: string): Promise<PublicLanding> {
  return request<PublicLanding>(
    `/api/public/sites/${encodeURIComponent(subdomain)}/${encodeURIComponent(identifier)}`,
  );
}

// ---------- 동적 요소(M8) 실시간 집계 ----------
export interface LandingLive {
  count: number; // 연결폼 활성 리드 수
  recent: { name: string; at: string }[]; // 최근 신청자(이름 마스킹)
}
/** 공개 랜딩 동적 요소용 실시간 집계(비로그인). 신청수·최근 신청자. */
export function getLandingLive(id: number): Promise<LandingLive> {
  return request<LandingLive>(`/api/public/landings/${id}/live`);
}

// ---------- 방문·이벤트 기록 ----------
/** 공개 방문 기록(비로그인, best-effort). 공개 랜딩/리드폼 진입 시 1회 호출. 브라우저 전용(클라이언트에서만 호출할 것). */
export function recordVisit(input: { landingPageId?: number | null; formId?: number | null; utm?: Record<string, string> }): void {
  request<void>("/api/public/visits", { method: "POST", body: input }).catch(() => {
    /* 방문 기록 실패는 무시 */
  });
}

export interface RecordEventInput {
  landingPageId?: number | null;
  formId?: number | null;
  eventType: string;
  target?: string;
  /** 스크롤 도달 깊이(%, 0~100) — eventType="scroll" 에서 사용(I6). */
  scrollDepth?: number;
  /** 체류 시간(초) — eventType="page_exit" 에서 사용(I6). */
  durationSec?: number;
}

/** 공개 이벤트 기록(비로그인, best-effort). 브라우저 전용(클라이언트에서만 호출할 것). */
export function recordEvent(input: RecordEventInput): void {
  request<void>("/api/public/events", { method: "POST", body: input }).catch(() => {
    /* 이벤트 기록 실패는 무시 */
  });
}

/**
 * 페이지 이탈 시점 전용 기록(I6). `fetch`는 언로드 중 취소될 수 있어
 * `navigator.sendBeacon`으로 보낸다(실패해도 페이지 동작에 영향 없음, best-effort).
 * ⚠️ 브라우저 전용 — `navigator` 를 직접 쓴다. 클라이언트 이벤트 핸들러 밖(SSR)에서 호출하지 말 것.
 */
export function recordEventBeacon(input: RecordEventInput): void {
  try {
    const blob = new Blob([JSON.stringify(input)], { type: "application/json" });
    if (!navigator.sendBeacon(`${apiBaseUrl}/api/public/events`, blob)) {
      recordEvent(input); // sendBeacon 실패 시 일반 요청으로 폴백
    }
  } catch {
    recordEvent(input);
  }
}
