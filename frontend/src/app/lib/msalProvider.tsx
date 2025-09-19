"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { PublicClientApplication, AccountInfo, AuthenticationResult, EventType, EventMessage } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';

interface MSALContextType {
  instance: PublicClientApplication;
  accounts: AccountInfo[];
  inProgress: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  user: AccountInfo | null;
}

const MSALContext = createContext<MSALContextType | null>(null);

export const useMSAL = () => {
  const context = useContext(MSALContext);
  if (!context) {
    throw new Error('useMSAL must be used within MSALProvider');
  }
  return context;
};

interface MSALProviderProps {
  children: React.ReactNode;
}

export const MSALProvider: React.FC<MSALProviderProps> = ({ children }) => {
  const [instance] = useState(() => new PublicClientApplication(msalConfig));
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [inProgress, setInProgress] = useState(false);

  // Request API consent after login
  const requestApiConsent = async (account: AccountInfo) => {
    const apiScope = process.env.NEXT_PUBLIC_API_SCOPE || 'api://your-api-client-id/Api.Read';
    const apiTokenRequest = {
      scopes: [apiScope],
      account: account,
      prompt: 'consent' // Force consent screen to ensure API access
    };

    try {
      console.log('Requesting API consent for scope:', apiScope);
      await instance.acquireTokenSilent(apiTokenRequest);
      console.log('API consent already granted');
    } catch (error) {
      console.log('API consent needed, requesting interactively...', error);
      try {
        // Use redirect instead of popup to avoid popup blocker issues
        console.log('Using redirect for API consent...');
        await instance.acquireTokenRedirect(apiTokenRequest);
        // Note: redirect will reload the page, so execution stops here
      } catch (redirectError) {
        console.error('API consent failed:', redirectError);
        // Don't block the user, they can still use profile features
      }
    }
  };

  useEffect(() => {
    // Initialize MSAL
    instance.initialize().then(() => {
      // Check if we have accounts
      const currentAccounts = instance.getAllAccounts();
      setAccounts(currentAccounts);

      // Set up event callbacks
      instance.addEventCallback((message: EventMessage) => {
        switch (message.eventType) {
          case EventType.LOGIN_SUCCESS:
            console.log('Login successful');
            const result = message.payload as AuthenticationResult;
            if (result.account) {
              setAccounts([result.account]);
              // After successful login, immediately try to get API consent
              requestApiConsent(result.account);
            }
            setInProgress(false);
            break;
          case EventType.LOGIN_FAILURE:
            console.error('Login failed:', message.error);
            setInProgress(false);
            break;
          case EventType.LOGOUT_SUCCESS:
            console.log('Logout successful');
            setAccounts([]);
            setInProgress(false);
            break;
          case EventType.ACQUIRE_TOKEN_SUCCESS:
            console.log('Token acquired successfully');
            break;
          case EventType.ACQUIRE_TOKEN_FAILURE:
            console.error('Token acquisition failed:', message.error);
            break;
        }
      });

      // Handle redirect promise (for when user returns from Azure AD)
      instance.handleRedirectPromise().then((response) => {
        if (response) {
          console.log('Redirect promise resolved:', response);
          setAccounts([response.account!]);
          // Request API consent for redirect login
          requestApiConsent(response.account!);
        } else {
          // Check if user already logged in and ensure API consent
          const currentAccounts = instance.getAllAccounts();
          if (currentAccounts.length > 0) {
            requestApiConsent(currentAccounts[0]);
          }
        }
        setInProgress(false);
      }).catch((error) => {
        console.error('Error handling redirect promise:', error);
        setInProgress(false);
      });
    });
  }, [instance]);

  const login = async () => {
    setInProgress(true);
    try {
      // Use redirect flow (recommended for production)
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login error:', error);
      setInProgress(false);
    }
  };

  const logout = async () => {
    setInProgress(true);
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
      });
    } catch (error) {
      console.error('Logout error:', error);
      setInProgress(false);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    console.log('getAccessToken called, accounts length:', accounts.length);
    
    if (accounts.length === 0) {
      console.warn('No accounts available for token acquisition');
      return null;
    }

    // CRITICAL: Use API-specific scopes for getting access token for backend API
    // NOT loginRequest which contains profile scopes
    const apiScope = process.env.NEXT_PUBLIC_API_SCOPE || 'api://your-api-client-id/Api.Read';
    const apiTokenRequest = {
      scopes: [apiScope],
      account: accounts[0]
    };

    console.log('Token request config:', {
      scope: apiScope,
      accountId: accounts[0].homeAccountId,
      accountUsername: accounts[0].username
    });

    try {
      const response = await instance.acquireTokenSilent(apiTokenRequest);
      console.log('Token acquired successfully:', {
        tokenLength: response.accessToken.length,
        expiresOn: response.expiresOn,
        scopes: response.scopes
      });
      return response.accessToken;
    } catch (error) {
      console.warn('Silent token acquisition failed:', error);
      try {
        // Fallback to redirect token acquisition (better than popup)
        console.log('Attempting redirect token acquisition...');
        await instance.acquireTokenRedirect(apiTokenRequest);
        // Note: acquireTokenRedirect doesn't return a value, it redirects
        return null;
      } catch (redirectError) {
        console.error('Token acquisition failed:', redirectError);
        return null;
      }
    }
  };

  const contextValue: MSALContextType = {
    instance,
    accounts,
    inProgress,
    login,
    logout,
    getAccessToken,
    isAuthenticated: accounts.length > 0,
    user: accounts.length > 0 ? accounts[0] : null
  };

  return (
    <MSALContext.Provider value={contextValue}>
      {children}
    </MSALContext.Provider>
  );
};
