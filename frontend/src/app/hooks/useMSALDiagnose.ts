'use client';

import { useMSAL } from '../lib/msalProvider';
import { useEffect, useState } from 'react';

/**
 * Simplified hook for diagnosis - no auto redirects
 */
export default function useMSALDiagnose() {
  const { isAuthenticated, user: msalUser, inProgress, login, logout, getAccessToken } = useMSAL();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAPICall = async () => {
    if (!getAccessToken) {
      setError('getAccessToken not available');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('No token received from getAccessToken');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setError(null);
      } else {
        setError(`API call failed: ${response.status} - ${await response.text()}`);
      }
    } catch (err) {
      setError(`API call error: ${err}`);
    }
  };

  return {
    isAuthenticated,
    msalUser,
    user,
    inProgress,
    error,
    login,
    logout,
    getAccessToken,
    testAPICall
  };
}
