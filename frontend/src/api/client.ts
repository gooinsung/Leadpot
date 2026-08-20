// 백엔드 API 클라이언트 (모든 API 호출은 여기로 집중한다 — CLAUDE.md 컨벤션)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

// ---------- 토큰 저장소 (localStorage) ----------
const TOKENS_KEY = "leadpot-tokens";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): AuthTokens | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKENS_KEY);
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
  if (status === 401) return "로그인이 필요합니다. 다시 로그인해주세요.";
  if (status === 403) return "권한이 없습니다.";
  if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
  if (status === 409) return "이미 처리되었거나 조건이 맞지 않습니다.";
  if (status === 413) return "파일이 너무 큽니다.";
  if (status === 429) return "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.";
  if (status >= 500) return "서버에 문제가 생겼습니다. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했습니다.";
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = await res.json();
  } catch {
    // 본문 없음(시큐리티 레벨 401 등)
  }
  return new ApiError(res.status, body, fallbackMessage(res.status));
}

// ---------- 저수준 요청 (인증/자동 재발급 포함) ----------
interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // Authorization 헤더 부착 여부 (기본 true)
  _retried?: boolean; // 내부: 재발급 후 1회 재시도 플래그
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const tokens = getTokens();
  if (auth && tokens?.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 액세스 토큰 만료 → refresh 로 1회 재발급 후 재시도
  if (res.status === 401 && auth && !opts._retried && tokens?.refreshToken) {
    const refreshed = await tryRefresh(tokens.refreshToken);
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = (await res.json()) as TokenResponse;
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/**
 * 파일 업로드(FormData)·파일 다운로드(blob)처럼 request() 를 못 쓰는 요청용 fetch.
 * **401 이면 refresh 로 1회 재발급 후 재시도한다 — request() 와 동일한 동작.**
 * 이게 없으면 액세스 토큰(30분) 만료 후 업로드·내보내기만 조용히 401 로 실패한다
 * (JSON 호출은 request() 가 알아서 갱신하므로 화면은 멀쩡해 보인다).
 */
async function authedFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401 && !retried && tokens?.refreshToken && (await tryRefresh(tokens.refreshToken))) {
    return authedFetch(path, init, true); // FormData·문자열 본문은 재사용 가능하다
  }
  return res;
}

// ---------- 도메인 타입 ----------
export interface HealthResponse {
  status: string;
  service: string;
  time: string;
}

/** USER=마케터 · ADVERTISER=광고주 하위계정 · ADMIN=운영자 */
export type Role = "USER" | "ADVERTISER" | "ADMIN";
export type Plan = "FREE" | "PRO";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  /** 광고주 하위계정은 공개 페이지가 없어 null */
  subdomain: string | null;
  role: Role;
  plan: Plan;
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ---------- API ----------
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { auth: false });
}

export function signup(input: SignupInput): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/signup", { method: "POST", body: input, auth: false });
}

export function login(input: LoginInput): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/login", { method: "POST", body: input, auth: false });
}

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

/** 내 서브도메인 변경(로그인 필요). 갱신된 계정 정보 반환. */
export function updateSubdomain(subdomain: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/subdomain", { method: "PATCH", body: { subdomain } });
}

/**
 * 비밀번호 재설정 인증번호 요청(V36). 가입 휴대폰으로 문자가 간다.
 * 서버는 계정 존재 여부와 무관하게 **항상 204** 를 준다(이메일 존재 노출 방지) —
 * 화면도 "등록된 계정이면 발송됐다"는 안내만 해야 한다.
 */
export function requestPasswordReset(email: string): Promise<void> {
  return request<void>("/api/auth/password-reset/request", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

/** 인증번호 확인 + 새 비밀번호 설정. 성공하면 자동 로그인 토큰을 준다. */
export function confirmPasswordReset(
  email: string,
  code: string,
  password: string,
): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: { email, code, password },
    auth: false,
  });
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
  requirePhoneVerification: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormSummary {
  id: number;
  name: string;
  /** 분야(V34). null = 미지정. */
  category: string | null;
  formType: FormType;
  blockCount: number;
  updatedAt: string;
}

export function listForms(): Promise<FormSummary[]> {
  return request<FormSummary[]>("/api/forms");
}

export function getForm(id: number): Promise<FormDetail> {
  return request<FormDetail>(`/api/forms/${id}`);
}

export function createForm(input: FormInput): Promise<FormDetail> {
  return request<FormDetail>("/api/forms", { method: "POST", body: input });
}

export function updateForm(id: number, input: FormInput): Promise<FormDetail> {
  return request<FormDetail>(`/api/forms/${id}`, { method: "PUT", body: input });
}

