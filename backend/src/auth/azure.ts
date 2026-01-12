// src/auth/azure.ts
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

// --- load local .env only when running outside Azure ---
(function loadEnv() {
  // In Azure these envs are injected via App Settings, no .env needed
  const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.FUNCTIONS_WORKER_RUNTIME);

  if (!isAzure) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('dotenv').config();
    } catch (e) {
      console.warn('dotenv not loaded (likely prod/Azure):', (e as Error).message);
    }
  }
})();

// Environment detection and URL configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowAnyTenant = process.env.AZURE_AD_ALLOW_ANY_TENANT === 'true';
const tenant = allowAnyTenant ? "common" : (process.env.AZURE_AD_TENANT_ID || "common");
const authority = `https://login.microsoftonline.com/${tenant}`;

// Dynamic base URL based on environment
const getBaseUrl = () => {
  if (isProduction) {
    return process.env.BASE_URL || "https://api.ticketing-system.com";
  }
  // Development: Use the API_BASE_URL which includes /api/app path
  return process.env.API_BASE_URL || process.env.BASE_URL || "https://api.localhost/api/app";
};

const getFrontendUrl = () => {
  if (isProduction) {
    return process.env.FRONTEND_URL || "https://ticketing-system.com";
  }
  // Development: frontend proxy runs on HTTPS 8443
  return process.env.FRONTEND_URL || "https://localhost:8443";
};

export const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MSAL ${level}] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: isProduction ? LogLevel.Error : LogLevel.Info,
    },
  },
});

// Get scopes from environment or use defaults
const getScopes = () => {
  const defaultScopes = ["openid", "profile", "email"];
  
  // Check if custom scopes are provided in environment
  if (process.env.MSAL_SCOPES) {
    const customScopes = process.env.MSAL_SCOPES.split(',').map(s => s.trim());
    return [...defaultScopes, ...customScopes];
  }
  
  // Fallback: check for API Client ID
  if (process.env.AZURE_AD_API_CLIENT_ID) {
    return [...defaultScopes, `api://${process.env.AZURE_AD_API_CLIENT_ID}/Api.Read`];
  }
  
  return defaultScopes;
};

const baseUrl = getBaseUrl();
export const authParams = {
  redirectUri: `${baseUrl}/auth/redirect`,
  scopes: getScopes(),
};

// Export URLs for use in other modules
export const urls = {
  baseUrl,
  frontendUrl: getFrontendUrl(),
  isProduction,
};
