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

// ---------- 폼(Form) ----------
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

export { BASE_URL };
