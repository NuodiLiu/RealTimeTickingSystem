// Temporary test server without SignalR to check if that's causing the issue
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import http from "http";
import cookieSession from "cookie-session";

import authRouter from "./routers/auth.router";
import casesRouter from "./routers/cases.router";
import pairRouter from "./routers/pair.router";
import deviceRouter from "./routers/device.router";
import feedbackRouter from "./routers/feedback.router";
import excelRouter from "./routers/excel.router";
import { errorHandler } from "./middlewares/error.middleware";

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

// Routers
app.use("/auth", authRouter);
app.use("/cases", casesRouter);
app.use("/pair", pairRouter);
app.use("/device", deviceRouter);
app.use("/feedback", feedbackRouter);
app.use("/excel", excelRouter);

// Error handler 
app.use(errorHandler);

// Simple health endpoint
app.get("/health", async (_req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(), 
    message: "Test server without SignalR"
  });
});

// Only listen when not in test mode / serverless
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !process.env.VERCEL &&
  !process.env.NETLIFY
) {
  const server = http.createServer(app);
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`HTTP listening on http://0.0.0.0:${PORT}`);
    console.log(`Test server started successfully`);
  });
}

export default app;
