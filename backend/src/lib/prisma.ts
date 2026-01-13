// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Prisma Client with connection pooling and error handling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// // Handle Prisma connection errors
// prisma.$connect()
//   .then(() => {
//     console.log('✅ Database connected successfully');
//   })
//   .catch((error) => {
//     console.error('❌ Database connection failed:', error);
//     process.exit(1);
//   });

export { prisma };