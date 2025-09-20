import { create } from 'zustand';
import { AuthAPI } from '../lib/api';

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'STAFF';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (employeeNo: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// Single-flight 保护
let initializePromise: Promise<void> | null = null;
let abortController: AbortController | null = null;

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  error: null,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialState,

  initialize: async () => {
    // Single-flight 保护：如果已经在初始化，返回现有的 Promise
    if (initializePromise) {
      console.log('[AuthStore] Initialize already in progress, waiting...');
      return initializePromise;
    }

    // 如果已经初始化完成，直接返回
    if (get().isInitialized) {
      console.log('[AuthStore] Already initialized, skipping...');
      return;
    }

    console.log('[AuthStore] Starting initialization...');
    
    // 创建新的 AbortController
    abortController = new AbortController();
    
    initializePromise = (async () => {
      try {
        set({ isLoading: true, error: null });

        // 检查是否有 App JWT
        const appJwt = localStorage.getItem('appJwt');
        console.log('[AuthStore] App JWT check:', {
          hasJwt: !!appJwt,
          jwtLength: appJwt?.length,
          jwtPreview: appJwt?.substring(0, 50) + '...'
        });

        if (appJwt && !abortController?.signal.aborted) {
          try {
            console.log('[AuthStore] Validating App JWT with /auth/me...');
            
            // 验证 JWT
            const response = await AuthAPI.me();
            console.log('[AuthStore] /auth/me response:', response);

            // 检查是否被取消
            if (abortController?.signal.aborted) {
              console.log('[AuthStore] Request was aborted');
              return;
            }

            if (response.user) {
              const userData: User = {
                id: response.user.id,
                email: response.user.email,
                username: response.user.name,
                role: response.user.role as 'ADMIN' | 'STAFF',
              };

              console.log('[AuthStore] Setting authenticated user:', userData);
              
              // 无论组件是否 mounted，都更新全局状态
              set({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
                isInitialized: true,
                error: null,
              });
              return;
            } else {
              console.warn('[AuthStore] No user in response');
            }
          } catch (error: any) {
            console.warn('[AuthStore] App JWT validation failed:', error);
            
            // 清除无效的 JWT
            localStorage.removeItem('appJwt');
            
            // 不抛出错误，继续设置为未认证状态
          }
        } else if (!appJwt) {
          console.log('[AuthStore] No App JWT found');
        }

        // 清理旧的令牌存储模式
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user');
        console.log('[AuthStore] Cleaned up old token storage patterns');

        // 检查是否被取消
        if (abortController?.signal.aborted) {
          console.log('[AuthStore] Request was aborted');
          return;
        }

        // 设置为未认证状态
        console.log('[AuthStore] No valid auth found, setting unauthenticated state');
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      } catch (error: any) {
        console.error('[AuthStore] Error during initialization:', error);
        
        // 检查是否被取消
        if (abortController?.signal.aborted) {
          console.log('[AuthStore] Request was aborted');
          return;
        }

        // 设置错误状态
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          error: error.message || 'Authentication initialization failed',
        });
      }
    })();

    try {
      await initializePromise;
    } finally {
      // 清理
      initializePromise = null;
      abortController = null;
    }
  },

  login: async (employeeNo: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const res = await AuthAPI.login({ employeeNo });
      if (res.staff.role !== "STAFF" && res.staff.role !== "ADMIN") {
        throw new Error("Must be admin or staff");
      }
      
      const userData: User = {
        id: res.staff.id,
        email: res.staff.email,
        username: res.staff.name,
        role: res.staff.role,
      };

      set({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Login failed',
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      // 取消正在进行的初始化
      if (abortController) {
        abortController.abort();
      }
      
      await AuthAPI.logout();
    } catch (e) {
      console.error('Logout API error:', e);
    } finally {
      // 清理本地存储
      localStorage.removeItem('appJwt');
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      
      // 重置状态
      set({
        ...initialState,
        isLoading: false,
        isInitialized: false,
      });
      
      // 重置 single-flight 保护
      initializePromise = null;
      abortController = null;
      
      // 重定向到登录页面
      window.location.href = '/login';
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    // 取消正在进行的请求
    if (abortController) {
      abortController.abort();
    }
    
    // 重置状态
    set(initialState);
    
    // 重置 single-flight 保护
    initializePromise = null;
    abortController = null;
  },
}));
