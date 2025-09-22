"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urls = exports.authParams = exports.msalClient = void 0;
// src/auth/azure.ts
const msal_node_1 = require("@azure/msal-node");
// --- load local .env only when running outside Azure ---
(function loadEnv() {
    // In Azure these envs are injected via App Settings, no .env needed
    const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.FUNCTIONS_WORKER_RUNTIME);
    if (!isAzure) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('dotenv').config();
        }
        catch (e) {
            console.warn('dotenv not loaded (likely prod/Azure):', e.message);
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
exports.msalClient = new msal_node_1.ConfidentialClientApplication({
    auth: {
        clientId: process.env.AZURE_AD_CLIENT_ID,
        authority,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[MSAL ${level}] ${message}`);
                }
            },
            piiLoggingEnabled: false,
            logLevel: isProduction ? msal_node_1.LogLevel.Error : msal_node_1.LogLevel.Info,
        },
    },
});
const baseUrl = getBaseUrl();
exports.authParams = {
    redirectUri: `${baseUrl}/auth/redirect`,
    scopes: [
        "openid",
        "profile",
        "email",
        "api://57938c34-d786-42be-81e9-2a758b7e14b2/Api.Read"
    ],
};
// Export URLs for use in other modules
exports.urls = {
    baseUrl,
    frontendUrl: getFrontendUrl(),
    isProduction,
};
//# sourceMappingURL=azure.js.map