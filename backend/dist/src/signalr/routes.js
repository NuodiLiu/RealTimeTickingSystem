"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const azure_auth_middleware_1 = require("../middlewares/azure-auth.middleware");
const config_1 = require("./config");
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
// Device connection endpoint - requires device API key
router.get('/device/connect', auth_1.signalRAuthMiddleware, auth_1.getDeviceConnectionUrl);
// Dashboard connection endpoint - requires Azure AD auth
router.get('/dashboard/connect', azure_auth_middleware_1.verifyAzureJWT, (0, azure_auth_middleware_1.requireScopes)(['Api.Read']), async (req, res) => {
    try {
        if (!req.azureAuth) {
            return res.status(401).json({ error: 'Azure AD authentication required' });
        }
        // Use identityKey as stable user ID for SignalR
        const userId = req.azureAuth.identityKey;
        console.log('Generating SignalR connection for user:', userId);
        // Get Azure SignalR Service connection info
        const connectionInfo = config_1.signalRConfig.getConnectionInfo(userId);
        console.log('Generated SignalR connection URL successfully');
        res.json({
            url: connectionInfo.url,
            accessToken: connectionInfo.accessToken,
            userId: userId,
            userInfo: {
                name: req.azureAuth.name,
                email: req.azureAuth.email,
                tenantId: req.azureAuth.tid
            }
        });
    }
    catch (error) {
        console.error('Error generating dashboard connection URL:', error);
        res.status(500).json({ error: 'Failed to generate connection URL' });
    }
});
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SignalR',
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
//# sourceMappingURL=routes.js.map