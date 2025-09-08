// src/auth/azure.ts
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

const tenant = process.env.AZURE_AD_TENANT_ID || "common";
const authority = `https://login.microsoftonline.com/${tenant}`; // v2 endpoint

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
      logLevel: LogLevel.Warning,
    },
  },
});

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
export const authParams = {
  redirectUri: `${baseUrl}/auth/redirect`,
  scopes: ["openid", "profile", "email"], // 只登录拿 ID Token 即可；需要 Graph 可再加 "User.Read"
};
