/**
 * Centralised API client for your Express backend
 * - Works in Next.js App Router (client or server)
 * - Uses fetch with credentials for httpOnly cookie JWT flows
 * - Auto-refreshes access token on 401 via /auth/refresh then retries once
 * - Base URL from NEXT_PUBLIC_API_BASE_URL (fallback http://localhost:3000)
 */

// -----------------------------
// Config
// -----------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Helper to join URL segments safely
const join = (base: string, path: string) => `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

// -----------------------------
// Types (adjust to match your backend DTOs as needed)
// -----------------------------
export type InviteRole = "staff" | "admin";

export interface CreateInviteReq { email: string; role?: InviteRole }
export interface CreateInviteRes { inviteId: string; email: string; code: string; role: InviteRole; expiresAt?: string }

export interface RegisterReq { email: string; password: string; username?: string; inviteCode?: string }
export interface LoginReq { email: string; password: string }
// export interface AuthRes { user: { id: string; email: string; username?: string; role?: InviteRole }; }
// Update this interface to match your backend response
export interface AuthRes { 
  staff: { 
    id: string; 
    employeeNo: string;
    name: string; 
    email: string; 
    role?: string;
  };
  session: {
    accessToken: string;
    sessionId: string;
    expiresAt: string;
  };
}

// Keep a separate User type for your frontend state
export interface User {
  id: string;
  email: string;
  username?: string;
}
export type CaseStatus = "queued" | "in_progress" | "resolved";
export interface CaseItem { 
  id: string; 
  status: CaseStatus; 
  createdAt: string; 
  updatedAt: string;
  startedAt?: string; 
  resolvedAt?: string;
  deviceId?: string; 
  staffId?: string; 
  payload?: any }
export interface CasesListRes { items: CaseItem[] }

export interface TakeCaseRes { case: CaseItem }
export interface ResolveCaseRes { case: CaseItem }

export interface DevicesListItem { id: string; mode: string; online: boolean; updatedAt: string }
export interface DevicesListRes { items: DevicesListItem[] }

export interface FeedbackSendReq { caseId: string; deviceId: string; }
export interface FeedbackOverrideReq { caseId: string; deviceId: string; expectedLockId: string; expectedVersion: number; }
export interface FeedbackSubmitReq { sessionId: string; rating: number; comment?: string }

// export interface PairCompleteReq { deviceId: string; secret: string }
export interface PairCompleteReq {
  pairingToken: string;
  deviceName: string;
  deviceMode?: "REGISTRATION" | "FEEDBACK" | "DUAL";
}

export interface PairCompleteRes {
  deviceId: string;
  deviceSecret: string;
  deviceName: string;
  deviceMode: "REGISTRATION" | "FEEDBACK" | "DUAL";
  wsEndpoint: string;
}
export interface PairGenerateQrReq { mode: string; deviceLabel?: string }
export interface PairGenerateQrRes {
  qrUrl: string;
  pairingToken: string;
  sessionId: string;
  expiresAt: string;
}
// Generic API Error shape your backend sends like { error: string }
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// -----------------------------
// Core request with 401 auto-refresh once
// -----------------------------
let isRefreshing = false;
let pending401Queue: Array<() => void> = [];

async function baseFetch<T>(path: string, init?: RequestInit & { skipRefreshRetry?: boolean }): Promise<T> {
  const url = join(API_BASE, path);
  const res = await fetch(url, {
    ...init,
    credentials: "include", // send cookies
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as unknown as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : undefined;

  if (!res.ok) {
    // Try refresh on 401 once
    if (res.status === 401 && !init?.skipRefreshRetry) {
      await handle401Refresh();
      // Retry original once, but mark to skip loop
      return baseFetch<T>(path, { ...init, skipRefreshRetry: true });
    }
    const message = (data && (data.error || data.message)) ?? res.statusText;
    throw new ApiError(res.status, message, data);
  }

  return (data as T);
}

async function handle401Refresh() {
  // If a refresh is ongoing, await its completion via a promise
  if (isRefreshing) {
    await new Promise<void>((resolve) => pending401Queue.push(resolve));
    return;
  }

  isRefreshing = true;
  try {
    await fetch(join(API_BASE, "/auth/refresh"), {
      method: "POST",
      credentials: "include",
    });
  } finally {
    isRefreshing = false;
    // release queued requests regardless of success; next call may still fail and bubble
    pending401Queue.forEach((fn) => fn());
    pending401Queue = [];
  }
}

// Convenience helpers for HTTP verbs
const get = <T>(path: string) => baseFetch<T>(path, { method: "GET" });
const del = <T>(path: string) => baseFetch<T>(path, { method: "DELETE" });
const post = <T>(path: string, body?: unknown) => baseFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) => baseFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

// -----------------------------
// API groups mapped to your Express routers
// -----------------------------
export const AuthAPI = {
  // POST /auth/invites (staff only)
  createInvite: (body: CreateInviteReq) => post<CreateInviteRes>("/auth/invites", body),
  // POST /auth/register
  register: (body: RegisterReq) => post<AuthRes>("/auth/register", body),
  // POST /auth/login
  // login: (body: LoginReq) => post<AuthRes>("/auth/login", body),
  login: (body: { employeeNo: string }) => post<AuthRes>("/auth/login", body),
  // POST /auth/refresh
  refresh: () => post<undefined>("/auth/refresh"),
  // POST /auth/logout
  logout: () => post<undefined>("/auth/logout"),
};

export const CasesAPI = {
  // GET /cases?status=queued|in_progress|resolved 
  list: (status?: CaseStatus) => get<CasesListRes>(`/cases${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  // POST /cases/:id/take 
  take: (id: string) => post<TakeCaseRes>(`/cases/${encodeURIComponent(id)}/take`),
  // POST /cases/take-next 
  takeNext: () => post<TakeCaseRes>("/cases/take-next"),
  // POST /cases/:id/resolve 
  resolve: (id: string) => post<ResolveCaseRes>(`/cases/${encodeURIComponent(id)}/resolve`),
  // Device-only (usually kiosk) POST /cases 
  createFromDevice: (payload: any) => post<{ case: CaseItem }>("/cases", payload),
};

