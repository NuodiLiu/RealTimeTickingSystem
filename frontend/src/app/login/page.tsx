"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.localhost";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user already has valid App JWT
    const appJwt = localStorage.getItem('appJwt');
    if (appJwt) {
      // Verify the token is still valid by checking /auth/me
      fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${appJwt}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (response.ok) {
          // Token is valid, redirect to dashboard
          router.push('/dashboard');
        } else {
          // Token is invalid, remove it
          localStorage.removeItem('appJwt');
        }
      })
      .catch(error => {
        console.error('Token validation error:', error);
        localStorage.removeItem('appJwt');
      });
    }

    // Check for error from callback
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, [router]);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Redirect to backend Azure AD login endpoint
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow rounded p-8 text-center">
        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-semibold mb-2">Real-Time Ticketing System</h1>
        <p className="text-gray-600 mb-6">Sign in with your Microsoft account</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleMicrosoftLogin}
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Redirecting to Microsoft...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.04 12c0-.62-.05-1.21-.16-1.78H12v3.36h6.19c-.27 1.45-1.08 2.68-2.3 3.5v2.92h3.72C21.26 17.94 23.04 15.2 23.04 12z"/>
                <path d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 24 12 24z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Microsoft
            </>
          )}
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Secure authentication powered by Microsoft Azure AD
        </p>
      </div>
    </div>
  );
}
