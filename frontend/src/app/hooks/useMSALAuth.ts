"use client";

import { useMSAL } from '../lib/msalProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthAPI } from '../lib/api';

/**
 * Hook that provides MSAL-based authentication with automatic login redirect
 */
export default function useMSALAuth(redirectToLogin = true) {
  const { isAuthenticated, user: msalUser, inProgress, login, logout } = useMSAL();
  const [user, setUser] = useState<{
    id: string;
    email: string;
    username: string;
    role: 'ADMIN' | 'STAFF';
  } | null>(null);
  const [booting, setBooting] = useState(true);
  const [userFetched, setUserFetched] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only redirect if definitely not authenticated and not loading
    if (redirectToLogin && !isAuthenticated && !inProgress && !booting) {
      router.push('/login');
      return;
    }

    // If authenticated but haven't fetched user data yet
    if (isAuthenticated && msalUser && !userFetched) {
      fetchUserDetails();
    } else if (!isAuthenticated && !inProgress) {
      setUser(null);
      setUserFetched(false);
      setBooting(false);
    }
  }, [isAuthenticated, inProgress, msalUser, userFetched, booting, redirectToLogin, router]);

  const fetchUserDetails = async () => {
    setUserFetched(true);
    try {
      const response = await AuthAPI.me();
      if (response.user) {
        setUser({
          id: response.user.id,
          email: response.user.email,
          username: response.user.name,
          role: response.user.role as 'ADMIN' | 'STAFF',
        });
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      // Fallback to MSAL user info with default role
      if (msalUser) {
        setUser({
          id: msalUser.localAccountId || msalUser.homeAccountId,
          email: msalUser.username,
          username: msalUser.name || msalUser.username,
          role: 'STAFF' as const,
        });
      }
    } finally {
      setBooting(false);
    }
  };

  return {
    user,
    isAuthenticated,
    booting: booting || (isAuthenticated && !userFetched),
    login,
    logout
  };
}
