// src/expressApp.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import * as YAML from "yamljs";

import authRouter from "./routers/auth.router";
import casesRouter from "./routers/cases.router";
import pairRouter from "./routers/pair.router";
import deviceRouter from "./routers/device.router";
import feedbackRouter from "./routers/feedback.router";
import excelRouter from "./routers/excel.router";
import { errorHandler } from "./middlewares/error.middleware";

// Import SignalR for serverless
import signalRRoutes from "./signalr/routes";
import { setupWebPubSubWebhooks } from "./signalr/webhook";
import { SignalRGateway } from "./signalr";

dotenv.config();

export function createExpressApp(): express.Application {
  const app = express();

  // Trust proxies - Azure Functions behind load balancer
  app.set("trust proxy", 1);
  
  // Enhanced CORS configuration for multi-domain support and HTTPS
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Build allowed origins based on environment
      const allowedOrigins = [];
      
      if (process.env.NODE_ENV === 'production') {
        // Production HTTPS domains
        allowedOrigins.push(
          'https://ticketing-system.com',
          'https://www.ticketing-system.com',
          'https://api.ticketing-system.com'
        );
        
        // Additional production origins from env
        if (process.env.ALLOWED_ORIGINS) {
          allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
        }
      } else {
        // Development domains - include HTTPS proxy and dual domains
        allowedOrigins.push(
          // HTTP origins (直接访问)
          'http://localhost:3001',
          'http://localhost:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3000',
          // HTTPS proxy origins (旧配置)
          'https://localhost:8443',
          'https://127.0.0.1:8443',
          // nginx双域名代理 (新配置)
          'https://api.localhost',
          'https://app.localhost'
        );
      }
      
      // Add configured frontend URL
      const frontendUrl = process.env.FRONTEND_URL;
      if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
        allowedOrigins.push(frontendUrl);
      }
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
  
  app.use(cors(corsOptions));

  // Conditional middleware based on environment
  // 在 Azure Functions 环境中，body 已经在 Functions 层解析过了
  const isAzureFunctions = process.env.FUNCTIONS_WORKER_RUNTIME || process.env.AzureWebJobsScriptRoot;
  
  if (!isAzureFunctions) {
    // 仅在非 Azure Functions 环境中使用 Express body parsers
    app.use(express.json({ 
      limit: process.env.JSON_LIMIT || "50mb",
      verify: (req: any, res, buf) => {
        // Store raw body for signature verification (webhooks, etc.)
        req.rawBody = buf;
      }
    }));
    app.use(express.urlencoded({ 
      limit: process.env.URLENCODED_LIMIT || "50mb", 
      extended: true,
      verify: (req: any, res, buf) => {
        if (!req.rawBody) req.rawBody = buf;
      }
    }));
  } else {
    // Azure Functions 环境：添加中间件来验证 body 是否已预解析
    app.use((req: any, res, next) => {
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
    app.use(helmet({
      crossOriginEmbedderPolicy: false // 避免与 Azure Functions 冲突
    }));
  } else {
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
  }

  // API Documentation (Swagger UI) - only in development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const swaggerDocument = YAML.load('./docs/api.yaml');
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Real-Time Ticketing System API"
      }));
      console.log('API documentation available at: /api-docs');
    } catch (error) {
      console.warn('Could not load API documentation:', error);
    }
  }

  // Routers
  app.use("/auth", authRouter);
  app.use("/cases", casesRouter);
  app.use("/pair", pairRouter);
  app.use("/device", deviceRouter);
  app.use("/feedback", feedbackRouter);
  app.use("/excel", excelRouter);

  // SignalR routes and webhooks
  app.use("/api/signalr", signalRRoutes);
  setupWebPubSubWebhooks(app);

  // Error handler 
  app.use(errorHandler);

  // /health endpoint - serverless compatible
  app.get("/health", async (_req, res) => {
    try {
      const stats = await SignalRGateway.getConnectionStats();
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(), 
        signalR: {
          connections: stats.total,
          serverless: stats.serverless || false
        }
      });
    } catch (error) {
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
