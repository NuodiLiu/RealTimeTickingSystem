"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts - Development/Production server with HTTPS support
const dotenv_1 = __importDefault(require("dotenv"));
const https_server_1 = require("./https-server");
dotenv_1.default.config();
console.log(`🚀 Starting server...`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
const serverConfig = (0, https_server_1.startServer)();
// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);
    const shutdownPromises = [];
    if (serverConfig.httpsServer) {
        shutdownPromises.push(new Promise((resolve) => {
            serverConfig.httpsServer.close(() => {
                console.log('HTTPS server closed.');
                resolve(void 0);
            });
        }));
    }
    if (serverConfig.httpServer) {
        shutdownPromises.push(new Promise((resolve) => {
            serverConfig.httpServer.close(() => {
                console.log('HTTP server closed.');
                resolve(void 0);
            });
        }));
    }
    Promise.all(shutdownPromises).then(() => {
        console.log('All servers closed. Exiting...');
        process.exit(0);
    });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
exports.default = serverConfig.app;
//# sourceMappingURL=server.js.map