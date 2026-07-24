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

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = await res.json();
  } catch {
    // 본문 없음(시큐리티 레벨 401 등)
  }
  return new ApiError(res.status, body, `${res.status} ${res.statusText}`);
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

// ---------- 도메인 타입 ----------
export interface HealthResponse {
  status: string;
  service: string;
  time: string;
}

export type Role = "USER" | "ADMIN";
export type Plan = "FREE" | "PRO";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  subdomain: string;
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

// ---------- 리드폼(Form) ----------
export type FormType = "BASIC" | "STEP";
export type BlockType = "FIELD" | "IMAGE" | "HTML" | "TEXT" | "DIVIDER" | "SPACER" | "CHOICE";

export interface FormBlock {
  id?: number;
  stepNo?: number | null;
  sortOrder: number;
  blockType: BlockType;
  fieldType?: string | null;
  label?: string | null;
  required?: boolean;
  uniqueCheck?: boolean;
  placeholder?: string | null;
  options?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
}

export interface FormInput {
  name: string;
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
  const tokens = getTokens();
  const res = await fetch(`${BASE_URL}/api/leads/template?formId=${formId}&format=${format}`, {
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
  });
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
  const tokens = getTokens();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE_URL}/api/leads/import?formId=${formId}`, {
    method: "POST",
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    body: fd,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ImportResult;
}

/** 대시보드 전체 리드 수. */
export function leadsCount(): Promise<{ total: number }> {
  return request<{ total: number }>("/api/leads/count");
}

export const LEAD_STATUSES = [
  { value: "NEW", label: "신규" },
  { value: "IN_PROGRESS", label: "상담중" },
  { value: "DONE", label: "완료" },
  { value: "SPAM", label: "불량" },
];

/** 리드 상태 변경. */
export function updateLeadStatus(id: number, status: string): Promise<void> {
  return request<void>(`/api/leads/${id}/status`, { method: "PATCH", body: { status } });
}

/** 리드폼의 리드를 CSV 로 내려받기(엑셀 호환). */
export async function downloadLeadsCsv(formId: number, formName: string): Promise<void> {
  const tokens = getTokens();
  const res = await fetch(`${BASE_URL}/api/leads/export?formId=${formId}`, {
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
  });
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${formName || "leads"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- 랜딩페이지 ----------
export type LandingBlockType = "IMAGE" | "TEXT" | "HTML" | "FORM";
export interface LandingBlock {
  type: LandingBlockType;
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
  byReferer: StatCount[];
  byStatus: StatCount[];
  byLanding: StatEntityCount[];
  byForm: StatEntityCount[];
}
export interface StatsFilter {
  from?: string;
  to?: string;
  landingId?: number | null;
  formId?: number | null;
}
export function getStats(filter: StatsFilter = {}): Promise<StatsOverview> {
  const p = new URLSearchParams();
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.landingId != null) p.set("landingId", String(filter.landingId));
  if (filter.formId != null) p.set("formId", String(filter.formId));
  const qs = p.toString();
  return request<StatsOverview>(`/api/stats/overview${qs ? `?${qs}` : ""}`);
}

/** 공개 방문 기록(비로그인, best-effort). 공개 랜딩/리드폼 진입 시 1회 호출. */
export function recordVisit(input: { landingPageId?: number | null; formId?: number | null; utm?: Record<string, string> }): void {
  request<void>("/api/public/visits", { method: "POST", body: input, auth: false }).catch(() => {
    /* 방문 기록 실패는 무시 */
  });
}

// ---------- 이미지 업로드 ----------
/** 이미지 파일 업로드(로그인 필요) → 절대 URL 반환. */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const tokens = getTokens();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: "POST",
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    body: fd,
  });
  if (!res.ok) throw await parseError(res);
  // 백엔드가 절대 URL(로컬=서버주소 / R2=공개베이스URL)을 반환
  return (await res.json()) as { url: string };
}

export { BASE_URL };
