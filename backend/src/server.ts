// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import cookieParser from "cookie-parser";
import authRouter from "./routers/auth.router";
import casesRouter from "./routers/cases.router";
import pairRouter from "./routers/pair.router";
import { errorHandler } from "./middlewares/error.middleware";
import http from 'http';
import { setupDeviceWebSocket } from "./websocket/deviceSocket";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Trust proxies (e.g. for secure cookies behind reverse proxy)
app.set("trust proxy", 1);

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
// Error handler (must be last)
app.use(errorHandler);

const deviceSocket = setupDeviceWebSocket(server);
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    connectedDevices: deviceSocket.getOnlineDeviceCount(),
    onlineDeviceIds: deviceSocket.getOnlineDeviceIds()
  });
});


// Only listen when not in test mode / serverless
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
) {
  // app.listen(PORT, () => {
  //   console.log(`Server listening on http://localhost:${PORT}`);
  // });
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/device/{deviceId}`);
  });
}

export default app;
export { deviceSocket };
