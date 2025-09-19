// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import http from "http";
import cookieSession from "cookie-session";
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

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxies 
app.set("trust proxy", 1);
app.use(cookieSession({
  name: "sid",
  keys: (process.env.SESSION_KEYS || "").split(","),
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
}));

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);

// API Documentation (Swagger UI)
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerDocument = YAML.load('./docs/api.yaml');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "Real-Time Ticketing System API"
    }));
    console.log('API documentation available at: http://localhost:3000/api-docs');
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

// Only listen when not in test mode / serverless
// For serverless deployments (AWS Lambda, Vercel, etc.), export the app without listening
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !process.env.VERCEL &&
  !process.env.NETLIFY
) {
  const server = http.createServer(app);
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`HTTP listening on http://0.0.0.0:${PORT}`);
    console.log(`SignalR enabled for real-time communication`);
  });
}

export default app;
