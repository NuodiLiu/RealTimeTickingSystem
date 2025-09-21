// hooks/useAutoRefreshToken.ts
"use client";

import { useEffect, useRef } from 'react';
import { refreshAppJwt } from '../lib/api';

/**
 * Hook to automatically refresh JWT tokens before they expire
 */
export function useAutoRefreshToken() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startAutoRefresh = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Refresh token every 90 minutes (token expires in 2 hours)
      const refreshInterval = 90 * 60 * 1000; // 90 minutes in milliseconds

      intervalRef.current = setInterval(async () => {
        const appJwt = localStorage.getItem('appJwt');
        if (appJwt) {
          try {
            console.log('🔄 Auto-refreshing JWT token...');
            await refreshAppJwt();
            console.log('✅ JWT token auto-refreshed successfully');
          } catch (error) {
            console.error('❌ Auto-refresh failed:', error);
            // If auto-refresh fails, user will be redirected to login on next API call
          }
        }
      }, refreshInterval);

      console.log(`🕒 Auto-refresh scheduled every ${refreshInterval / (60 * 1000)} minutes`);
    };

    // Start auto-refresh if user is logged in
    const appJwt = localStorage.getItem('appJwt');
    if (appJwt) {
      startAutoRefresh();
    }

    // Listen for storage changes (login/logout from other tabs)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'appJwt') {
        if (event.newValue) {
          // JWT was set (login)
          startAutoRefresh();
        } else {
          // JWT was removed (logout)
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            console.log('🛑 Auto-refresh stopped (user logged out)');
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
}