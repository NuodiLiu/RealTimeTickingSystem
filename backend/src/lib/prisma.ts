// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';


// import { PrismaClient } from '../../generated/prisma';
const prisma = new PrismaClient();

export { prisma };