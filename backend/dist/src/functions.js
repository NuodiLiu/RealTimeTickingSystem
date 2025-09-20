"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpTrigger = httpTrigger;
exports.createExpressResponse = createExpressResponse;
// Load environment variables first - support multiple paths for Azure Functions
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Try loading .env from multiple possible locations
const envPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(__dirname, '../.env'),
    path_1.default.resolve(__dirname, '../../.env'),
    '.env'
];
let envLoaded = false;
for (const envPath of envPaths) {
    try {
        const result = dotenv_1.default.config({ path: envPath });
        if (!result.error) {
            console.log(`Environment loaded from: ${envPath}`);
            envLoaded = true;
            break;
        }
    }
    catch (error) {
        // Continue to next path
    }
}
if (!envLoaded) {
    console.warn('No .env file found, using process environment variables only');
}
// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    console.error('Current DATABASE_URL:', process.env.DATABASE_URL ? '[REDACTED]' : 'undefined');
}
const functions_1 = require("@azure/functions");
// Import all function modules to register them
require("./functions/negotiate");
require("./functions/sendMessage");
require("./functions/signalrEvents");
const stream_1 = require("stream");
// Import the complete Express app
const expressApp_1 = require("./expressApp");
// 配置化的路由前缀处理
const CONFIG = {
    expressBase: process.env.EXPRESS_BASE_PATH || '/api/app',
    // 修正 SignalR 路由：添加 /api/negotiate 和 /api/signalr
    signalRPrefixes: (process.env.SIGNALR_PREFIXES || '/api/negotiate,/api/signalr').split(','),
    timeout: parseInt(process.env.EXPRESS_TIMEOUT_MS || '30000', 10), // 30s for file downloads
};
// 创建Express应用实例（在模块级别创建一次，重用）
const expressApp = (0, expressApp_1.createExpressApp)();
// Normalize headers for Azure Functions (join multi-value headers)
function normalizeHeaders(headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
            // 对于多值头部，用逗号分隔合并
            normalized[key] = value.join(', ');
        }
        else {
            normalized[key] = value;
        }
    }
    return normalized;
}
// Extract internal path from full Azure Functions path
function extractInternalPath(fullPath) {
    const normalizedPath = fullPath.toLowerCase();
    const normalizedBase = CONFIG.expressBase.toLowerCase();
    if (normalizedPath.startsWith(normalizedBase)) {
        return fullPath.slice(CONFIG.expressBase.length) || '/';
    }
    // 更安全的兜底：明确拒绝而不是猜测
    throw new Error(`Path ${fullPath} does not match expected base ${CONFIG.expressBase}`);
}
// Azure Functions HTTP trigger - wraps the complete Express app
async function httpTrigger(request, context) {
    context.log(`🌐 [HttpTrigger] Processing request: ${request.method} ${request.url}`);
    try {
        const requestUrl = new URL(request.url);
        const requestPath = requestUrl.pathname.toLowerCase();
        context.log(`🔍 [Route Analysis] Path: ${requestPath}, Method: ${request.method}`);
        context.log(`🔍 [Route Analysis] ExpressBase: ${CONFIG.expressBase}`);
        context.log(`🔍 [Route Analysis] SignalR Prefixes: ${CONFIG.signalRPrefixes.join(', ')}`);
        // Short-circuit CORS preflight at Functions layer - no credentials for Bearer auth
        if (request.method === 'OPTIONS') {
            // Support multiple frontend origins for development and production
            const allowedOrigins = [
                process.env.FRONTEND_URL || 'http://localhost:3001',
                'https://app.localhost',
                'http://localhost:3000',
                'http://localhost:3001'
            ];
            const reqOrigin = request.headers.get('origin') || '';
            const originHeader = allowedOrigins.includes(reqOrigin) ? reqOrigin : allowedOrigins[0];
            context.log(`🌐 [CORS] Request origin: ${reqOrigin}`);
            context.log(`🌐 [CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
            context.log(`🌐 [CORS] Using origin header: ${originHeader}`);
            const allowReqHeaders = request.headers.get('access-control-request-headers')
                || 'Content-Type, Authorization, X-Requested-With, x-user-id, x-user-type';
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': originHeader,
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': allowReqHeaders,
                    'Vary': 'Origin',
                    'Content-Length': '0'
                },
                body: ''
            };
        }
        // 白名单短路：SignalR 专属路由不要走 Express
        // 注意：只有直接的 SignalR 路由才跳过，不包括 /api/negotiate
        const isDirectSignalRRoute = CONFIG.signalRPrefixes.some(p => {
            // 排除 negotiate 路由，因为它需要被单独的 Azure Function 处理
            if (p === '/api/negotiate')
                return false;
            return requestPath === p || requestPath.startsWith(p + '/');
        });
        if (isDirectSignalRRoute) {
            context.log(`🚫 [SignalR Route] Blocking direct SignalR route: ${requestPath}`);
            return {
                status: 404,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Route not found' }) // 不暴露内部架构
            };
        }
        // ★★★ 提取内部路径，添加错误处理
        const internalPath = extractInternalPath(requestUrl.pathname);
        const expressRequest = await convertAzureRequestToExpress(request, internalPath);
        const expressResponse = createExpressResponse();
        // Process through Express app
        await new Promise((resolve, reject) => {
            // 动态超时时间，文件下载需要更长时间
            const timeout = setTimeout(() => {
                reject(new Error(`Express request timeout after ${CONFIG.timeout}ms`));
            }, CONFIG.timeout);
            // 设置响应完成回调
            expressResponse._setResponseCallback(() => {
                clearTimeout(timeout);
                resolve();
            });
            try {
                expressApp(expressRequest, expressResponse, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        reject(err);
                    }
                    else {
                        // 如果没有响应被发送但也没有错误，可能是路由没有匹配
                        if (!expressResponse.finished) {
                            console.warn('Express middleware completed but no response was sent for:', internalPath);
                        }
                        resolve();
                    }
                });
            }
            catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        });
        // � 简化响应处理：无需 Cookie 支持，直接规范化头部
        const responseHeaders = { ...expressResponse.headers };
        const normalizedHeaders = normalizeHeaders(responseHeaders);
        const response = {
            status: expressResponse.statusCode || 200,
            headers: normalizedHeaders,
            body: expressResponse.body
        };
        return response;
    }
    catch (error) {
        context.log('Error processing request:', error);
        // 根据错误类型返回不同状态码
        if (error instanceof Error && error.message.includes('does not match expected base')) {
            return {
                status: 404,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'Route not found' })
            };
        }
        return {
            status: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
async function convertAzureRequestToExpress(request, internalPath) {
    const url = new URL(request.url);
    const forwardedUrl = internalPath + (url.search || '');
    // 读取原始 body
    let rawBody;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            const ab = await request.arrayBuffer();
            rawBody = Buffer.from(ab);
        }
        catch { }
    }
    // 规范化 query
    const query = {};
    for (const [k, v] of url.searchParams.entries()) {
        const cur = query[k];
        query[k] = cur === undefined ? v : (Array.isArray(cur) ? [...cur, v] : [cur, v]);
    }
    // 规范化 headers（全小写）
    const headers = {};
    for (const [k, v] of request.headers.entries()) {
        const key = k.toLowerCase();
        const cur = headers[key];
        headers[key] = cur === undefined ? v : (Array.isArray(cur) ? [...cur, v] : [cur, v]);
    }
    // 确保 host 与 content-length
    if (!headers['host'])
        headers['host'] = url.host;
    if (rawBody && !headers['content-length'])
        headers['content-length'] = String(rawBody.length);
    // 真可读流：把 rawBody 推进去
    const reqStream = new stream_1.Readable({
        read() {
            if (rawBody)
                this.push(rawBody);
            this.push(null);
        }
    });
    // ---- 关键修复：提供“假 socket/connection” ----
    const fakeSocket = {
        destroyed: false,
        destroy: function (err) { this.destroyed = true; },
        setTimeout: function () { return this; },
        ref: function () { return this; },
        unref: function () { return this; },
        // 下面这些字段不是必须，但很多库会探测
        remoteAddress: '127.0.0.1',
        remoteFamily: 'IPv4',
        remotePort: 0,
        localAddress: '127.0.0.1',
        localPort: 0,
        readable: false,
        writable: false,
    };
    reqStream.socket = fakeSocket;
    reqStream.connection = fakeSocket;
    // ---------------------------------------------
    // 让中间件可做签名校验
    reqStream.rawBody = rawBody;
    // Node/Express 期望的字段
    reqStream.method = request.method;
    reqStream.url = forwardedUrl;
    reqStream.originalUrl = forwardedUrl;
    reqStream.path = internalPath;
    reqStream.baseUrl = '';
    reqStream.query = query;
    reqStream.headers = headers;
    reqStream.get = (name) => {
        const v = headers[name.toLowerCase()];
        return Array.isArray(v) ? v[0] : v;
    };
    reqStream.header = reqStream.get;
    reqStream.httpVersion = '1.1';
    reqStream.httpVersionMajor = 1;
    reqStream.httpVersionMinor = 1;
    // （可选）一些中间件会读这些 flag
    reqStream.aborted = false;
    reqStream.complete = true;
    return reqStream;
}
// Create Express response mock with comprehensive method support
function createExpressResponse() {
    let statusCode = 200;
    let headers = {};
    let body = null;
    let finished = false;
    let responseCallback = null;
    // Helper to set header (supporting multiple values)
    const setHeaderValue = (name, value) => {
        const lowerName = name.toLowerCase();
        if (Array.isArray(value)) {
            headers[lowerName] = value;
        }
        else if (headers[lowerName]) {
            // Convert to array if header already exists
            const existing = headers[lowerName];
            headers[lowerName] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        }
        else {
            headers[lowerName] = value;
        }
    };
    // Helper to finish response and notify callback
    const finishResponse = (data) => {
        if (finished)
            return;
        if (data !== undefined) {
            if (Buffer.isBuffer(data)) {
                body = data;
            }
            else if (typeof data === 'string') {
                body = data;
            }
            else {
                body = JSON.stringify(data);
                if (!headers['content-type']) {
                    setHeaderValue('content-type', 'application/json; charset=utf-8');
                }
            }
        }
        finished = true;
        // 通知Promise解决
        if (responseCallback && typeof responseCallback === 'function') {
            responseCallback();
        }
    };
    const response = {
        status: (code) => {
            statusCode = code;
            return response;
        },
        json: (data) => {
            if (finished)
                return response;
            body = JSON.stringify(data);
            setHeaderValue('content-type', 'application/json; charset=utf-8');
            finishResponse();
            return response;
        },
        send: (data) => {
            if (finished)
                return response;
            finishResponse(data);
            return response;
        },
        // Header manipulation methods
        set: (field, value) => {
            if (typeof field === 'object') {
                Object.entries(field).forEach(([k, v]) => setHeaderValue(k, v));
            }
            else if (value !== undefined) {
                setHeaderValue(field, value);
            }
            return response;
        },
        setHeader: (name, value) => {
            setHeaderValue(name, value);
            return response;
        },
        header: (name, value) => {
            setHeaderValue(name, value);
            return response;
        },
        getHeader: (name) => {
            const value = headers[name.toLowerCase()];
            return Array.isArray(value) ? value[0] : value;
        },
        getHeaders: () => {
            return { ...headers };
        },
        removeHeader: (name) => {
            delete headers[name.toLowerCase()];
            return response;
        },
        // Cookie methods - 为了兼容性保留，但现在主要使用 Bearer tokens
        cookie: (name, value, options = {}) => {
            let cookieString = `${name}=${encodeURIComponent(value)}`;
            if (options.domain)
                cookieString += `; Domain=${options.domain}`;
            if (options.path)
                cookieString += `; Path=${options.path}`;
            if (options.expires)
                cookieString += `; Expires=${options.expires.toUTCString()}`;
            if (options.maxAge)
                cookieString += `; Max-Age=${options.maxAge}`;
            if (options.httpOnly)
                cookieString += '; HttpOnly';
            if (options.secure)
                cookieString += '; Secure';
            if (options.sameSite)
                cookieString += `; SameSite=${options.sameSite}`;
            // 处理多个 cookies
            const existingCookies = headers['set-cookie'];
            if (existingCookies) {
                const cookieArray = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
                setHeaderValue('set-cookie', [...cookieArray, cookieString]);
            }
            else {
                setHeaderValue('set-cookie', cookieString);
            }
            return response;
        },
        clearCookie: (name, options = {}) => {
            const clearOptions = {
                ...options,
                expires: new Date(1), // Past date
                maxAge: 0
            };
            return response.cookie(name, '', clearOptions);
        },
        // Redirect methods - 你的业务中的 Azure AD 重定向
        redirect: (statusOrUrl, url) => {
            if (finished)
                return response;
            if (typeof statusOrUrl === 'string') {
                url = statusOrUrl;
                statusCode = 302;
            }
            else {
                statusCode = statusOrUrl;
            }
            if (url) {
                setHeaderValue('location', url);
            }
            // 关键修复：调用 finishResponse 来触发回调
            finishResponse(`Redirecting to ${url}`);
            return response;
        },
        location: (url) => {
            setHeaderValue('location', url);
            return response;
        },
        // Content negotiation and file handling - 你的 Excel 导出需要
        type: (contentType) => {
            setHeaderValue('content-type', contentType);
            return response;
        },
        contentType: (contentType) => {
            return response.type(contentType);
        },
        attachment: (filename) => {
            if (filename) {
                setHeaderValue('content-disposition', `attachment; filename="${filename}"`);
            }
            else {
                setHeaderValue('content-disposition', 'attachment');
            }
            return response;
        },
        download: (path, filename) => {
            // 简化版本，实际应该读取文件
            if (filename) {
                response.attachment(filename);
            }
            // 这里应该设置文件内容，但在你的业务中由 ExcelService 处理
            return response;
        },
        // Caching headers
        vary: (field) => {
            const existing = headers['vary'];
            const fields = existing ? `${existing}, ${field}` : field;
            setHeaderValue('vary', fields);
            return response;
        },
        // Content negotiation
        format: (obj) => {
            // 简化实现，默认使用 json
            if (obj.json) {
                obj.json();
            }
            return response;
        },
        // Stream support (基础实现)
        write: (chunk) => {
            if (!body)
                body = '';
            body += chunk;
            return true;
        },
        end: (data) => {
            if (finished)
                return response;
            finishResponse(data);
            return response;
        },
        // Properties
        get statusCode() { return statusCode; },
        set statusCode(code) { statusCode = code; },
        get headers() { return headers; },
        get body() { return body; },
        get finished() { return finished; },
        get headersSent() { return finished; },
        // 支持一些遗留中间件（现在主要使用 Bearer token）
        locals: {},
        // 内部方法：设置响应完成回调
        _setResponseCallback: (callback) => {
            responseCallback = callback;
        }
    };
    return response;
}
// Register the general API function - this should only handle /api/app/* routes
functions_1.app.http('api', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'app/{*restOfPath}', // Only handle /api/app/* routes, not SignalR routes
    handler: httpTrigger
});
//# sourceMappingURL=functions.js.map