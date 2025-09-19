"use client";

import React, { useEffect } from 'react';
import { useMSAL } from '../lib/msalProvider';

export default function LoginPage() {
  const { isAuthenticated, login, inProgress } = useMSAL();

  useEffect(() => {
    // Add a small delay to ensure MSAL state is stable
    if (isAuthenticated && !inProgress) {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, inProgress]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow rounded p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-gray-600 mb-6">Use your Microsoft account to continue</p>

        <button
          onClick={login}
          disabled={inProgress}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
        >
          {inProgress ? 'Redirecting to Microsoft...' : 'Continue with Microsoft'}
        </button>

        <p className="mt-4 text-xs text-gray-500">This app uses Azure AD (Entra ID) with PKCE</p>
      </div>
    </div>
  );
}
