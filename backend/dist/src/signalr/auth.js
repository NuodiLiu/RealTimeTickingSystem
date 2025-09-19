"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignalRToken = generateSignalRToken;
exports.generateDashboardToken = generateDashboardToken;
exports.verifySignalRToken = verifySignalRToken;
exports.signalRAuthMiddleware = signalRAuthMiddleware;
exports.getDeviceConnectionUrl = getDeviceConnectionUrl;
exports.getDashboardConnectionUrl = getDashboardConnectionUrl;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
async function generateSignalRToken(device) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required for SignalR authentication');
    }
    const token = jsonwebtoken_1.default.sign({
        deviceId: device.deviceId,
        mode: device.mode,
        type: 'device',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    }, secret);
    return token;
}
async function generateDashboardToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required for SignalR authentication');
    }
    const token = jsonwebtoken_1.default.sign({
        userId,
        type: 'dashboard',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    }, secret);
    return token;
}
function verifySignalRToken(token) {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is required for SignalR authentication');
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return {
            deviceId: decoded.deviceId,
            userId: decoded.userId,
            mode: decoded.mode,
            type: decoded.type
        };
    }
    catch (error) {
        console.error('SignalR token verification failed:', error);
        return null;
    }
}
async function signalRAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header required' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = verifySignalRToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (decoded.type === 'device' && decoded.deviceId && decoded.mode) {
            req.device = {
                deviceId: decoded.deviceId,
                mode: decoded.mode
            };
        }
        else if (decoded.type === 'dashboard' && decoded.userId) {
            req.userId = decoded.userId;
        }
        else {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        next();
    }
    catch (error) {
        console.error('SignalR auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
}
// SignalR connection URL generation endpoints
async function getDeviceConnectionUrl(req, res) {
    try {
        if (!req.device) {
            return res.status(401).json({ error: 'Device authentication required' });
        }
        const connectionInfo = config_1.signalRConfig.getConnectionInfo(req.device.deviceId);
        const token = await generateSignalRToken(req.device);
        res.json({
            url: connectionInfo.url,
            accessToken: connectionInfo.accessToken,
            deviceId: req.device.deviceId,
            mode: req.device.mode
        });
    }
    catch (error) {
        console.error('Error generating device connection URL:', error);
        res.status(500).json({ error: 'Failed to generate connection URL' });
    }
}
async function getDashboardConnectionUrl(req, res) {
    try {
        // Get user ID from Azure AD authentication context
        if (!req.azureAuth) {
            return res.status(401).json({ error: 'Azure AD authentication required' });
        }
        const userId = req.azureAuth.identityKey;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in authentication context' });
        }
        console.log('Generating SignalR connection for user:', userId);
        // Use Azure SignalR Service connection info
        const connectionInfo = config_1.signalRConfig.getConnectionInfo(userId);
        console.log('Generated SignalR connection URL successfully');
        console.log('URL:', connectionInfo.url);
        res.json({
            url: connectionInfo.url,
            accessToken: connectionInfo.accessToken,
            userId: userId
        });
    }
    catch (error) {
        console.error('Error generating dashboard connection URL:', error);
        res.status(500).json({ error: 'Failed to generate connection URL' });
    }
}
//# sourceMappingURL=auth.js.map