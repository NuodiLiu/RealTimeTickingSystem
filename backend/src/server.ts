// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import http from "http";

import authRouter from "./routers/auth.router";
import casesRouter from "./routers/cases.router";
import pairRouter from "./routers/pair.router";
import { errorHandler } from "./middlewares/error.middleware";

import { DeviceGateway } from "./websocket/deviceSocket";
import { bindRealtime } from "./websocket";
import deviceRouter from "./routers/device.router";

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
app.use("/devices", deviceRouter);

// Error handler (must be last)
app.use(errorHandler);

// Socket.IO init and bind
const io = DeviceGateway.init(server);
bindRealtime(io);

// /health 基于 room 统计在线设备（房间名形如 device:{deviceId}）
app.get("/health", (_req, res) => {
  const rooms = DeviceGateway.io().of("/").adapter.rooms; // Map<string, Set<SocketId>>
  const onlineDeviceIds: string[] = [];

  for (const [name, sockets] of rooms) {
    // Socket.IO 也会为每个 socketId 建一个同名 room；我们只取自定义的 device:{id}
    if (name.startsWith("device:") && sockets && sockets.size > 0) {
      onlineDeviceIds.push(name.slice("device:".length));
    }
  }

  res.json({ status: "ok", timestamp: new Date().toISOString(), connectedDevices: onlineDeviceIds.length, onlineDeviceIds});
});

// Only listen when not in test mode / serverless
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
) {
  server.listen(PORT, () => {
    console.log(`HTTP listening on http://localhost:${PORT}`);
    console.log(`WebSocket (Socket.IO) path: ws://localhost:${PORT}/ws`);
  });
}

export default app;