export const DeviceAPI = {
  // GET /device 
  list: () => get<DevicesListRes>("/device"),
  // list: async () => {
  //   const response = await fetch(`${API_BASE}/device`);
  //   if (!response.ok) {
  //     throw new Error("Failed to fetch devices");
  //   }
  //   return await response.json();
  // },
  // GET /device/by-mode/:mode 
  getByMode: (mode: string) => get<DevicesListRes>(`/device/by-mode/${encodeURIComponent(mode)}`),
  // GET /device/online/:mode 
  getOnlineByMode: (mode: string) => get<DevicesListRes>(`/device/online/${encodeURIComponent(mode)}`),
  // POST /device/ws-token (device-auth only) 
  issueWsToken: () => post<{ deviceToken: string; expiresIn: number }>("/device/ws-token"),
  // POST /device/heartbeat (device-auth only) 
  heartbeat: (body: { deviceId?: string }) => post<undefined>("/device/heartbeat", body),
  // GET /device/status (device-auth only) 
  status: () => get<{ ok: boolean; deviceId: string; mode: string; online: boolean }>("/device/status"),
};

export const FeedbackAPI = {
  // POST /feedback/send (staff) 
  send: (body: FeedbackSendReq) => post<{ ok: true; caseId: string }>("/feedback/send", body),
  // POST /feedback/override (staff) 
  override: (body: FeedbackOverrideReq) => post<{ ok: true; caseId: string }>("/feedback/override", body),
  // POST /feedback/submit (device) 
  submit: (body: FeedbackSubmitReq) => post<{ ok: true }>("/feedback/submit", body),
};

export const PairAPI = {
  generateQR: (body: { mode?: string } = {}) =>
    post<PairGenerateQrRes>("/pair/generate-qr", body),
  
  complete: (body: PairCompleteReq) =>
    post<PairCompleteRes>("/pair/complete", body), // Correct response
};

// src/lib/api.ts


