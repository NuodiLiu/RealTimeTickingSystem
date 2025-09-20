"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
// src/https-server.ts
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const expressApp_1 = require("./expressApp");
/**
 * Create HTTPS server for production or HTTP server for development
 */
function createServer() {
    const app = (0, expressApp_1.createExpressApp)();
    const isProduction = process.env.NODE_ENV === 'production';
    const port = process.env.PORT || (isProduction ? 443 : 3000);
    if (isProduction && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
        // Production HTTPS server
        try {
            const httpsOptions = {
                key: fs_1.default.readFileSync(process.env.SSL_KEY_PATH),
                cert: fs_1.default.readFileSync(process.env.SSL_CERT_PATH),
                // Optional: Include intermediate certificates
                ...(process.env.SSL_CA_PATH && {
                    ca: fs_1.default.readFileSync(process.env.SSL_CA_PATH)
                })
            };
            const httpsServer = https_1.default.createServer(httpsOptions, app);
            // Also create HTTP server for redirecting to HTTPS
            const httpApp = createRedirectApp();
            const httpServer = http_1.default.createServer(httpApp);
            return {
                httpsServer,
                httpServer,
                app,
                port: port,
                httpPort: 80,
                isHttps: true
            };
        }
        catch (error) {
            console.error('Failed to create HTTPS server:', error);
            console.log('Falling back to HTTP server...');
        }
    }
    // Development HTTP server or fallback
    const httpServer = http_1.default.createServer(app);
    return {
        httpServer,
        app,
        port: port,
        isHttps: false
    };
}
/**
 * Create simple HTTP app that redirects all traffic to HTTPS
 */
function createRedirectApp() {
    const redirectApp = (0, expressApp_1.createExpressApp)();
    redirectApp.use('*', (req, res) => {
        const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
        res.redirect(301, httpsUrl);
    });
    return redirectApp;
}
/**
 * Start the server(s)
 */
function startServer() {
    const serverConfig = createServer();
    if (serverConfig.isHttps && serverConfig.httpsServer && serverConfig.httpServer) {
        // Start HTTPS server
        serverConfig.httpsServer.listen(serverConfig.port, () => {
            console.log(`🚀 HTTPS Server running on port ${serverConfig.port}`);
            console.log(`🔒 SSL/TLS enabled`);
        });
        // Start HTTP redirect server
        serverConfig.httpServer.listen(serverConfig.httpPort, () => {
            console.log(`🔄 HTTP Redirect server running on port ${serverConfig.httpPort}`);
        });
    }
    else {
        // Start HTTP server
        serverConfig.httpServer.listen(serverConfig.port, () => {
            console.log(`🚀 HTTP Server running on port ${serverConfig.port}`);
            if (process.env.NODE_ENV === 'production') {
                console.log(`⚠️  Production mode but no HTTPS configured`);
            }
        });
    }
    return serverConfig;
}
//# sourceMappingURL=https-server.js.map