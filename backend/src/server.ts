// src/server.ts - Simplified server for App Service Container
import dotenv from "dotenv";
import { createExpressApp } from "./expressApp";
import { HeartbeatService } from "./services/heartbeat.service";

dotenv.config();

console.log(`🚀 Starting server...`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);

const app = createExpressApp();
const port = parseInt(process.env.PORT || '3000', 10);

// Listen on 0.0.0.0 for container environments (required by Azure App Service)
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
  console.log(`💓 Heartbeat mode: iPad active reporting via HTTP API`);
  console.log(`📡 Real-time push: SignalR for task assignments`);
});

// Graceful shutdown
function gracefulShutdown() {
  console.log('Shutting down...');
  HeartbeatService.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
