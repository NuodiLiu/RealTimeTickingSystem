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
  username: string;
  role: 'ADMIN' | 'STAFF'; // Ensure role is part of the user object
  token?: string;
}
export type CaseStatus = "queued" | "in_progress" | "resolved_pending_feedback" | "resolved";
export interface CaseItem { 
  id: string; 
  zID: string;
  studentName: string;
  category: string;
  status: CaseStatus; 
  createdAt: string; 
  updatedAt: string;
  startedAt?: string; 
  resolvedAt?: string;
  escalatedTo?: string;
  deviceId?: string; 
  staffId?: string; 
  payload?: any }
export interface CasesListRes { items: CaseItem[] }

export interface TakeCaseRes { case: CaseItem }
export interface ResolveCaseRes { case: CaseItem }

export interface DevicesListItem { 
  deviceId: string; 
  name: string;
  mode: "REGISTRATION" | "FEEDBACK"; 
  status: "OFFLINE" | "IDLE" | "BUSY";
  isOnline: boolean; 
  lastSeenAt: string;
  currentLock?: {
    id: string;
    status: string;
    version: number;
    case: {
      id: string;
      zID: string;
      studentName: string;
      category: string;
      status: string;
    };
    staffName: string;
    leaseExpireAt: string;
  };
}
export interface DevicesListRes { items: DevicesListItem[] }

export interface FeedbackSendReq { caseId: string; deviceId: string; }
export interface FeedbackOverrideReq { caseId: string; deviceId: string; expectedLockId: string; expectedVersion: number; }
export interface FeedbackSubmitReq { sessionId: string; rating: number; comment?: string }

// export interface PairCompleteReq { deviceId: string; secret: string }
export interface PairCompleteReq {
  pairingToken: string;
  deviceName: string;
  mode?: "REGISTRATION" | "FEEDBACK";
}

export interface PairCompleteRes {
  deviceId: string;
  deviceSecret: string;
  deviceName: string;
  mode: "REGISTRATION" | "FEEDBACK";
  wsEndpoint: string;
}
export interface PairGenerateQrReq { mode: string; deviceLabel?: string }
export interface PairGenerateQrRes {
  qrUrl: string;
  pairingToken: string;
  sessionId: string;
  expiresAt: string;
}

export interface UnpairDeviceReq { deviceId: string; }
export interface UnpairDeviceRes { ok: boolean; message: string; }

export interface UpdateDeviceNameReq { name: string; }
export interface UpdateDeviceNameRes { 
  success: boolean; 
  device: {
    id: string;
    name: string;
    mode: "REGISTRATION" | "FEEDBACK";
    lastSeenAt: string;
  };
}

export interface HealthPing {
  status: 'ok' | 'error';
  version?: string;
  uptime?: number; // seconds
}

export interface HealthRes {
  status: string;
  timestamp: string;
  connectedDevices: number;
  onlineDeviceIds: string[];
}

// Excel Export Types
export interface ExcelFilterParams {
  startDate?: string;
  endDate?: string;
  hasFeedback?: 'yes' | 'no' | 'both'; // New filter for feedback presence
  resolvedOnly?: boolean; // Filter for resolved cases only
}

export interface ExcelPreviewResponse {
  totalCases: number;
  dateRange: {
    earliest: number | null;
    latest: number | null;
  };
  statusBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  staffBreakdown: Record<string, number>;
  filters: ExcelFilterParams;
  estimatedFileSize: string;
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
  // POST /cases/:id/escalate
  escalate: (id: string, department: string) => post<ResolveCaseRes>(`/cases/${encodeURIComponent(id)}/escalate`, { department }),
  // Device-only (usually kiosk) POST /cases 
  createFromDevice: (payload: any) => post<{ case: CaseItem }>("/cases", payload),
  // export to excel
  exportCases: () => get<any[]>('/cases/export-cases'),
};

// Excel Export API
export const ExcelAPI = {
  // GET /excel/preview - Get export preview and statistics
  getPreview: (filters?: ExcelFilterParams) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.hasFeedback && filters.hasFeedback !== 'both') {
      params.append('hasFeedback', filters.hasFeedback);
    }
    if (filters?.resolvedOnly) {
      params.append('status', 'RESOLVED');
    }
    
    const queryString = params.toString();
    return get<ExcelPreviewResponse>(`/excel/preview${queryString ? `?${queryString}` : ''}`);
  },
  
  // GET /excel/cases/json - Export as JSON (compatibility)
  exportAsJson: (filters?: ExcelFilterParams) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.hasFeedback && filters.hasFeedback !== 'both') {
      params.append('hasFeedback', filters.hasFeedback);
    }
    if (filters?.resolvedOnly) {
      params.append('status', 'RESOLVED');
    }
    
    const queryString = params.toString();
    return get<any[]>(`/excel/cases/json${queryString ? `?${queryString}` : ''}`);
  },
  
  // GET /excel/cases/xlsx - Export as Excel file
  exportAsExcel: async (filters?: ExcelFilterParams): Promise<Blob> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.hasFeedback && filters.hasFeedback !== 'both') {
      params.append('hasFeedback', filters.hasFeedback);
    }
    if (filters?.resolvedOnly) {
      params.append('status', 'RESOLVED');
    }
    
    const queryString = params.toString();
    const url = join(API_BASE, `/excel/cases/xlsx${queryString ? `?${queryString}` : ''}`);
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Export failed: ${response.status} ${errorText}`);
    }
    
    return response.blob();
  }
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
  // PATCH /device/:id/mode (change device mode)
  changeMode: (deviceId: string, mode: "REGISTRATION" | "FEEDBACK") => 
    patch<{ id: string; name: string; mode: string; lastSeenAt: string }>(`/device/${encodeURIComponent(deviceId)}/mode`, { mode }),
  // PATCH /device/:id/name (update device name)
  updateName: (deviceId: string, name: string) => 
    patch<UpdateDeviceNameRes>(`/device/${encodeURIComponent(deviceId)}/name`, { name }),
  // DELETE /device/:id (unpair device)
  unpair: (deviceId: string) => del<undefined>(`/device/${encodeURIComponent(deviceId)}`),
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

export const HealthAPI = {
  ping: () => get<HealthRes>("/health"),
  check: async (): Promise<boolean> => {
    try {
      const res = await get<HealthRes>("/health");
      return res?.status === "ok";
    } catch {
      return false;
    }
  },
};

// src/lib/api.ts