// MSAL Configuration for Microsoft SSO
import { Configuration, PopupRequest, RedirectRequest } from '@azure/msal-browser';

// MSAL instance configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID!, // Your Azure AD App Registration Client ID
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'common'}`, // Tenant ID or 'common'
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3001/auth/callback', // Must match Azure AD config
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3001'
  },
  cache: {
    cacheLocation: 'localStorage', // Store tokens in localStorage
    storeAuthStateInCookie: false, // Set to true for IE11 support
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        
        switch (level) {
          case 0: // LogLevel.Error
            console.error(message);
            return;
          case 1: // LogLevel.Warning
            console.warn(message);
            return;
          case 2: // LogLevel.Info
            console.info(message);
            return;
          case 3: // LogLevel.Verbose
            console.debug(message);
            return;
        }
      }
    }
  }
};

// 1. Login request - only basic profile scopes (no API scopes)
export const loginRequest: RedirectRequest = {
  scopes: [
    'openid',
    'profile', 
    'email',
    'offline_access' // For refresh tokens
  ]
};

// 2. Microsoft Graph API request - only Graph scopes
export const graphRequest: PopupRequest = {
  scopes: [
    'User.Read',
    'email',
    'profile'
  ]
};

// 3. Custom API request - only your API scopes (resource-specific, NOT .default)
export const apiRequest: PopupRequest = {
  scopes: [
    // Use specific scopes you defined in "Expose an API", e.g.:
    process.env.NEXT_PUBLIC_API_SCOPE || `api://${process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID}/Api.Read`
  ]
};

// Graph API configuration
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me'
};
