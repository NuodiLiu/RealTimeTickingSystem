// src/auth/azure.ts
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import dotenv from "dotenv";
dotenv.config();

// Environment detection and URL configuration
const isProduction = process.env.NODE_ENV === 'production';
const tenant = process.env.AZURE_AD_TENANT_ID || "common";
const authority = `https://login.microsoftonline.com/${tenant}`;

// Dynamic base URL based on environment
const getBaseUrl = () => {
  if (isProduction) {
    return process.env.BASE_URL || "https://api.ticketing-system.com";
  }
  // Development: backend runs on HTTP 3000, but OAuth redirects need to match frontend proxy
  return process.env.BASE_URL || "http://localhost:3000";
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
      loggerCallback: (_level, _message, _containsPii) => {},
      piiLoggingEnabled: false,
      logLevel: isProduction ? LogLevel.Error : LogLevel.Warning,
    },
  },
});

const baseUrl = getBaseUrl();
export const authParams = {
  redirectUri: `${baseUrl}/auth/redirect`,
  scopes: ["openid", "profile", "email"], 
};

// Export URLs for use in other modules
export const urls = {
  baseUrl,
  frontendUrl: getFrontendUrl(),
  isProduction,
};