export function deleteForm(id: number): Promise<void> {
  return request<void>(`/api/forms/${id}`, { method: "DELETE" });
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
export interface ConsentDocumentSummary {
  id: number;
  name: string;
  title: string;
  updatedAt: string;
}

export interface ConsentDocument {
  id: number;
  name: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface ConsentDocumentInput {
  name: string;
  title: string;
  content: string;
}

export function listConsentDocs(): Promise<ConsentDocumentSummary[]> {
  return request<ConsentDocumentSummary[]>("/api/consent-documents");
}

export function getConsentDoc(id: number): Promise<ConsentDocument> {
  return request<ConsentDocument>(`/api/consent-documents/${id}`);
}

export function createConsentDoc(input: ConsentDocumentInput): Promise<ConsentDocument> {
  return request<ConsentDocument>("/api/consent-documents", { method: "POST", body: input });
}

export function updateConsentDoc(id: number, input: ConsentDocumentInput): Promise<ConsentDocument> {
  return request<ConsentDocument>(`/api/consent-documents/${id}`, { method: "PUT", body: input });
}

export function deleteConsentDoc(id: number): Promise<void> {
  return request<void>(`/api/consent-documents/${id}`, { method: "DELETE" });
}

/** 공개 조회 ('보기' 링크가 여는 페이지). 비로그인. */
export function getPublicConsentDoc(id: number): Promise<ConsentDocument> {
  return request<ConsentDocument>(`/api/public/consent-documents/${id}`, { auth: false });
}

// ---------- 재사용 HTML 요소 라이브러리(M8) ----------
export type HtmlComponentCategory = "HEADER" | "FOOTER" | "CTA" | "CONTENT" | "ETC";

export interface HtmlComponentSummary {
  id: number;
  name: string;
  category: HtmlComponentCategory;
  updatedAt: string;
}
export interface HtmlComponent {
  id: number;
  name: string;
  category: HtmlComponentCategory;
  html: string;
  updatedAt: string;
}
export interface HtmlComponentInput {
  name: string;
  category: HtmlComponentCategory;
  html: string;
}

export const HTML_COMPONENT_CATEGORIES: { value: HtmlComponentCategory; label: string }[] = [
  { value: "HEADER", label: "헤더" },
  { value: "FOOTER", label: "푸터" },
  { value: "CTA", label: "CTA/버튼" },
  { value: "CONTENT", label: "본문" },
  { value: "ETC", label: "기타" },
];

export function listHtmlComponents(): Promise<HtmlComponentSummary[]> {
  return request<HtmlComponentSummary[]>("/api/html-components");
}
export function getHtmlComponent(id: number): Promise<HtmlComponent> {
  return request<HtmlComponent>(`/api/html-components/${id}`);
}
export function createHtmlComponent(input: HtmlComponentInput): Promise<HtmlComponent> {
  return request<HtmlComponent>("/api/html-components", { method: "POST", body: input });
}
export function updateHtmlComponent(id: number, input: HtmlComponentInput): Promise<HtmlComponent> {
  return request<HtmlComponent>(`/api/html-components/${id}`, { method: "PUT", body: input });
}
export function deleteHtmlComponent(id: number): Promise<void> {
  return request<void>(`/api/html-components/${id}`, { method: "DELETE" });
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
export interface Lead {
  id: number;
  formId: number;
  answers: LeadAnswer[];
  consents: LeadConsent[] | null;
  status: string;
  phoneVerified: boolean;
  submitterIp: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  language: string | null;
  referer: string | null;
  utm: Record<string, unknown> | null;
  tags: string[] | null;
  /** 분야(V35) — 접수 시점 도장 또는 일괄 지정. null = 없음. */
  category: string | null;
  createdAt: string;
  /** 필터·라벨 키(고정=코드, 커스텀=C{id}). 통합 상태 축(V29). */
  statusKey: string;
  /** status=CUSTOM 일 때의 정의 id. */
  customStatusId: number | null;
  /** 광고주가 처음 열어본 시각. null = 아직 안 봄 → 목록에 '광고주 확인' 미표시 */
  advertiserSeenAt: string | null;
  /** 내(마케터)가 열어본 시각. null = '미확인'. 리드 상태와 무관하다(V32). */
  seenAt: string | null;
}

export interface LeadNote {
  id: number;
  kind: "MEMO" | "SYSTEM";
  body: string;
  /** true = 광고주에게도 보이는 메모(광고주메모). false = 마케터메모. */
  sharedWithAdvertiser: boolean;
  /** true = 작성자 계정이 삭제됨(광고주 하위계정 삭제). 내용은 이력이라 보존된다 */
  authorDeleted: boolean;
  /** 작성자 역할 표기(마케터/광고주). null = 작성자 삭제·미상. */
  authorRole: "MARKETER" | "ADVERTISER" | null;
  createdAt: string;
}

export interface LeadSubmitInput {
  formId: number;
  landingPageId?: number | null;
  answers: LeadAnswer[];
  consents: LeadConsent[];
  utm?: Record<string, unknown> | null;
}

/** 공개 리드폼 렌더 데이터(비로그인). */
export function getPublicForm(id: number): Promise<FormDetail> {
  return request<FormDetail>(`/api/public/forms/${id}`, { auth: false });
}

/** 공개 리드폼 제출(비로그인). */
export function submitLead(input: LeadSubmitInput): Promise<{ id: number; ok: boolean }> {
  return request<{ id: number; ok: boolean }>("/api/public/leads", { method: "POST", body: input, auth: false });
}

export interface LeadFilter {
  status?: string; // NEW/IN_PROGRESS/DONE/SPAM (빈값=전체)
  q?: string; // 답변 값/라벨 부분검색
  trashed?: boolean; // true 면 휴지통 리드
}

/** 특정 리드폼의 리드 목록(본인 리드폼만). 상태·검색·휴지통 필터. */
export function listLeads(formId: number, filter: LeadFilter = {}): Promise<Lead[]> {
  const p = new URLSearchParams({ formId: String(formId) });
  if (filter.status) p.set("status", filter.status);
  if (filter.q) p.set("q", filter.q);
  if (filter.trashed) p.set("trashed", "true");
  return request<Lead[]>(`/api/leads?${p.toString()}`);
}

// ---------- 통합 인박스 (U1) ----------
export interface InboxItem {
  id: number;
  formId: number;
  formName: string;
  /** 리드에 새겨진 분야(V35) — 접수 시점 도장 또는 일괄 지정. null = 없음. */
  category: string | null;
  answers: LeadAnswer[];
  status: string;
  /** 필터·라벨 키(고정=코드, 커스텀=C{id}). 라벨은 counts.statusNames[statusKey]. */
  statusKey: string;
  tags: string[] | null;
  /** 유입 파라미터(media_from 등). 목록의 '출처' 칩용. null 가능. */
  utm: Record<string, unknown> | null;
  createdAt: string;
  /** 내(마케터)가 열어본 시각. null = '미확인'(V32). 상태와 무관하다. */
  seenAt: string | null;
}
export interface InboxCounts {
  all: number;
  unseen: number;
  today: number;
  byForm: { formId: number; formName: string; count: number }[];
  /** 분야별 리드 수(V34) — 분야 드롭다운 옵션. 분야 있는 폼의 리드만. */
  byCategory: { name: string; count: number }[];
  /** 키 = statusKey */
  byStatus: Record<string, number>;
  /** statusKey → 라벨(커스텀 상태 이름 포함) */
  statusNames: Record<string, string>;
}
export interface InboxResponse {
  items: InboxItem[];
  total: number;
  page: number;
  size: number;
  counts: InboxCounts;
}
export interface InboxFilter {
  status?: string;
  q?: string;
  formId?: number;
  /** 분야 필터(V34) — 그 분야 폼의 리드만. */
  category?: string;
  from?: string;
  to?: string;
  /** 유입 파라미터 필터 — 키·값을 둘 다 줘야 적용된다(예: media_from + danggun). */
  utmKey?: string;
  utmValue?: string;
  unseen?: boolean;
  page?: number;
  size?: number;
}
/** 일괄 상태변경(U2). 내 것이 아니거나 AS 대기인 id 는 서버가 건너뛴다. { updated } 반환. */
export function bulkUpdateLeadStatus(
  ids: number[],
  status: string,
  customStatusId?: number | null,
): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/leads/bulk/status", {
    method: "PATCH",
    body: { ids, status, customStatusId: customStatusId ?? null },
  });
}
/**
 * 마케터 '확인' 표시 일괄 처리(V32). { updated } 반환.
 * 리드 상태는 건드리지 않는다 — '미확인'은 상태가 아니라 내가 봤는지 여부다.
 */
export function markLeadsSeen(ids: number[]): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/leads/bulk/seen", { method: "POST", body: { ids } });
}
/** 다시 '미확인'으로 되돌리기. */
export function markLeadsUnseen(ids: number[]): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/leads/bulk/unseen", { method: "POST", body: { ids } });
}
/** 일괄 분야 지정/해제(V35). category 빈 값 = 해제. 과거 리드 소급은 이 경로로만. { updated } 반환. */
export function bulkUpdateLeadCategory(ids: number[], category: string): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/leads/bulk/category", { method: "PATCH", body: { ids, category } });
}
/** 일괄 휴지통 이동(U2). { trashed } 반환. */
export function bulkTrashLeads(ids: number[]): Promise<{ trashed: number }> {
  return request<{ trashed: number }>("/api/leads/bulk/trash", { method: "POST", body: { ids } });
}
/** 일괄 복원(휴지통 전체선택). */
export function bulkRestoreLeads(ids: number[]): Promise<{ restored: number }> {
  return request<{ restored: number }>("/api/leads/bulk/restore", { method: "POST", body: { ids } });
}
/** 일괄 영구 삭제(휴지통 전용 — 되돌릴 수 없음). */
export function bulkPermanentDeleteLeads(ids: number[]): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/api/leads/bulk/permanent", { method: "POST", body: { ids } });
}

/** 내 모든 리드폼의 리드를 한 스트림으로(필터·페이징 + rail 카운트). */
export function getInbox(filter: InboxFilter = {}): Promise<InboxResponse> {
  const p = new URLSearchParams();
  if (filter.status) p.set("status", filter.status);
  if (filter.q) p.set("q", filter.q);
  if (filter.formId != null) p.set("formId", String(filter.formId));
  if (filter.category) p.set("category", filter.category);
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.utmKey && filter.utmValue) {
    p.set("utmKey", filter.utmKey);
    p.set("utmValue", filter.utmValue);
  }
  if (filter.unseen) p.set("unseen", "true");
  if (filter.page != null) p.set("page", String(filter.page));
  if (filter.size != null) p.set("size", String(filter.size));
  const qs = p.toString();
  return request<InboxResponse>(`/api/leads/inbox${qs ? `?${qs}` : ""}`);
}

/**
 * 유입 파라미터 facet(필터 드롭다운 옵션) — 키별 값·건수. formId 없으면 내 모든 폼.
 * 응답 모양은 lib/tracking.ts 의 UtmFacet 과 같다(폼별 목록은 클라이언트에서 직접 만든다).
 */
export function getUtmFacets(formId?: number): Promise<{ key: string; values: { value: string; count: number }[] }[]> {
  const qs = formId != null ? `?formId=${formId}` : "";
  return request(`/api/leads/utm-facets${qs}`);
}

/** 리드를 휴지통으로 이동(soft delete). */
export function deleteLead(id: number): Promise<void> {
  return request<void>(`/api/leads/${id}`, { method: "DELETE" });
}

/** 휴지통에서 복원. */
export function restoreLead(id: number): Promise<void> {
  return request<void>(`/api/leads/${id}/restore`, { method: "POST" });
}

/** 영구 삭제(되돌릴 수 없음). */
export function permanentDeleteLead(id: number): Promise<void> {
  return request<void>(`/api/leads/${id}/permanent`, { method: "DELETE" });
}

/** 리드폼 기본 양식 다운로드(xlsx | csv). 헤더=리드폼 항목. */
export async function downloadLeadTemplate(formId: number, format: "xlsx" | "csv", formName: string): Promise<void> {
  const res = await authedFetch(`/api/leads/template?formId=${formId}&format=${format}`);
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${formName || "lead"}_양식.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
}

/** 엑셀/CSV 파일로 리드 일괄 등록. */
export async function importLeads(formId: number, file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch(`/api/leads/import?formId=${formId}`, { method: "POST", body: fd });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ImportResult;
}

/**
 * 수기 등록(K7): 항목 라벨→값 을 직접 입력해 리드 1건 추가. 마케터·광고주 알림 없음.
 */
export function createManualLead(formId: number, answers: Record<string, string>): Promise<Lead> {
  return request<Lead>(`/api/leads/manual?formId=${formId}`, { method: "POST", body: answers });
}

/** 대시보드 리드 수(total=전체, todayNew=오늘 접수 — '신규 리드' 카드). */
export function leadsCount(): Promise<{ total: number; todayNew: number }> {
  return request<{ total: number; todayNew: number }>("/api/leads/count");
}

// ---------- 광고주 확인 여부(V33) ----------
// "광고주가 이 리드를 보기는 했나"를 시각 한 칸이 아니라 요약 + 이력으로 답한다. 마케터 전용.

