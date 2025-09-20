import https from 'https';
import http from 'http';
/**
 * Create HTTPS server for production or HTTP server for development
 */
export declare function createServer(): {
    httpsServer: https.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    app: import("express").Application;
    port: number;
    httpPort: number;
    isHttps: boolean;
} | {
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    app: import("express").Application;
    port: number;
    isHttps: boolean;
    httpsServer?: never;
    httpPort?: never;
};
/**
 * Start the server(s)
 */
export declare function startServer(): {
    httpsServer: https.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    app: import("express").Application;
    port: number;
    httpPort: number;
    isHttps: boolean;
} | {
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    app: import("express").Application;
    port: number;
    isHttps: boolean;
    httpsServer?: never;
    httpPort?: never;
};
//# sourceMappingURL=https-server.d.ts.map