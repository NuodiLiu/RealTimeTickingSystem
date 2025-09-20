"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const azure_auth_middleware_1 = require("../middlewares/azure-auth.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const config_1 = require("./config");
const router = (0, express_1.Router)();
// Device connection endpoint - requires device API key
router.get('/device/connect', auth_middleware_1.requireDevice, async (req, res) => {
    var _a;
    try {
        if (!req.device) {
            return res.status(401).json({ error: 'Device authentication required' });
        }
        const deviceId = req.device.deviceId;
        const connectionInfo = config_1.signalRConfig.getConnectionInfo(deviceId);
        res.json({
            url: connectionInfo.url,
            accessToken: connectionInfo.accessToken,
            deviceId: deviceId,
            mode: ((_a = req.device.device) === null || _a === void 0 ? void 0 : _a.mode) || 'kiosk'
        });
    }
    catch (error) {
        console.error('Error generating device connection URL:', error);
        res.status(500).json({ error: 'Failed to generate connection URL' });
    }
});
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