"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
// Device connection endpoint
router.get('/device/connect', auth_1.signalRAuthMiddleware, auth_1.getDeviceConnectionUrl);
// Dashboard connection endpoint  
router.get('/dashboard/connect', auth_1.signalRAuthMiddleware, auth_1.getDashboardConnectionUrl);
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