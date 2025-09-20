// src/lib/api.ts
import { getApiBaseUrl } from './env-utils';

// Config - Dynamic API base URL based on environment
const API_BASE = getApiBaseUrl();

// Helper to join URL segments safely
const join = (base: string, path: string) => `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

// Function to get App JWT from localStorage
function getAppJwt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('appJwt');
}

// Function to clear App JWT from localStorage
function clearAppJwt(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('appJwt');
} 
export type InviteRole = "staff" | "admin";

export interface CreateInviteReq { email: string; role?: InviteRole }
export interface CreateInviteRes { inviteId: string; email: string; code: string; role: InviteRole; expiresAt?: string }

export interface RegisterReq { email: string; password: string; username?: string; inviteCode?: string }
export interface LoginReq { email: string; password: string }
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

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'STAFF'; 
  token?: string;
}
export type CaseStatus = "QUEUED" | "IN_PROGRESS" | "RESOLVED_PENDING_FEEDBACK" | "RESOLVED";
export interface CaseItem { 
  id: string; 
  zID: string | null;
  studentName: string;
  category: string;
  status: CaseStatus; 
  createdAt: string; 
  updatedAt: string;
  startedAt?: string; 
  resolvedAt?: string;
  escalatedTo?: string;
  resolvedOnSite?: boolean | null;
  deviceId?: string; 
  staffId?: string; 
  payload?: any }
export interface CasesListRes extends Array<CaseItem> {}

export interface PublicQueueItem {
  id: string;
  studentName: string;
  position: number;
  createdAt: string;
  status: CaseStatus;
}

export interface TakeCaseRes { 
  case: CaseItem | null; 
  message: string;
}
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
      zID: string | null;
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
  uptime?: number; 
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
  hasFeedback?: 'yes' | 'no' | 'both';
  resolvedOnly?: boolean; 
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

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// request with 401 auto-refresh once
let isRefreshing = false;
let pending401Queue: Array<() => void> = [];

// Timeout wrapper for fetch requests with retry logic for Azure Functions cold start
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, retryCount = 0): Promise<Response> {
  const timeoutMs = 15000; // 15 seconds for Azure Functions cold start
  const maxRetries = 2;
  
  return new Promise<Response>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(input, init)
      .then(response => {
        clearTimeout(timeoutId);
        
        // Retry on 503 (service unavailable) or 502 (bad gateway) for cold start issues
        if ((response.status === 503 || response.status === 502) && retryCount < maxRetries) {
          console.warn(`Azure Functions cold start detected (${response.status}), retrying... (${retryCount + 1}/${maxRetries})`);
          // Wait before retrying (exponential backoff)
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          setTimeout(() => {
            fetchWithTimeout(input, init, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, retryDelay);
          return;
        }
        
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        
        // Retry on network errors that might be cold start related
        if (retryCount < maxRetries && (
          error.message?.includes('fetch') || 
          error.message?.includes('Network request failed')
        )) {
          console.warn(`Network error detected, retrying... (${retryCount + 1}/${maxRetries})`, error.message);
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          setTimeout(() => {
            fetchWithTimeout(input, init, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, retryDelay);
          return;
        }
        
        reject(error);
      });
  });
}

async function baseFetch<T>(path: string, init?: RequestInit & { skipRefreshRetry?: boolean }): Promise<T> {
  const url = join(API_BASE, path);
  
  try {
    // Get App JWT from localStorage
    const appJwt = getAppJwt();
    
    console.log('API Request Debug:', {
      url,
      hasAppJwt: !!appJwt,
      appJwtLength: appJwt?.length
    });
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> || {}),
    };

    // Add Authorization header if we have an App JWT
    if (appJwt) {
      headers.Authorization = `Bearer ${appJwt}`;
      console.log('Authorization header set with App JWT');
    } else {
      console.warn('No App JWT available for API request');
    }

    const res = await fetchWithTimeout(url, {
      ...init,
      headers,
    });

    console.log('[API] Response received:', {
      url,
      status: res.status,
      ok: res.ok,
      statusText: res.statusText
    });

    if (res.status === 204) return undefined as unknown as T;

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json().catch(() => ({})) : undefined;

    console.log('[API] Response data:', { url, data });

    if (!res.ok) {
      console.error('[API] Request failed:', { url, status: res.status, data });
      // Try refresh on 401 once
      if (res.status === 401 && !init?.skipRefreshRetry) {
        await handle401Refresh();
        return baseFetch<T>(path, { ...init, skipRefreshRetry: true });
      }
      const message = (data && (data.error || data.message)) ?? res.statusText;
      throw new ApiError(res.status, message, data);
    }

    return (data as T);
  } catch (error) {
    if (error instanceof TypeError && (
      (error as any).message?.includes('fetch') || 
      (error as any).message?.includes('timed out') ||
      (error as any).message?.includes('Network request failed')
    )) {
      throw new ApiError(0, 'Unable to connect to server. Please check your internet connection and try again.', null);
    }
    throw error;
  }
}

async function handle401Refresh() {
  if (isRefreshing) {
    await new Promise<void>((resolve) => pending401Queue.push(resolve));
    return;
  }

  isRefreshing = true;
  try {
    // Use the refresh endpoint with HttpOnly cookie
    const response = await fetch(join(API_BASE, '/auth/refresh'), {
      method: 'POST',
      credentials: 'include', // Include HttpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const newAppJwt = data.accessToken;
      
      if (newAppJwt) {
        // Store new App JWT
        localStorage.setItem('appJwt', newAppJwt);
        console.log('App JWT refreshed successfully');
      } else {
        throw new Error('No access token in refresh response');
      }
    } else {
      // Refresh failed - clear tokens and redirect to login
      console.warn('Token refresh failed:', response.status);
      clearAppJwt();
      
      // Only redirect if we're not already on the login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?error=session_expired';
      }
      throw new Error('Token refresh failed');
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    clearAppJwt();
    
    // Only redirect if we're not already on the login page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login?error=session_expired';
    }
    throw error;
  } finally {
    isRefreshing = false;
    pending401Queue.forEach((fn) => fn());
    pending401Queue = [];
  }
}

// helpers for HTTP verbs
const get = <T>(path: string) => baseFetch<T>(path, { method: "GET" });
const del = <T>(path: string) => baseFetch<T>(path, { method: "DELETE" });
const post = <T>(path: string, body?: unknown) => baseFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) => baseFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

export const AuthAPI = {
  // GET /auth/me (authenticated)
  me: () => get<{ ok: boolean; user: { id: string; name: string; email: string; role: string; employeeNo: string; identityKey: string } }>("/auth/me"),
  // POST /auth/invites (staff only)
  createInvite: (body: CreateInviteReq) => post<CreateInviteRes>("/auth/invites", body),
  // POST /auth/register
  register: (body: RegisterReq) => post<AuthRes>("/auth/register", body),
  // POST /auth/login
  // login: (body: LoginReq) => post<AuthRes>("/auth/login", body),
  login: (body: { employeeNo: string }) => post<AuthRes>("/auth/login", body),
  // POST /auth/logout
  logout: () => baseFetch<undefined>("/auth/logout", { method: "POST", skipRefreshRetry: true }),
};

export const CasesAPI = {
  // GET /cases?status=queued|in_progress|resolved (authenticated)
  list: (status?: CaseStatus) => {
    const apiStatus = status?.toLowerCase();
    return get<CasesListRes>(`/cases${apiStatus ? `?status=${encodeURIComponent(apiStatus)}` : ""}`);
  },
  // GET /cases/public-queue (no authentication required)
  getPublicQueue: () => get<PublicQueueItem[]>("/cases/public-queue"),
  // POST /cases/:id/take 
  take: (id: string) => post<TakeCaseRes>(`/cases/${encodeURIComponent(id)}/take`),
  // POST /cases/take-next 
  takeNext: () => post<TakeCaseRes>("/cases/take-next"),
  // POST /cases/:id/resolve 
  resolve: (id: string) => post<ResolveCaseRes>(`/cases/${encodeURIComponent(id)}/resolve`),
  // POST /cases/:id/escalate
  escalate: (id: string, department: string | null, resolvedOnSite: boolean | null = null) => post<ResolveCaseRes>(`/cases/${encodeURIComponent(id)}/escalate`, { department, resolvedOnSite }),
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
  
  // GET /excel/cases/json - Export as JSON 
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

export const SignalRAPI = {
  // GET /signalr/dashboard/connect (get dashboard SignalR connection info)
  getDashboardConnection: () => get<{ url: string; token: string }>("/signalr/dashboard/connect"),
  // GET /signalr/device/connect (get device SignalR connection info)
  getDeviceConnection: () => get<{ url: string; token: string }>("/signalr/device/connect"),
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
    post<PairCompleteRes>("/pair/complete", body), 
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

// Export token refresh function for use in SignalR
export { handle401Refresh as refreshAppJwt };

