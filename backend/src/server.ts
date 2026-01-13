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

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
});

export default app;
