// src/server.ts - Simplified server for App Service Container
import dotenv from "dotenv";
import { createExpressApp } from "./expressApp";

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
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  
  server.close(async () => {
    console.log('Server closed.');
    
    // Disconnect Prisma
    console.log('Disconnecting Prisma...');
    const { prisma } = await import('./lib/prisma');
    await prisma.$disconnect();
    
    console.log('All connections closed. Exiting...');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
