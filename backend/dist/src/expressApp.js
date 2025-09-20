"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressApp = createExpressApp;
// src/expressApp.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const YAML = __importStar(require("yamljs"));
const auth_router_1 = __importDefault(require("./routers/auth.router"));
const cases_router_1 = __importDefault(require("./routers/cases.router"));
const pair_router_1 = __importDefault(require("./routers/pair.router"));
const device_router_1 = __importDefault(require("./routers/device.router"));
const feedback_router_1 = __importDefault(require("./routers/feedback.router"));
const excel_router_1 = __importDefault(require("./routers/excel.router"));
const error_middleware_1 = require("./middlewares/error.middleware");
// Import SignalR for serverless
const routes_1 = __importDefault(require("./signalr/routes"));
const webhook_1 = require("./signalr/webhook");
const signalr_1 = require("./signalr");
dotenv_1.default.config();
function createExpressApp() {
    const app = (0, express_1.default)();
    // Trust proxies - Azure Functions behind load balancer
    app.set("trust proxy", 1);
    // Cookie parser - ensure cookies are available in serverless environment
    app.use((0, cookie_parser_1.default)());
    // Enhanced CORS configuration for multi-domain support and HTTPS
    const corsOptions = {
        origin: (origin, callback) => {
            // Build allowed origins based on environment
            const allowedOrigins = [];
            if (process.env.NODE_ENV === 'production') {
                // Production HTTPS domains
                allowedOrigins.push('https://ticketing-system.com', 'https://www.ticketing-system.com', 'https://api.ticketing-system.com');
                // Additional production origins from env
                if (process.env.ALLOWED_ORIGINS) {
                    allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
                }
            }
            else {
                // Development domains - include HTTPS proxy and dual domains
                allowedOrigins.push(
                // HTTP origins (直接访问)
                'http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3000', 
                // HTTPS proxy origins (旧配置)
                'https://localhost:8443', 'https://127.0.0.1:8443', 
                // nginx双域名代理 (新配置)
                'https://api.localhost', 'https://app.localhost');
            }
            // Add configured frontend URL
            const frontendUrl = process.env.FRONTEND_URL;
            if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
                allowedOrigins.push(frontendUrl);
            }
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: false, // No cookies/sessions, using Bearer tokens
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
            'Authorization', 'Cache-Control', 'Pragma',
            'x-user-id', 'x-user-type' // SignalR custom headers
        ],
        optionsSuccessStatus: 200, // For legacy browser support
        preflightContinue: false
    };
    app.use((0, cors_1.default)(corsOptions));
    // Conditional middleware based on environment
    // 在 Azure Functions 环境中，body 已经在 Functions 层解析过了
    const isAzureFunctions = process.env.FUNCTIONS_WORKER_RUNTIME || process.env.AzureWebJobsScriptRoot;
    if (!isAzureFunctions) {
        // 仅在非 Azure Functions 环境中使用 Express body parsers
        app.use(express_1.default.json({
            limit: process.env.JSON_LIMIT || "50mb",
            verify: (req, res, buf) => {
                // Store raw body for signature verification (webhooks, etc.)
                req.rawBody = buf;
            }
        }));
        app.use(express_1.default.urlencoded({
            limit: process.env.URLENCODED_LIMIT || "50mb",
            extended: true,
            verify: (req, res, buf) => {
                if (!req.rawBody)
                    req.rawBody = buf;
            }
        }));
    }
    else {
        // Azure Functions 环境：添加中间件来验证 body 是否已预解析
        app.use((req, res, next) => {
            // 检查是否已经有 _body 标记（来自 Azure Functions wrapper）
            if (req._body && req.body !== undefined) {
                // Body 已经解析过，跳过
                return next();
            }
            // 如果没有预解析，可能是直接从 Express server 调用
            // 这种情况下回退到标准解析
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                console.warn('Body not pre-parsed in Azure Functions environment, falling back to Express parsing');
            }
            next();
        });
    }
    // Enhanced helmet configuration for Azure Functions
    if (process.env.NODE_ENV === 'production') {
        app.use((0, helmet_1.default)({
            crossOriginEmbedderPolicy: false // 避免与 Azure Functions 冲突
        }));
    }
    else {
        app.use((0, helmet_1.default)({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        }));
    }
    // API Documentation (Swagger UI) - only in development
    if (process.env.NODE_ENV !== 'production') {
        try {
            const swaggerDocument = YAML.load('./docs/api.yaml');
            app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument, {
                explorer: true,
                customCss: '.swagger-ui .topbar { display: none }',
                customSiteTitle: "Real-Time Ticketing System API"
            }));
            console.log('API documentation available at: /api-docs');
        }
        catch (error) {
            console.warn('Could not load API documentation:', error);
        }
    }
    // Routers
    app.use("/auth", auth_router_1.default);
    app.use("/cases", cases_router_1.default);
    app.use("/pair", pair_router_1.default);
    app.use("/device", device_router_1.default);
    app.use("/feedback", feedback_router_1.default);
    app.use("/excel", excel_router_1.default);
    // SignalR routes and webhooks
    app.use("/api/signalr", routes_1.default);
    (0, webhook_1.setupWebPubSubWebhooks)(app);
    // Error handler 
    app.use(error_middleware_1.errorHandler);
    // /health endpoint - serverless compatible
    app.get("/health", async (_req, res) => {
        try {
            const stats = await signalr_1.SignalRGateway.getConnectionStats();
            res.json({
                status: "ok",
                timestamp: new Date().toISOString(),
                signalR: {
                    connections: stats.total,
                    serverless: stats.serverless || false
                }
            });
        }
        catch (error) {
            res.json({
                status: "ok",
                timestamp: new Date().toISOString(),
                signalR: {
                    error: "SignalR service unavailable",
                    serverless: true
                }
            });
        }
    });
    return app;
}
//# sourceMappingURL=expressApp.js.map