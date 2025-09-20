'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] Starting callback handling...');
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        console.log('[AuthCallback] URL params:', { 
          hasToken: !!token, 
          tokenLength: token?.length,
          tokenPreview: token?.substring(0, 50) + '...',
          error 
        });

        if (error) {
          console.error('[AuthCallback] Auth error from URL:', error);
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        if (token) {
          console.log('[AuthCallback] Storing App JWT in localStorage...');
          // Store App JWT in localStorage for API calls
          localStorage.setItem('appJwt', token);
          console.log('[AuthCallback] App JWT stored successfully');
          
          setStatus('success');
          setMessage('Authentication successful! Redirecting to dashboard...');
          
          // Clear URL parameters for security
          console.log('[AuthCallback] Clearing URL parameters...');
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to dashboard
          console.log('[AuthCallback] Redirecting to dashboard in 1.5s...');
          setTimeout(() => {
            console.log('[AuthCallback] Executing redirect to dashboard');
            router.push('/dashboard');
          }, 1500);
        } else {
          console.error('[AuthCallback] No token found in URL parameters');
          setStatus('error');
          setMessage('No authentication token received.');
          setTimeout(() => router.push('/login'), 3000);
        }
      } catch (error) {
        console.error('[AuthCallback] Auth callback error:', error);
        setStatus('error');
        setMessage('Authentication processing failed.');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center p-8">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          )}
          {status === 'success' && (
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'error' && (
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'processing' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>
          <p className="text-gray-600">{message}</p>
        </div>
        
        {status === 'error' && (
          <div className="mt-6">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
