// src/server.ts - Development/Production server with HTTPS support
import dotenv from "dotenv";
import { startServer } from "./https-server";

dotenv.config();

console.log(`🚀 Starting server...`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);

const serverConfig = startServer();

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  
  const shutdownPromises = [];
  
  if (serverConfig.httpsServer) {
    shutdownPromises.push(new Promise((resolve) => {
      serverConfig.httpsServer!.close(() => {
        console.log('HTTPS server closed.');
        resolve(void 0);
      });
    }));
  }
  
  if (serverConfig.httpServer) {
    shutdownPromises.push(new Promise((resolve) => {
      serverConfig.httpServer!.close(() => {
        console.log('HTTP server closed.');
        resolve(void 0);
      });
    }));
  }
  
  await Promise.all(shutdownPromises);
  
  // Disconnect Prisma
  console.log('Disconnecting Prisma...');
  const { prisma } = await import('./lib/prisma');
  await prisma.$disconnect();
  
  console.log('All connections closed. Exiting...');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default serverConfig.app;
