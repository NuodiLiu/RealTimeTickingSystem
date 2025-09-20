"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Temporary test server without SignalR to check if that's causing the issue
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = __importDefault(require("http"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const auth_router_1 = __importDefault(require("./routers/auth.router"));
const cases_router_1 = __importDefault(require("./routers/cases.router"));
const pair_router_1 = __importDefault(require("./routers/pair.router"));
const device_router_1 = __importDefault(require("./routers/device.router"));
const feedback_router_1 = __importDefault(require("./routers/feedback.router"));
const excel_router_1 = __importDefault(require("./routers/excel.router"));
const error_middleware_1 = require("./middlewares/error.middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Trust proxies 
app.set("trust proxy", 1);
app.use((0, cookie_session_1.default)({
    name: "sid",
    keys: (process.env.SESSION_KEYS || "").split(","),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
}));
// Middleware
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use((0, cookie_parser_1.default)());
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
}));
// Routers
app.use("/auth", auth_router_1.default);
app.use("/cases", cases_router_1.default);
app.use("/pair", pair_router_1.default);
app.use("/device", device_router_1.default);
app.use("/feedback", feedback_router_1.default);
app.use("/excel", excel_router_1.default);
// Error handler 
app.use(error_middleware_1.errorHandler);
// Simple health endpoint
app.get("/health", async (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Test server without SignalR"
    });
});
// Only listen when not in test mode / serverless
if (process.env.NODE_ENV !== "test" &&
    !process.env.AWS_LAMBDA_FUNCTION_NAME &&
    !process.env.VERCEL &&
    !process.env.NETLIFY) {
    const server = http_1.default.createServer(app);
    server.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`HTTP listening on http://0.0.0.0:${PORT}`);
        console.log(`Test server started successfully`);
    });
}
exports.default = app;
//# sourceMappingURL=test-server.js.map