/** 광고주 활동 이력 한 줄. */
export interface AdvertiserActivityEntry {
  id: number;
  action: string;
  /** 서버가 내려주는 한글 라벨(리드 열람 / 상태 변경 / 메모 …). */
  actionLabel: string;
  formId: number | null;
  leadId: number | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

/**
 * 확신 등급.
 * - NO_ADVERTISER: 이 리드폼에 배정된 광고주가 없다(섹션 숨김)
 * - NOT_VIEWED: 포털 열람 기록 없음 (알림톡·시트로만 일했을 수도 있어 '안 봤다'의 확정은 아니다)
 * - VIEWED: 열어는 봤다
 * - ACTED: 상태 변경·메모 등 행동까지 있었다(가장 강한 증거)
 */
export type AdvertiserActivityLevel = "NO_ADVERTISER" | "NOT_VIEWED" | "VIEWED" | "ACTED";

export interface LeadAdvertiserActivity {
  leadId: number;
  advertiserId: number | null;
  advertiserName: string | null;
  advertiserEmail: string | null;
  advertiserActive: boolean;
  /** 포털 마지막 로그인. 열람 기록이 없을 때 원인(로그인 자체를 안 함)을 가늠하는 데 쓴다. */
  advertiserLastLoginAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  /** 열람 횟수. 30분 안의 재열람은 한 번으로 접힌다. */
  viewCount: number;
  acted: boolean;
  level: AdvertiserActivityLevel;
  entries: AdvertiserActivityEntry[];
}

/** 이 리드를 광고주가 보기는 했는지(요약 + 시간순 이력). */
export function getLeadAdvertiserActivity(leadId: number): Promise<LeadAdvertiserActivity> {
  return request<LeadAdvertiserActivity>(`/api/leads/${leadId}/advertiser-activity`);
}

// ---------- 통합 진행상태(V29) ----------
// 마케터·광고주가 같은 축을 쓴다: 신규/유효/AS요청/무효 + 광고주 커스텀 상태.
// 유효(VALID)로 넘기는 순간 과금(단가 차감)이 확정된다. 무효 전환·해제는 마케터만.

/** 상태 선택지 하나. key 는 필터·카운트 키(고정=코드, 커스텀=C{id}). */
export interface LeadStatusOption {
  key: string;
  status: string;
  customStatusId: number | null;
  label: string;
  custom: boolean;
  archived: boolean;
}

/** 고정 상태 라벨(선택지 로딩 전 표시·색상용). */
export const FIXED_LEAD_STATUSES: Record<string, string> = {
  NEW: "신규",
  VALID: "유효",
  AS_REQUESTED: "AS요청",
  INVALID: "무효",
};

/** 이 폼에서 쓸 수 있는 상태 선택지(고정 4 + 연결된 광고주의 커스텀). */
export function getLeadStatusOptions(formId: number): Promise<LeadStatusOption[]> {
  return request<LeadStatusOption[]>(`/api/leads/status-options?formId=${formId}`);
}

/** 리드 상태 변경(마케터). status=CUSTOM 이면 customStatusId 필수. AS요청은 AS 플로우 전용. */
export function updateLeadStatus(id: number, status: string, customStatusId?: number | null): Promise<void> {
  return request<void>(`/api/leads/${id}/status`, {
    method: "PATCH",
    body: { status, customStatusId: customStatusId ?? null },
  });
}

// ---------- AS 요청(V30) ----------
export interface AsRequest {
  id: number;
  status: "OPEN" | "ACCEPTED" | "REJECTED";
  reason: string;
  evidenceUrls: string[];
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** 이 리드의 AS 이력(최신순, 마케터). */
export function listAsRequests(leadId: number): Promise<AsRequest[]> {
  return request<AsRequest[]>(`/api/leads/${leadId}/as-requests`);
}

/** AS 해소(마케터). 인정 → 리드 무효(차감 환급) / 거부 → 유효 확정. */
export function resolveAsRequest(leadId: number, accept: boolean, note?: string): Promise<AsRequest> {
  return request<AsRequest>(`/api/leads/${leadId}/as-resolve`, {
    method: "POST",
    body: { accept, note: note ?? "" },
  });
}

// ---------- 광고주 정산(V31, 마케터) ----------
export interface LedgerRow {
  id: number;
  entryType: "CHARGE" | "DEBIT" | "REFUND" | "ADJUST";
  amount: number;
  leadId: number | null;
  memo: string | null;
  createdAt: string;
}
export interface BillingView {
  linked: boolean;
  advertiserName: string | null;
  notifyPhoneMasked: string | null;
  unitPrice: number;
  dailyGoal: number;
  totalGoal: number;
  balanceAlertEnabled: boolean;
  balanceAlertThreshold: number;
  balanceAlertPhone: string | null;
  balance: number;
  earnedThisMonth: number;
  todayLeads: number;
  /** 승인 대기 — 유효도 무효도 아닌 리드(신규·커스텀·AS요청). */
  pendingLeads: number;
  validLeads: number;
  ledger: LedgerRow[];
}
export interface BillingSettingsInput {
  unitPrice: number;
  dailyGoal: number;
  totalGoal: number;
  balanceAlertEnabled: boolean;
  balanceAlertThreshold: number;
  balanceAlertPhone: string;
}

export function getFormBilling(formId: number): Promise<BillingView> {
  return request<BillingView>(`/api/forms/${formId}/billing`);
}
export function updateFormBilling(formId: number, input: BillingSettingsInput): Promise<BillingView> {
  return request<BillingView>(`/api/forms/${formId}/billing`, { method: "PUT", body: input });
}
/** 충전 기록. 잔액이 임계값 위로 회복되면 잔액 알림 억제가 풀린다. */
export function chargeFormBilling(formId: number, amount: number, memo: string): Promise<BillingView> {
  return request<BillingView>(`/api/forms/${formId}/billing/charge`, {
    method: "POST",
    body: { amount, memo },
  });
}

/** 정산 총괄 한 줄 — 과금 계약이 걸린 리드폼 하나. */
export interface BillingOverviewRow {
  formId: number;
  formName: string;
  advertiserName: string;
  unitPrice: number;
  dailyGoal: number;
  totalGoal: number;
  balanceAlertEnabled: boolean;
  balance: number;
  earnedThisMonth: number;
  todayLeads: number;
  pendingLeads: number;
  validLeads: number;
}
/** 정산 총괄(마케터 '정산' 메뉴) — 계약 걸린 리드폼 전부의 잔액·수익·목표 진행. */
export function getBillingOverview(): Promise<BillingOverviewRow[]> {
  return request<BillingOverviewRow[]>("/api/billing/overview");
}

// ---------- 목표 보고서 (2026-08-09) ----------
// 설정은 리드폼 편집에서 settingsConfig(goalEnabled·goalDaily·goalMonthly·goalStart·goalEnd)로 저장.
export interface GoalDayRow {
  date: string;
  count: number;
  /** 일간 목표 달성 여부. 목표가 0이면 판정 없음(null). */
  met: boolean | null;
}
export interface GoalMonthRow {
  month: string;
  count: number;
  /** 월간 목표 달성. 진행 중인 달의 미달은 null(아직 실패 아님). */
  met: boolean | null;
}
export interface GoalReportRow {
  formId: number;
  formName: string;
  dailyTarget: number;
  monthlyTarget: number;
  startDate: string;
  endDate: string;
  active: boolean;
  todayCount: number;
  monthCount: number;
  totalCount: number;
  /** 기간 경과율 0~1 */
  periodProgress: number;
  days: GoalDayRow[];
  months: GoalMonthRow[];
}
/** 목표가 켜진 내 리드폼 전부의 달성 보고서. */
export function getGoalReport(): Promise<GoalReportRow[]> {
  return request<GoalReportRow[]>("/api/goals/report");
}

/** 리드 단건 상세(본인 리드폼만). */
export function getLead(id: number): Promise<Lead> {
  return request<Lead>(`/api/leads/${id}`);
}

/** 리드 태그 교체. */
export function updateLeadTags(id: number, tags: string[]): Promise<Lead> {
  return request<Lead>(`/api/leads/${id}/tags`, { method: "PUT", body: { tags } });
}

/** 리드 메모/이력 목록(오래된 순). */
export function listLeadNotes(id: number): Promise<LeadNote[]> {
  return request<LeadNote[]>(`/api/leads/${id}/notes`);
}

/**
 * 사용자 메모 추가. shared=true → 광고주메모(광고주와 공유), false → 마케터메모(마케터만).
 */
export function addLeadNote(id: number, body: string, shared = false): Promise<LeadNote> {
  return request<LeadNote>(`/api/leads/${id}/notes`, { method: "POST", body: { body, shared } });
}

/** 메모 삭제(사용자 메모만). */
export function deleteLeadNote(id: number, noteId: number): Promise<void> {
  return request<void>(`/api/leads/${id}/notes/${noteId}`, { method: "DELETE" });
}

// ---------- 외부 연동 ----------
// 텔레그램은 계정 단위(아래). 구글시트는 리드폼별 설정(form.settingsConfig 의 sheets*)으로 관리.
export interface IntegrationSettings {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  /**
   * 구글시트 연동에 쓰는 서비스 계정 이메일. 서버 공통 값이라 **읽기 전용**이다(저장 시 보내지 않는다).
   * 광고주에게 "이 이메일을 시트 편집자로 추가하세요" 라고 안내할 주소. 서버에 키가 없으면 빈 문자열.
   */
  sheetsServiceAccountEmail?: string;
}
export interface IntegrationTestResult {
  results: { channel: string; ok: boolean; message: string }[];
}

/** 내 계정 텔레그램 연동 설정 조회. */
export function getIntegrations(): Promise<IntegrationSettings> {
  return request<IntegrationSettings>("/api/integrations");
}
/** 내 계정 텔레그램 연동 설정 저장. */
export function updateIntegrations(input: IntegrationSettings): Promise<IntegrationSettings> {
  return request<IntegrationSettings>("/api/integrations", { method: "PUT", body: input });
}
/** 계정 텔레그램 채널 테스트 발송. */
export function testIntegrations(): Promise<IntegrationTestResult> {
  return request<IntegrationTestResult>("/api/integrations/test", { method: "POST" });
}
/** 특정 리드폼의 구글시트 설정으로 테스트 발송. */
export function testFormSheets(formId: number): Promise<IntegrationTestResult> {
  return request<IntegrationTestResult>(`/api/integrations/test-sheets?formId=${formId}`, { method: "POST" });
}

/** 내보내기 가능한 컬럼 목록(접수일시·상태 → 답변항목 → 방문자정보 순). */
export function getLeadColumns(formId: number): Promise<string[]> {
  return request<string[]>(`/api/leads/columns?formId=${formId}`);
}

/**
 * 리드 내보내기(형식·선택 컬럼·선택 리드). columns 생략/빈 배열이면 전체 컬럼,
 * ids 생략/빈 배열이면 전체 리드. ids 를 넘기면 그 리드만(현재 화면 필터 반영).
 */
export async function downloadLeads(
  formId: number,
  opts: { format: "csv" | "xlsx"; columns?: string[]; ids?: number[]; formName?: string },
): Promise<void> {
  const res = await authedFetch(`/api/leads/export?formId=${formId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: opts.format, columns: opts.columns ?? null, ids: opts.ids ?? null }),
  });
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.formName || "leads"}.${opts.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- IP 차단(K2) ----------
export interface IpBlock {
  id: number;
  pattern: string; // 단일 IP 또는 CIDR 대역
  reason: string | null;
  createdAt: string;
}
export interface IpBlockInput {
  pattern: string;
  reason?: string;
}
export interface IpBlockHit {
  id: number;
  ip: string;
  matchedPattern: string | null;
  userAgent: string | null;
  referer: string | null;
  createdAt: string;
}

/** 리드폼의 IP 차단 규칙 목록(본인 리드폼만). */
export function listIpBlocks(formId: number): Promise<IpBlock[]> {
  return request<IpBlock[]>(`/api/forms/${formId}/ip-blocks`);
}
/** 차단 규칙 추가(단일 IP 또는 CIDR). */
export function addIpBlock(formId: number, input: IpBlockInput): Promise<IpBlock> {
  return request<IpBlock>(`/api/forms/${formId}/ip-blocks`, { method: "POST", body: input });
}
/** 차단 규칙 삭제. */
export function deleteIpBlock(formId: number, blockId: number): Promise<void> {
  return request<void>(`/api/forms/${formId}/ip-blocks/${blockId}`, { method: "DELETE" });
}
/** 차단 접속(제출 시도) 로그. */
export function listIpBlockHits(formId: number): Promise<IpBlockHit[]> {
  return request<IpBlockHit[]>(`/api/forms/${formId}/ip-blocks/hits`);
}
/** 차단 접속 로그 전체 비우기. */
export function clearIpBlockHits(formId: number): Promise<void> {
  return request<void>(`/api/forms/${formId}/ip-blocks/hits`, { method: "DELETE" });
}

/* ----- 계정 전역 접속 차단 -----
   위(리드폼별)는 '제출'을 막고, 이쪽은 공개 화면 '접속' 자체를 막는다. */

/** 전역 접속 차단 규칙 목록. */
export function listSiteIpBlocks(): Promise<IpBlock[]> {
  return request<IpBlock[]>("/api/site-ip-blocks");
}
/** 전역 접속 차단 규칙 추가(단일 IP 또는 CIDR). */
export function addSiteIpBlock(input: IpBlockInput): Promise<IpBlock> {
  return request<IpBlock>("/api/site-ip-blocks", { method: "POST", body: input });
}
/** 전역 접속 차단 규칙 삭제. */
export function deleteSiteIpBlock(blockId: number): Promise<void> {
  return request<void>(`/api/site-ip-blocks/${blockId}`, { method: "DELETE" });
}

export interface SiteIpBlockHit {
  id: number;
  ip: string;
  matchedPattern: string | null;
  /** LANDING | FORM | SUBMIT */
  source: string;
  /** 한국어 라벨(랜딩 열람·리드폼 열람·리드 제출) */
  sourceLabel: string;
  userAgent: string | null;
  createdAt: string;
}
/** 차단된 접속 시도 로그. */
export function listSiteIpBlockHits(): Promise<SiteIpBlockHit[]> {
  return request<SiteIpBlockHit[]>("/api/site-ip-blocks/hits");
}
/** 차단 시도 로그 비우기. */
export function clearSiteIpBlockHits(): Promise<void> {
  return request<void>("/api/site-ip-blocks/hits", { method: "DELETE" });
}

// ---------- 랜딩페이지 ----------
export type LandingBlockType = "IMAGE" | "TEXT" | "HTML" | "FORM";
export interface LandingBlock {
  type: LandingBlockType;
  /** 편집 화면에서만 쓰는 블록 이름(예: "헤더 이미지", "선착순 HTML"). 공개 페이지에는 노출하지 않는다. */
  name?: string;
  // IMAGE: {url, alt} · TEXT: {text} · HTML: {html} · FORM: {formId, trigger:"inline"|"overlay", buttonLabel}
  [key: string]: unknown;
}
export interface LandingInput {
  title: string;
  content: LandingBlock[];
  status?: string;
  slug?: string; // 미지정 시 서버가 자동 생성. 지정 시 소문자·숫자·하이픈 3~120자.
  tracking?: Record<string, unknown> | null; // 광고 픽셀 {google,meta,tiktok,kakao,daangn}
}
export interface LandingDetail extends LandingInput {
  id: number;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface LandingSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
}
export interface PublicLanding {
  id: number;
  title: string;
  content: LandingBlock[];
  forms: Record<string, FormDetail>;
  tracking?: Record<string, unknown> | null;
}

export function listLandings(): Promise<LandingSummary[]> {
  return request<LandingSummary[]>("/api/landings");
}
export function getLanding(id: number): Promise<LandingDetail> {
  return request<LandingDetail>(`/api/landings/${id}`);
}
export function createLanding(input: LandingInput): Promise<LandingDetail> {
  return request<LandingDetail>("/api/landings", { method: "POST", body: input });
}
export function updateLanding(id: number, input: LandingInput): Promise<LandingDetail> {
  return request<LandingDetail>(`/api/landings/${id}`, { method: "PUT", body: input });
}
export function deleteLanding(id: number): Promise<void> {
  return request<void>(`/api/landings/${id}`, { method: "DELETE" });
}
/** 공개 사이트 해석(비로그인): {subdomain}.도메인/{랜딩번호|슬러그}. published 만 열림. */
export function resolveSite(subdomain: string, identifier: string): Promise<PublicLanding> {
  return request<PublicLanding>(
    `/api/public/sites/${encodeURIComponent(subdomain)}/${encodeURIComponent(identifier)}`,
    { auth: false },
  );
}

/** 소유자 미리보기(/p/{slug}, 로그인·본인만, draft 포함). 남의 것/없으면 404. */
export function getLandingPreview(slug: string): Promise<PublicLanding> {
  return request<PublicLanding>(`/api/landings/preview/${encodeURIComponent(slug)}`);
}

// ---------- 동적 요소(M8) 실시간 집계 ----------
export interface LandingLive {
  count: number; // 연결폼 활성 리드 수
  recent: { name: string; at: string }[]; // 최근 신청자(이름 마스킹)
}
/** 공개 랜딩 동적 요소용 실시간 집계(비로그인). 신청수·최근 신청자. */
export function getLandingLive(id: number): Promise<LandingLive> {
  return request<LandingLive>(`/api/public/landings/${id}/live`, { auth: false });
}

// ---------- 통계 ----------
export interface StatCount {
  key: string;
  count: number;
}
export interface StatDayPoint {
  date: string;
  visits: number;
  leads: number;
}
export interface StatEntityCount {
  id: number | null;
  name: string;
  uniqueVisits: number;
  totalVisits: number;
  leads: number;
  conversionRate: number;
}
export interface StatsOverview {
  from: string;
  to: string;
  summary: { uniqueVisits: number; totalVisits: number; leads: number; conversionRate: number };
  byDay: StatDayPoint[];
  byDevice: StatCount[];
  byOs: StatCount[];
  byBrowser: StatCount[];
  byUtmSource: StatCount[];
  byUtmMedium: StatCount[];
  byUtmCampaign: StatCount[];
  /** 자체 광고 파라미터(광고 URL 빌더 3종) — 표준 UTM 과 병행 수집 */
  byMediaFrom: StatCount[];
  byCampaignName: StatCount[];
  byAdsName: StatCount[];
  byReferer: StatCount[];
  byStatus: StatCount[];
  byLanding: StatEntityCount[];
  byForm: StatEntityCount[];
  /** 유입별 비교 표(자체 파라미터 3키) — 값별 방문·리드·전환율. 행 클릭 → 유입 필터 */
  byUtmTables: StatUtmTable[];
  funnel: StatFunnel;
  byEvent: StatCount[];
}
export interface StatUtmTable {
  key: string; // media_from | campaign_name | ads_name
  rows: { value: string; uniqueVisits: number; totalVisits: number; leads: number; conversionRate: number }[];
}
export interface StatFunnel {
  visits: number; // 순방문
  formOpens: number; // 폼 열기(고유 방문자)
  leads: number; // 접수
  openRate: number; // 방문→폼열기 %
  submitRate: number; // 폼열기→접수 %
}
export interface StatsFilter {
  from?: string;
  to?: string;
  landingId?: number | null;
  formId?: number | null;
  /** 유입 필터 — 키·값 둘 다 있어야 적용. 걸면 요약·추이·카드 전부 그 유입만으로 재계산 */
  utmKey?: string;
  utmValue?: string;
}
export function getStats(filter: StatsFilter = {}): Promise<StatsOverview> {
  const p = new URLSearchParams();
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.landingId != null) p.set("landingId", String(filter.landingId));
  if (filter.formId != null) p.set("formId", String(filter.formId));
  if (filter.utmKey && filter.utmValue) {
    p.set("utmKey", filter.utmKey);
    p.set("utmValue", filter.utmValue);
  }
  const qs = p.toString();
  return request<StatsOverview>(`/api/stats/overview${qs ? `?${qs}` : ""}`);
}

/**
 * 통계 보고서 엑셀 다운로드 — 화면 필터(기간·대상·유입) 그대로 + 섹션 선택.
 * 섹션 키: summary·trend·utm·landing·form·device·status·referer (비우면 전체).
 * "보고서 정의 = 기간 + 필터 + 섹션"은 나중 '광고주 리포트 발송'과 공유하는 모양이다.
 */
export async function downloadStatsReport(filter: StatsFilter, sections: string[], filename: string): Promise<void> {
  const res = await authedFetch("/api/stats/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: filter.from ?? null,
      to: filter.to ?? null,
      landingId: filter.landingId ?? null,
      formId: filter.formId ?? null,
      utmKey: filter.utmKey && filter.utmValue ? filter.utmKey : null,
      utmValue: filter.utmKey && filter.utmValue ? filter.utmValue : null,
      sections,
    }),
  });
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 공개 방문 기록(비로그인, best-effort). 공개 랜딩/리드폼 진입 시 1회 호출. */
export function recordVisit(input: { landingPageId?: number | null; formId?: number | null; utm?: Record<string, string> }): void {
  request<void>("/api/public/visits", { method: "POST", body: input, auth: false }).catch(() => {
    /* 방문 기록 실패는 무시 */
  });
}

/** 공개 이벤트 기록(비로그인, best-effort). 주요 클릭(폼 열기 등) 시 호출 — 전환 퍼널·요소 클릭 통계(I4/I5). */
export function recordEvent(input: { landingPageId?: number | null; formId?: number | null; eventType: string; target?: string }): void {
  request<void>("/api/public/events", { method: "POST", body: input, auth: false }).catch(() => {
    /* 이벤트 기록 실패는 무시 */
  });
}

// ---------- 이미지 업로드 ----------
/** 이미지 파일 업로드(로그인 필요) → 절대 URL 반환. type 은 저장 경로 프리픽스({type}-image/…), 생략 시 landing. */
export async function uploadImage(file: File, type?: string): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  if (type) fd.append("type", type);
  const res = await authedFetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) throw await parseError(res);
  // 백엔드가 절대 URL(로컬=서버주소 / R2=공개베이스URL)을 반환
  return (await res.json()) as { url: string };
}

// ---------- 광고주 하위계정 (마케터가 관리) ----------
export interface AdvertiserSummary {
  id: number;
  email: string;
  name: string;
  company: string | null;
  /** 마케터만 보는 내부 메모 */
  memo: string | null;
  active: boolean;
  /** 부여된 리드폼 수 */
  grantCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdvertiserUpdateInput {
  name?: string;
  company?: string;
  memo?: string;
}

/** 권한 부여 화면의 한 줄 = 내 리드폼 하나 */
export interface GrantView {
  formId: number;
  formName: string;
  /** 이 광고주에게 부여됐는지 */
  granted: boolean;
  /** 광고주에게 보일 이름(비면 원래 폼 이름) */
  displayName: string | null;
  expiresAt: string | null;
  canStatus: boolean;
  canMemo: boolean;
  canExport: boolean;
  /** 다른 광고주가 이미 쓰는 폼이면 그 이름(1리드폼:1광고주) */
  takenBy: string | null;
}

export interface GrantInput {
  formId: number;
  displayName?: string | null;
  expiresAt?: string | null;
  canStatus?: boolean;
  canMemo?: boolean;
  canExport?: boolean;
}

export interface AdvertiserInvite {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  /** 발급/재발급 응답에만 담긴다(DB에는 해시만 저장 — 이후 다시 볼 수 없음) */
  token: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface InviteInput {
  email: string;
  name?: string;
  company?: string;
}

export function listAdvertisers(): Promise<AdvertiserSummary[]> {
  return request<AdvertiserSummary[]>("/api/advertisers");
}
export function updateAdvertiser(id: number, input: AdvertiserUpdateInput): Promise<AdvertiserSummary> {
  return request<AdvertiserSummary>(`/api/advertisers/${id}`, { method: "PUT", body: input });
}
/** 정지/해제 — 정지하면 로그인·토큰 재발급이 즉시 막힌다. */
export function setAdvertiserActive(id: number, active: boolean): Promise<void> {
  return request<void>(`/api/advertisers/${id}/active`, { method: "PATCH", body: { active } });
}
export function deleteAdvertiser(id: number): Promise<void> {
  return request<void>(`/api/advertisers/${id}`, { method: "DELETE" });
}

/** 광고주 활동 이력 한 줄(개인정보 취급 추적 · 분쟁 방어 증거). */
export interface AdvertiserLog {
  id: number;
  action: string;
  actionLabel: string;
  formId: number | null;
  leadId: number | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}
/** 마케터 화면: 내 광고주의 활동 이력(최신순). */
export function getAdvertiserLogs(advertiserId: number, limit?: number): Promise<AdvertiserLog[]> {
  const qs = limit ? `?limit=${limit}` : "";
  return request<AdvertiserLog[]>(`/api/advertisers/${advertiserId}/logs${qs}`);
}

/** 마케터 화면: 내 광고주의 처리속도 리포트(배정 폼 전체 합산). AdvertiserReport 타입 재사용. */
export function getAdvertiserResponseReport(
  advertiserId: number,
  from?: string,
  to?: string,
): Promise<AdvertiserReport> {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return request<AdvertiserReport>(`/api/advertisers/${advertiserId}/reports/response-time${qs}`);
}

// ---------- 광고주 화면 미리보기(A7, 읽기 전용) ----------
export interface AdvertiserPreview {
  advertiserId: number;
  advertiserName: string;
  advertiserCompany: string | null;
  forms: AdvertiserForm[];
  dashboard: AdvertiserDashboard;
}
export interface AdvertiserPreviewLead {
  lead: AdvertiserLead;
  notes: AdvertiserNote[];
}
/** 미리보기 진입(IMPERSONATE 로그). 폼 목록·대시보드를 광고주 시점으로 받는다. */
export function previewEnter(advertiserId: number): Promise<AdvertiserPreview> {
  return request<AdvertiserPreview>(`/api/advertisers/${advertiserId}/preview`);
}
/** 미리보기 리드 목록(읽기 전용). */
export function previewLeads(advertiserId: number, filter: AdvertiserLeadFilter): Promise<AdvertiserLeadPage> {
  const p = new URLSearchParams({ formId: String(filter.formId) });
  if (filter.status) p.set("status", filter.status);
  if (filter.q) p.set("q", filter.q);
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.page != null) p.set("page", String(filter.page));
  if (filter.size != null) p.set("size", String(filter.size));
  return request<AdvertiserLeadPage>(`/api/advertisers/${advertiserId}/preview/leads?${p.toString()}`);
}
/** 미리보기 리드 상세(읽기 전용, seen 미기록) + 공유 메모. */
export function previewLead(advertiserId: number, leadId: number): Promise<AdvertiserPreviewLead> {
  return request<AdvertiserPreviewLead>(`/api/advertisers/${advertiserId}/preview/leads/${leadId}`);
}
/** 미리보기 이탈 기록(best-effort). */
export function previewExit(advertiserId: number): Promise<void> {
  return request<void>(`/api/advertisers/${advertiserId}/preview/exit`, { method: "POST" });
}

/** 화이트라벨(마케터 브랜드) — 광고주 화면 상단에 표시되는 로고·색상. */
export interface BrandSettings {
  logoUrl: string | null;
  color: string | null;
}
export function getBrand(): Promise<BrandSettings> {
  return request<BrandSettings>("/api/advertisers/brand");
}
export function updateBrand(input: BrandSettings): Promise<BrandSettings> {
  return request<BrandSettings>("/api/advertisers/brand", { method: "PUT", body: input });
}

/** 권한 부여 화면 데이터(내 리드폼 전체 + 부여 상태 + 선점 여부). */
export function listGrants(advertiserId: number): Promise<GrantView[]> {
  return request<GrantView[]>(`/api/advertisers/${advertiserId}/grants`);
}
/** 권한 일괄 교체 — 목록에 없는 리드폼은 회수된다. */
export function replaceGrants(advertiserId: number, grants: GrantInput[]): Promise<GrantView[]> {
  return request<GrantView[]>(`/api/advertisers/${advertiserId}/grants`, { method: "PUT", body: { grants } });
}

/** 리드폼 편집 화면에 띄울 광고주 접수 알림 수신 상태. 번호 원본은 내려오지 않는다(마스킹만). */
export interface AdvertiserNotifyStatus {
  /** 이 리드폼에 광고주 계정이 연결돼 있는지 */
  linked: boolean;
  advertiserName: string | null;
  /** 지금 실제로 발송되는 상태인지 — 번호가 있고 이 폼이 꺼져 있지 않아야 true */
  registered: boolean;
  /** 실제 발송 번호의 뒤 4자리를 가린 값. 발송 불가면 null */
  phoneMasked: string | null;
  /** 번호 출처(V33): FORM=이 폼 전용, ACCOUNT=광고주 계정 기본, NONE=없음 */
  source: "FORM" | "ACCOUNT" | "NONE";
  /** 광고주가 이 폼만 알림을 끈 상태인지. 미등록과 조치가 다르므로 구분해 안내한다. */
  disabledByAdvertiser: boolean;
}
export function getAdvertiserNotifyStatus(formId: number): Promise<AdvertiserNotifyStatus> {
  return request<AdvertiserNotifyStatus>(`/api/advertisers/notify-status/${formId}`);
}

export function issueInvite(input: InviteInput): Promise<AdvertiserInvite> {
  return request<AdvertiserInvite>("/api/advertisers/invites", { method: "POST", body: input });
}
export function listInvites(): Promise<AdvertiserInvite[]> {
  return request<AdvertiserInvite[]>("/api/advertisers/invites");
}
/** 링크 재발급(이전 링크 즉시 무효). 링크를 잃어버렸을 때. */
export function reissueInvite(inviteId: number): Promise<AdvertiserInvite> {
  return request<AdvertiserInvite>(`/api/advertisers/invites/${inviteId}/reissue`, { method: "POST" });
}
export function cancelInvite(inviteId: number): Promise<void> {
  return request<void>(`/api/advertisers/invites/${inviteId}`, { method: "DELETE" });
}

/** 초대 링크(광고주에게 전달할 URL). 현재 접속한 오리진 기준으로 만든다. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

// ---------- 광고주 비밀번호 재설정 ----------
export interface PasswordResetIssued {
  email: string;
  /** 발급 시점에만 값이 있다(DB에는 해시만 저장) */
  token: string;
  expiresAt: string;
}

export interface PasswordResetInfo {
  email: string;
  marketerName: string | null;
  marketerCompany: string | null;
}

/** 마케터가 광고주 비밀번호 재설정 링크 발급(이전 링크는 즉시 무효). */
export function issuePasswordReset(advertiserId: number): Promise<PasswordResetIssued> {
  return request<PasswordResetIssued>(`/api/advertisers/${advertiserId}/password-reset`, { method: "POST" });
}

export function passwordResetUrl(token: string): string {
  return `${window.location.origin}/client/reset/${token}`;
}

export function getPasswordResetInfo(token: string): Promise<PasswordResetInfo> {
  return request<PasswordResetInfo>(`/api/public/advertiser-password-resets/${encodeURIComponent(token)}`, {
    auth: false,
  });
}

export function completePasswordReset(token: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>(`/api/public/advertiser-password-resets/${encodeURIComponent(token)}`, {
    method: "POST",
    body: { password },
    auth: false,
  });
}

// ---------- 광고주 브랜드 기억 (로그인 화면 화이트라벨용) ----------
const CLIENT_BRAND_KEY = "leadpot-client-brand";

export interface ClientBrand {
  marketerName: string | null;
  marketerCompany: string | null;
}

/**
 * 초대 수락·비밀번호 재설정 시점에 담당 마케터를 기억해둔다.
 * 로그인 화면에서는 아직 로그인 전이라 서버에 물어볼 수 없으므로,
 * 이 값으로 "○○ 리드 확인" 처럼 마케터 이름을 보여준다(없으면 리드팟 기본).
 */
export function rememberClientBrand(brand: ClientBrand) {
  try {
    localStorage.setItem(CLIENT_BRAND_KEY, JSON.stringify(brand));
  } catch {
    // 저장 실패는 무시(브랜드 표시는 부가 기능)
  }
}

export function getClientBrand(): ClientBrand | null {
  try {
    const raw = localStorage.getItem(CLIENT_BRAND_KEY);
    return raw ? (JSON.parse(raw) as ClientBrand) : null;
  } catch {
    return null;
  }
}

// ---------- 광고주 포털 (ROLE_ADVERTISER 전용) ----------
// 진행상태는 V29 부터 마케터와 공유하는 단일 축이다(신규/유효/AS요청/무효 + 커스텀).
// 광고주는 무효를 지정할 수 없고(마케터 전용), AS요청은 AS 접수로만 만들어진다.

export interface AdvertiserMe {
  id: number;
  email: string;
  name: string;
  company: string | null;
  marketerName: string;
  marketerCompany: string | null;
  brandLogoUrl: string | null;
  brandColor: string | null;
  /**
   * 내가 등록한 **계정 기본** 접수 알림 수신번호(V33). 비어 있으면 미등록.
   * 배정된 모든 리드폼에 적용되고, 폼 전용 번호가 있는 폼만 그 값이 우선한다.
   */
  notifyPhone: string;
}

export interface AdvertiserForm {
  formId: number;
  /** 마케터가 지정한 표시 이름(내부 폼명이 아님) */
  name: string;
  leadCount: number;
  unseenCount: number;
  canStatus: boolean;
  canMemo: boolean;
  canExport: boolean;
  /** 마케터가 이 리드폼의 접수 알림을 켰는지. 꺼져 있으면 번호를 넣어도 발송되지 않는다. */
  notifyEnabled: boolean;
  /** 이 리드폼에만 지정한 전용 번호. 비어 있으면 계정 기본 번호를 따라간다(V33). */
  notifyPhone: string;
  /** true 면 이 리드폼만 알림을 끈 상태(계정 기본 번호가 있어도 안 간다). */
  notifyDisabled: boolean;
  /** 실제로 발송될 번호(폼 전용 → 계정 기본 순). 끄거나 둘 다 없으면 빈 문자열. */
  effectiveNotifyPhone: string;
}

/** 광고주에게 내려오는 리드 — IP·UTM·태그는 서버에서 제외된다. 상태는 공유 축(V29). */
export interface AdvertiserLead {
  id: number;
  answers: LeadAnswer[];
  createdAt: string;
  status: string;
  /** 필터·표시 키(고정=코드, 커스텀=C{id}) */
  statusKey: string;
  customStatusId: number | null;
  statusLabel: string;
  advertiserSeenAt: string | null;
}

export interface AdvertiserLeadPage {
  items: AdvertiserLead[];
  total: number;
  page: number;
  size: number;
}

export interface AdvertiserNote {
  id: number;
  kind: "MEMO" | "SYSTEM";
  body: string;
  mine: boolean;
  /** 작성자 역할 표기(마케터/광고주). null = 작성자 삭제·미상. */
  authorRole: "MARKETER" | "ADVERTISER" | null;
  createdAt: string;
}

export interface AdvertiserDashboard {
  totalLeads: number;
  unseenLeads: number;
  todayLeads: number;
  byStatus: Record<string, number>;
}

export interface AdvertiserLeadFilter {
  formId: number;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export function getAdvertiserMe(): Promise<AdvertiserMe> {
  return request<AdvertiserMe>("/api/advertiser/me");
}
export function listAdvertiserForms(): Promise<AdvertiserForm[]> {
  return request<AdvertiserForm[]>("/api/advertiser/forms");
}
/**
 * 접수 알림을 받을 **내 기본 번호**를 등록·변경한다 — 배정된 **모든** 리드폼에 적용된다(V33).
 * 빈 문자열이면 해제된다. 마케터는 이 번호를 대신 넣을 수 없다 —
 * 본인이 넣는 행위가 수신 동의 근거다(MESSAGING-PLAN §9).
 */
export function updateAdvertiserDefaultNotifyPhone(phone: string): Promise<{ notifyPhone: string }> {
  return request<{ notifyPhone: string }>("/api/advertiser/notify-phone", {
    method: "PUT",
    body: { phone },
  });
}

/** 이 리드폼만 알림을 끄거나 다시 켠다. 번호를 비우는 것과 다르다(비우면 기본 번호를 따라간다). */
export function updateAdvertiserNotifyDisabled(formId: number, disabled: boolean): Promise<AdvertiserForm> {
  return request<AdvertiserForm>(`/api/advertiser/forms/${formId}/notify-disabled`, {
    method: "PUT",
    body: { disabled },
  });
}

/**
 * **이 리드폼에만** 적용할 번호를 등록·변경한다. 빈 문자열이면 덮어쓰기가 해제되고
 * 계정 기본 번호를 따라간다(V33) — 발송이 멈추는 게 아니다.
 */
export function updateAdvertiserNotifyPhone(formId: number, phone: string): Promise<AdvertiserForm> {
  return request<AdvertiserForm>(`/api/advertiser/forms/${formId}/notify-phone`, {
    method: "PUT",
    body: { phone },
  });
}
export function getAdvertiserDashboard(): Promise<AdvertiserDashboard> {
  return request<AdvertiserDashboard>("/api/advertiser/dashboard");
}
export function listAdvertiserLeads(filter: AdvertiserLeadFilter): Promise<AdvertiserLeadPage> {
  const p = new URLSearchParams({ formId: String(filter.formId) });
  if (filter.status) p.set("status", filter.status);
  if (filter.q) p.set("q", filter.q);
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.page != null) p.set("page", String(filter.page));
  if (filter.size != null) p.set("size", String(filter.size));
  return request<AdvertiserLeadPage>(`/api/advertiser/leads?${p.toString()}`);
}
/** 상세 조회 — 서버가 최초 열람 시각을 기록한다(마케터가 '확인' 여부를 알 수 있게). */
export function getAdvertiserLead(id: number): Promise<AdvertiserLead> {
  return request<AdvertiserLead>(`/api/advertiser/leads/${id}`);
}
/** 상태 변경(광고주). 무효·AS요청은 보낼 수 없다(서버가 거부). status=CUSTOM 이면 customStatusId 필수. */
export function updateAdvertiserLeadStatus(
  id: number,
  status: string,
  customStatusId?: number | null,
): Promise<AdvertiserLead> {
  return request<AdvertiserLead>(`/api/advertiser/leads/${id}/status`, {
    method: "PATCH",
    body: { status, customStatusId: customStatusId ?? null },
  });
}
export function listAdvertiserNotes(id: number): Promise<AdvertiserNote[]> {
  return request<AdvertiserNote[]>(`/api/advertiser/leads/${id}/notes`);
}
export function addAdvertiserNote(id: number, body: string): Promise<AdvertiserNote> {
  return request<AdvertiserNote>(`/api/advertiser/leads/${id}/notes`, { method: "POST", body: { body } });
}

// ---------- 광고주 상태 선택지 + 커스텀 상태 관리(V29) ----------

/** 상태 선택지(고정 4 + 내 커스텀). 무효(INVALID)는 표시용 — 선택 불가로 그릴 것. */
export function getAdvertiserStatusOptions(): Promise<LeadStatusOption[]> {
  return request<LeadStatusOption[]>("/api/advertiser/lead-statuses");
}
/** 내 커스텀 상태 전부(보관 포함, 관리 화면용). */
export function listAdvertiserCustomStatuses(): Promise<LeadStatusOption[]> {
  return request<LeadStatusOption[]>("/api/advertiser/statuses");
}
export function createAdvertiserCustomStatus(name: string): Promise<LeadStatusOption> {
  return request<LeadStatusOption>("/api/advertiser/statuses", { method: "POST", body: { name } });
}
export function updateAdvertiserCustomStatus(
  id: number,
  input: { name?: string; archived?: boolean },
): Promise<LeadStatusOption> {
  return request<LeadStatusOption>(`/api/advertiser/statuses/${id}`, { method: "PATCH", body: input });
}
/** 삭제는 쓰는 리드가 없을 때만 된다(아니면 400 — 보관 안내). */
export function deleteAdvertiserCustomStatus(id: number): Promise<void> {
  return request<void>(`/api/advertiser/statuses/${id}`, { method: "DELETE" });
}

// ---------- 광고주 AS 요청(V30) ----------

/** AS 접수 — 사유 필수, 증빙은 uploadAdvertiserEvidence 로 올린 URL(최대 5장). */
export function requestAdvertiserAs(
  leadId: number,
  reason: string,
  evidenceUrls: string[],
): Promise<AsRequest> {
  return request<AsRequest>(`/api/advertiser/leads/${leadId}/as-request`, {
    method: "POST",
    body: { reason, evidenceUrls },
  });
}
/** 이 리드의 AS 이력(최신순, 광고주). */
export function listAdvertiserAsRequests(leadId: number): Promise<AsRequest[]> {
  return request<AsRequest[]>(`/api/advertiser/leads/${leadId}/as-requests`);
}
/** AS 증빙 이미지 업로드(jpg/png/gif/webp, 5MB 이하). 반환된 url 을 requestAdvertiserAs 에 넣는다. */
export async function uploadAdvertiserEvidence(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch("/api/advertiser/uploads", { method: "POST", body: fd });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { url: string };
}

/** 실시간 폴링(A6): since 이후 새 리드 수. serverTime 을 다음 since 로 넘긴다(시계 오차 방지). */
export interface AdvertiserLeadUpdates {
  newCount: number;
  serverTime: string;
}
export function getAdvertiserLeadUpdates(formId: number, since?: string): Promise<AdvertiserLeadUpdates> {
  const qs = since ? `&since=${encodeURIComponent(since)}` : "";
  return request<AdvertiserLeadUpdates>(`/api/advertiser/leads/updates?formId=${formId}${qs}`);
}

/** 처리속도 리포트(A7): 접수→열람/상태 평균, 미확인율, 유효율, 상태 분포. */
export interface AdvertiserReport {
  formId: number;
  formName: string;
  from: string | null;
  to: string | null;
  total: number;
  seen: number;
  unseen: number;
  unseenRate: number;
  /** 유효(상태가 '유효'인 리드) 건수. */
  converted: number;
  /**
   * 접수 대비 유효 비율(0~1). 방문수와 무관하다 — 광고주에게도 보여준다.
   * ⚠️ "전환율"이 아니다(2026-08-20) — 마케터 입장의 전환(신규→유효)일 뿐, 광고주 입장의
   * 진짜 전환(수임 완료 등)은 이 서비스가 모르는 값이라 이름을 유효율로 분리했다.
   */
  validRate: number;
  avgSecondsToSeen: number | null;
  avgSecondsToStatus: number | null;
  statusCounts: { status: string; label: string; count: number }[];
  /**
   * 접수 추이(구간순, 접수 없는 구간은 없음). period 형식은 trendGranularity를 따른다 —
   * DAY="yyyy-MM-dd", WEEK="yyyy-MM-dd"(그 주 월요일), MONTH="yyyy-MM".
   * 기간이 길수록 막대가 안 늘어나게 서버가 자동으로 단위를 넓힌다(2026-08-20).
   */
  trendCounts: { period: string; count: number }[];
  trendGranularity: "DAY" | "WEEK" | "MONTH";
  /** AS 요청 통계 — total 은 리드 수가 아니라 요청 건수(거부 후 재요청 시 리드 하나에 여러 건). */
  asStats: { total: number; open: number; accepted: number; rejected: number };
}
export function getAdvertiserReport(formId: number, from?: string, to?: string): Promise<AdvertiserReport> {
  const p = new URLSearchParams({ formId: String(formId) });
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  return request<AdvertiserReport>(`/api/advertiser/reports?${p.toString()}`);
}

// ---------- 광고주 알림 연동 (A5) ----------
// integration_settings 는 계정당 1행이라 마케터용 타입(IntegrationSettings/IntegrationTestResult)을 그대로 재사용한다.
/** 내 텔레그램 알림 설정 조회. */
export function getAdvertiserIntegration(): Promise<IntegrationSettings> {
  return request<IntegrationSettings>("/api/advertiser/integrations");
}
/** 내 텔레그램 알림 설정 저장. */
export function updateAdvertiserIntegration(input: IntegrationSettings): Promise<IntegrationSettings> {
  return request<IntegrationSettings>("/api/advertiser/integrations", { method: "PUT", body: input });
}
/** 내 텔레그램 채널 테스트 발송. */
export function testAdvertiserIntegration(): Promise<IntegrationTestResult> {
  return request<IntegrationTestResult>("/api/advertiser/integrations/test", { method: "POST" });
}

/**
 * 배정받은 리드 내보내기(A4). 화면 필터를 그대로 반영해 서버가 파일을 만든다.
 * 화이트리스트 컬럼(접수일시·상태·답변)만 + 하단 워터마크. 일일 횟수 상한 초과 시 에러.
 */
export async function downloadAdvertiserLeads(
  formId: number,
  opts: { format: "csv" | "xlsx"; status?: string; q?: string; from?: string; to?: string; formName?: string },
): Promise<void> {
  const p = new URLSearchParams({ formId: String(formId), format: opts.format });
  if (opts.status) p.set("status", opts.status);
  if (opts.q) p.set("q", opts.q);
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  const res = await authedFetch(`/api/advertiser/leads/export?${p.toString()}`, { method: "POST" });
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.formName || "leads"}.${opts.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- 초대 수락 (비로그인 공개) ----------
export interface InviteInfo {
  email: string;
  name: string | null;
  company: string | null;
  marketerName: string;
  marketerCompany: string | null;
}

export function getInviteInfo(token: string): Promise<InviteInfo> {
  return request<InviteInfo>(`/api/public/advertiser-invites/${encodeURIComponent(token)}`, { auth: false });
}
export function acceptInvite(
  token: string,
  input: { password: string; name?: string; phone?: string },
): Promise<TokenResponse> {
  return request<TokenResponse>(`/api/public/advertiser-invites/${encodeURIComponent(token)}`, {
    method: "POST",
    body: input,
    auth: false,
  });
}

// ---------- 문자 발송 ----------

/**
 * 발송 채널. 단가가 크게 갈리므로 계정별로 허용 여부를 나눈다.
 *
 * `ATA` = 알림톡(카카오). 마케터·광고주 접수 알림이 이 채널로 나가며 본문은 카카오 심사본으로 고정이다.
 */
export type SmsChannel = "SMS" | "LMS" | "MMS" | "ATA";

export interface SmsStatus {
  /** 지금 문자를 보낼 수 있는 상태인가(자격증명 + 계정 권한). */
  ready: boolean;
  /** 실제로 나갈 발신번호(마스킹됨). */
  senderPhone: string;
  /** 이번 달 사용량. */
  used: number;
  /**
   * 이번 달 한도.
   * ⚠️ **0 = 금지, -1 = 무제한** (V25). 예전에는 0 이 무제한이었다 — 반대다.
   */
  limit: number;
  /** 이번 달 실패 건수 — 자동 발송은 조용히 실패하므로 눈에 띄게 보여준다. */
  failed: number;
  plan: "FREE" | "PRO";
  /** 계정에 문자 발송 권한이 있는가. false 면 화면에서 안내하고 기능을 숨긴다. */
  smsEnabled: boolean;
  /** 이 계정이 쓸 수 있는 채널. 여기 없는 채널로 판정되면 발송이 막힌다. */
  allowedChannels: SmsChannel[];
  /** 남은 발송 건수. */
  remaining: number;
}

export interface MessageLogItem {
  id: number;
  channel: string; // SMS | LMS
  recipientType: string; // MARKETER | ADVERTISER | LEAD | TEST
  recipient: string; // 마스킹된 수신번호
  body: string | null;
  status: string; // SENT | FAILED | SKIPPED
  error: string | null;
  systemCredential: boolean;
  createdAt: string | null;
}

export interface SmsSendResult {
  ok: boolean;
  status: string;
  error: string | null;
  channel: string;
  bytes: number;
}

export function getSmsStatus(): Promise<SmsStatus> {
  return request<SmsStatus>("/api/sms/status");
}

export function listSmsLogs(): Promise<MessageLogItem[]> {
  return request<MessageLogItem[]>("/api/sms/logs");
}

/**
 * 테스트 발송. 번호를 비우면 내 계정 연락처로 보낸다.
 *
 * `alimtalk: true` 면 알림톡으로 보낸다 — 본문은 카카오 심사본이 나가므로 `text` 는 무시된다.
 */
export function testSms(input: {
  to?: string;
  text?: string;
  alimtalk?: boolean;
}): Promise<SmsSendResult> {
  return request<SmsSendResult>("/api/sms/test", { method: "POST", body: input });
}

/** 본문 길이·과금 구분(SMS/LMS) 계산. 저장하지 않는다. */
export function measureSms(text: string): Promise<SmsSendResult> {
  return request<SmsSendResult>(`/api/sms/measure?text=${encodeURIComponent(text)}`);
}

/** 고객향 문자에 붙일 첨부 이미지 업로드 결과. */
export interface SmsAttachment {
  /** 리드폼 설정에 저장할 값(대행사 파일 id) */
  imageId: string;
  /** 규격(JPG·200KB)에 맞춘 뒤의 크기 */
  bytes: number;
}

/**
 * 첨부 이미지 업로드. 규격 변환(JPG·200KB 이하)은 서버가 하므로 원본을 그대로 올리면 된다.
 * 첨부가 붙은 문자는 MMS(건당 110원)로 나간다.
 */
export async function uploadSmsAttachment(file: File): Promise<SmsAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch("/api/sms/attachment", { method: "POST", body: fd });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SmsAttachment;
}

// ---------- 운영자(어드민) ----------
// ⚠️ 여기 API 는 ROLE_ADMIN 만 통과한다(서버 SecurityConfig). 화면 가드는 편의일 뿐이다.

/** 어드민 계정 목록의 한 줄. 고객 개인정보(리드 내용)는 담지 않는다 — 건수만. */
export interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  plan: "FREE" | "PRO";
  active: boolean;
  subdomain: string | null;
  createdAt: string | null;
  formCount: number;
  leadCount: number;
  smsEnabled: boolean;
  smsAllowedChannels: SmsChannel[];
  /** ⚠️ 0 = 금지, -1 = 무제한. */
  monthlyLimit: number;
  smsUsedThisMonth: number;
}

export interface AdminAuditRow {
  id: number;
  adminId: number;
  adminEmail: string | null;
  targetId: number | null;
  targetEmail: string | null;
  action: string;
  detail: string | null;
  createdAt: string | null;
}

export function listAdminUsers(q?: string): Promise<AdminUserRow[]> {
  const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<AdminUserRow[]>(`/api/admin/users${query}`);
}

/**
 * 문자 발송 권한 변경(부분 수정 — 넘기지 않은 필드는 그대로).
 * `monthlyLimit` 은 **0 이 금지**이고 무제한은 음수다.
 */
export function updateAdminUserSms(
  id: number,
  input: { enabled?: boolean; allowedChannels?: SmsChannel[]; monthlyLimit?: number },
): Promise<AdminUserRow> {
  return request<AdminUserRow>(`/api/admin/users/${id}/sms`, { method: "PATCH", body: input });
}

// ---------- 운영자 읽기 전용 열람 (2026-08-19 정책 변경) ----------
// 조회 전용 — 운영자가 남의 자산을 고치는 API 는 서버에 없다. 리드 열람은 서버가 감사 로그에 남긴다.

export function listAdminUserForms(userId: number): Promise<FormSummary[]> {
  return request<FormSummary[]>(`/api/admin/users/${userId}/forms`);
}

export function listAdminUserLandings(userId: number): Promise<LandingSummary[]> {
  return request<LandingSummary[]>(`/api/admin/users/${userId}/landings`);
}

/** 리드 열람(최신순 최대 200건). formId 를 주면 그 폼 것만. */
export function listAdminUserLeads(userId: number, formId?: number): Promise<Lead[]> {
  const query = formId ? `?formId=${formId}` : "";
  return request<Lead[]>(`/api/admin/users/${userId}/leads${query}`);
}

/** 계정 대신 로그인 — 비밀번호 없이 토큰 발급(무기록, 2026-08-20). */
export function loginAsAdminUser(userId: number): Promise<TokenResponse> {
  return request<TokenResponse>(`/api/admin/users/${userId}/login-as`, { method: "POST" });
}

export function listAdminAudit(targetId?: number): Promise<AdminAuditRow[]> {
  const query = targetId ? `?targetId=${targetId}` : "";
  return request<AdminAuditRow[]>(`/api/admin/audit${query}`);
}

export { BASE_URL };
