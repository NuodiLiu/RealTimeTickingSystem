"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authParams = exports.msalClient = void 0;
// src/auth/azure.ts
const msal_node_1 = require("@azure/msal-node");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const tenant = process.env.AZURE_AD_TENANT_ID || "common";
const authority = `https://login.microsoftonline.com/${tenant}`; // v2 endpoint
exports.msalClient = new msal_node_1.ConfidentialClientApplication({
    auth: {
        clientId: process.env.AZURE_AD_CLIENT_ID,
        authority,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    },
    system: {
        loggerOptions: {
            loggerCallback: (_level, _message, _containsPii) => { },
            piiLoggingEnabled: false,
            logLevel: msal_node_1.LogLevel.Warning,
        },
    },
});
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
exports.authParams = {
    redirectUri: `${baseUrl}/auth/redirect`,
    scopes: ["openid", "profile", "email"],
};
//# sourceMappingURL=azure.js.map