'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Shield, ArrowRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            // User is already logged in, redirect to dashboard
            window.location.href = '/dashboard';
            return;
          }
        }
      } catch (e) {
        // Not authenticated, stay on login page
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleAzureLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Redirect to Azure login endpoint
      window.location.href = `${API_BASE}/auth/login`;
    } catch (e) {
      setError('Failed to initiate login. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle development/test login if in development mode
  const handleTestLogin = async () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/auth/dev-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        // body: JSON.stringify({
        //   identityKey: 'test|staff',
        //   upn: 'staff@test.local',
        //   name: 'Test Staff Member',
        //   tid: 'test-tenant'
        // }),
      });

      if (response.ok) {
        window.location.href = '/dashboard';
      } else {
        setError('Test login failed');
      }
    } catch (e) {
      setError('Test login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle staff login for testing admin restrictions
  const handleStaffLogin = async () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/auth/dev-login-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        window.location.href = '/dashboard';
      } else {
        setError('Staff login failed');
      }
    } catch (e) {
      setError('Staff login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Real Time Ticketing System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with your organization account
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Authentication Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={handleAzureLogin}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.04 12c0-.62-.05-1.21-.16-1.78H12v3.36h6.19c-.27 1.45-1.08 2.68-2.3 3.5v2.92h3.72C21.26 17.94 23.04 15.2 23.04 12z"/>
                      <path d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 24 12 24z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </span>
                  Sign in with Microsoft
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="space-y-3">
                <button
                  onClick={handleTestLogin}
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Dev Login as ADMIN (Can Export)
                </button>
                <button
                  onClick={handleStaffLogin}
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Dev Login as STAFF (Cannot Export)
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 text-center">
                Development mode - Test admin vs staff permissions
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-600">
              Secure authentication powered by Microsoft Azure AD
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}