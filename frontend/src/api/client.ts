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
  createdAt: string;
}

export interface LeadNote {
  id: number;
  kind: "MEMO" | "SYSTEM";
  body: string;
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

/** 사용자 메모 추가. */
export function addLeadNote(id: number, body: string): Promise<LeadNote> {
  return request<LeadNote>(`/api/leads/${id}/notes`, { method: "POST", body: { body } });
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
  const tokens = getTokens();
  const res = await fetch(`${BASE_URL}/api/leads/export?formId=${formId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
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
  byReferer: StatCount[];
  byStatus: StatCount[];
  byLanding: StatEntityCount[];
  byForm: StatEntityCount[];
  funnel: StatFunnel;
  byEvent: StatCount[];
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

/** 공개 이벤트 기록(비로그인, best-effort). 주요 클릭(폼 열기 등) 시 호출 — 전환 퍼널·요소 클릭 통계(I4/I5). */
export function recordEvent(input: { landingPageId?: number | null; formId?: number | null; eventType: string; target?: string }): void {
  request<void>("/api/public/events", { method: "POST", body: input, auth: false }).catch(() => {
    /* 이벤트 기록 실패는 무시 */
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

/** 권한 부여 화면 데이터(내 리드폼 전체 + 부여 상태 + 선점 여부). */
export function listGrants(advertiserId: number): Promise<GrantView[]> {
  return request<GrantView[]>(`/api/advertisers/${advertiserId}/grants`);
}
/** 권한 일괄 교체 — 목록에 없는 리드폼은 회수된다. */
export function replaceGrants(advertiserId: number, grants: GrantInput[]): Promise<GrantView[]> {
  return request<GrantView[]>(`/api/advertisers/${advertiserId}/grants`, { method: "PUT", body: { grants } });
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

export { BASE_URL };
