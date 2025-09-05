// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import cookieParser from "cookie-parser";
import authRouter from "./routers/auth.router";
import casesRouter from "./routers/cases.router";
import { errorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Error handler (must be last)
app.use(errorHandler);

// Only listen when not in test mode / serverless
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
