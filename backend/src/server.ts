// src/server.ts - Development server using the same Express app as Azure Functions
import dotenv from "dotenv";
import { createExpressApp } from "./expressApp";

dotenv.config();

const app = createExpressApp();
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`🚀 Development server is running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📖 API docs: http://localhost:${port}/api-docs`);
  }
  console.log(`🔧 This server uses the same Express app as Azure Functions`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default app;
