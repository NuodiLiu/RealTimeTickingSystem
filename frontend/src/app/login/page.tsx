"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../components/AuthGuard';
import { useAuthStore } from '../stores/authStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.localhost";

function LoginPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuthStore();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, []);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      window.location.href = `${API_BASE}/auth/login`;
    } catch (e) {
      setError('Failed to initiate login. Please try again.');
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'oauth_error':
        return 'Microsoft authentication failed. Please try again.';
      case 'missing_code':
        return 'Authorization failed. Please try again.';
      case 'auth_failed':
        return 'Authentication process failed. Please try again.';
      case 'token_expired':
        return 'Your session has expired. Please log in again.';
      case 'session_expired':
        return 'Your session has expired. Please log in again.';
      case 'auth_required':
        return 'Authentication is required to continue.';
      case 'refresh_failed':
        return 'Session refresh failed. Please log in again.';
      default:
        return 'An authentication error occurred. Please try again.';
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/img/unswcollege.png"
            alt="UNSW College Logo"
            width={128}
            height={128}
            className="rounded-lg object-cover"
          />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Sign In
            </h2>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-8">
            <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
              Real-Time Ticketing System
            </h1>
            <p className="text-sm text-zinc-600 mb-6">
              Sign in with your Microsoft account to continue.
            </p>

            {error && (
              <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-[#ffd600] text-black hover:bg-[#003366] hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  <span>Redirecting to Microsoft...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden="true">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                  </svg>
                  <span>Continue with Microsoft</span>
                </>
              )}
            </button>

            <p className="mt-4 text-xs text-zinc-500 text-center">
              Secure authentication powered by Microsoft Azure AD
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthGuard requireAuth={false} redirectTo="/login">
      <LoginPageContent />
    </AuthGuard>
  );
}
