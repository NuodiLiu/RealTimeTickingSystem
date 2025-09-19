"use client";

import { useEffect } from 'react';
import { useMSAL } from '../../lib/msalProvider';

export default function AuthCallback() {
  const { instance, isAuthenticated } = useMSAL();

  useEffect(() => {
    // Handle the authentication result
    instance.handleRedirectPromise().then((response) => {
      if (response) {
        console.log('Authentication successful:', response);
        // Redirect to dashboard after successful login
        window.location.href = '/dashboard';
      } else if (isAuthenticated) {
        // Already authenticated, redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        // Authentication failed or was cancelled
        console.log('Authentication failed or cancelled');
        window.location.href = '/login';
      }
    }).catch((error) => {
      console.error('Authentication error:', error);
      window.location.href = '/login?error=auth_failed';
    });
  }, [instance, isAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}
