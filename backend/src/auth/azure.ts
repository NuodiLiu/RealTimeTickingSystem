// src/auth/azure.ts
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import dotenv from "dotenv";
dotenv.config();

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

const baseUrl = getBaseUrl();
export const authParams = {
  redirectUri: `${baseUrl}/auth/redirect`,
  scopes: [
    "openid", 
    "profile", 
    "email",
    "api://57938c34-d786-42be-81e9-2a758b7e14b2/Api.Read"
  ], 
};

// Export URLs for use in other modules
export const urls = {
  baseUrl,
  frontendUrl: getFrontendUrl(),
  isProduction,
};
