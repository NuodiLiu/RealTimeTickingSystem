// File: src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { errorHandler } from './middlewares/error.middleware';

import http from 'http';
import crypto from 'crypto';
// import * as QRCode from 'qrcode'; 

import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { MissingFieldError, NotFoundError, BadRequestError, AuthError } from "./error";

import authRouter from './routers/auth.router';
import casesRouter from './routers/cases.router'



const nowPlus = (mins: number) => new Date(Date.now() + mins * 60_000);
const genToken = () => crypto.randomBytes(24).toString("base64url");
const genShortCode = () => Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Make Express trust proxies
app.set('trust proxy', 1);

// Parse request body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.text({ type: 'application/xml' }));

app.use('/cases', casesRouter);

app.use(cookieParser());

// Security middleware
app.use(helmet());

// CORS settings
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  })
);


// Only listen on the port in non-test environments
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.AWS_LAMBDA_FUNCTION_NAME === undefined
) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}