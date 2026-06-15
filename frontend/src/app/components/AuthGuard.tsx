"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  requiredRole?: 'ADMIN' | 'STAFF';
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login',
  requiredRole
}: AuthGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isInitialized, initialize } = useAuthStore();

  React.useEffect(() => {
    // 只在未初始化时调用 initialize
    if (!isInitialized) {
      console.log('[AuthGuard] Triggering authentication initialization...');
      initialize();
    }
  }, [isInitialized, initialize]);

  React.useEffect(() => {
    // 只有在初始化完成后才进行路由决策
    if (!isInitialized) {
      console.log('[AuthGuard] Still initializing, waiting...');
      return;
    }
    
    console.log('[AuthGuard] Route guard decision:', {
      requireAuth,
      isAuthenticated,
      isInitialized,
      isLoading,
      redirectTo,
      currentPath: window.location.pathname
    });

    if (requireAuth && !isAuthenticated) {
      console.log('[AuthGuard] Auth required but user not authenticated, redirecting to:', redirectTo);
      router.push(redirectTo);
    } else if (!requireAuth && isAuthenticated && redirectTo === '/login') {
      console.log('[AuthGuard] Already authenticated, redirecting to dashboard');
      router.push('/app/dashboard');
    }
  }, [isAuthenticated, isInitialized, requireAuth, redirectTo, router]);

  // 显示加载状态
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // 如果需要认证但用户未登录，显示空内容（因为会被重定向）
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">正在跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  // 检查角色权限
  if (requireAuth && isAuthenticated && requiredRole && user?.role !== requiredRole) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
