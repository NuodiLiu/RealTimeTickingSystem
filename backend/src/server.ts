// File: src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Make Express trust proxies
app.set('trust proxy', 1);

// Parse request body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.text({ type: 'application/xml' }));

// Security middleware
app.use(helmet());

// CORS settings
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  }),
);

// health check api
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// example api to get users from database
app.get('/api/v2/users', async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany();
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// handle all known error and avoid 500 error
app.use(errorHandler);

// Only listen on the port in non-test environments
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.AWS_LAMBDA_FUNCTION_NAME === undefined
) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export { app };