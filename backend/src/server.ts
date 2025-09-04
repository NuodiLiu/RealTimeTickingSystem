// File: src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { errorHandler } from './middlewares/error.middleware';

import http from 'http';
import crypto from 'crypto';
import * as QRCode from 'qrcode'; 

import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { MissingFieldError, NotFoundError, BadRequestError, AuthError } from "./error";


function signStaffJwt(payload: { id: string; name?: string; email?: string }) {
    return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });
  }

function verifyStaffJwt(token: string) {
return jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; name?: string; email?: string };
}

declare global {
    namespace Express {
      interface User {
        id: string;
        name?: string;
        email?: string;
      }
      interface Request {
        user?: User;
      }
    }
  }

// middleware
function requireStaff(req: any, res: any, next: any) {
    try {
        const cookieToken = req.cookies?.auth as string | undefined;
        const authHeader = req.header("Authorization") || "";
        const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
        const token = cookieToken || bearer;
        if (!token) return res.status(401).json({ error: "Not authenticated" });

        const decoded = verifyStaffJwt(token);
        req.user = { id: decoded.id, name: decoded.name, email: decoded.email };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid/expired session" });
    }
}




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



// // example api to get users from database
// app.get('/api/v2/users', async (req: any, res: any) => {
//   try {
//     const users = await prisma.user.findMany();
//     return res.status(200).json(users);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: 'Internal server error.' });
//   }
// });



// Only listen on the port in non-test environments
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.AWS_LAMBDA_FUNCTION_NAME === undefined
) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

 
// student registration 
// student name, cateogry, creates a case 
app.post('/cases', async (req: any, res: any, next) => {
  try {
    const { studentName, category } = req.body ?? {};
    if (!studentName || !category) {
      throw new MissingFieldError(["studentName", "category"]);
    }

    const created = await prisma.studentCase.create({
      data: {studentName, category},
    })

     res.status(201).json(created);
  } catch (err) {
      next(err); // send to errorHandler
  }
})


// staff manage queue, get from portal to update queue, socket 
app.get('/cases', requireStaff, async (req, res, next) => {
    try {
        const map: Record<string, 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED'> = {
            queued: 'QUEUED', 
            in_progress: 'IN_PROGRESS', 
            resolved: 'RESOLVED',
        };

        const statusKey = String(req.query.status ?? 'queued').toLowerCase();
        const status = map[statusKey] ?? 'QUEUED';

        const rows = await prisma.studentCase.findMany({
            where: { status },
            orderBy: { createdAt: "asc" },
        });
        res.status(200).json(rows);
    } catch(err) {
        next(err);
    }
})


// staff take case, change case status 
app.post('/cases/:id/take', async (req: any, res: any, next) => {
    try {
      const id = req.params.id;
      const staffId = req.user.id;
      
      const result = await prisma.studentCase.updateMany({
        where: { id, status: 'QUEUED'}, 
        data: { status: 'IN_PROGRESS', staffId},
      });

      if (result.count == 0) {
        throw new BadRequestError("Case already taken or not in queue");
      }

      const taken = await prisma.studentCase.findUnique({ where: { id } });
      if (!taken) {
        throw new NotFoundError('Case not found');
        // res.status(200).json(taken);
      }
    } catch (err) {
        next(err);
    }
  })

// staff resolve case, triggers feedback 
app.post('/cases/:id/resolve', async (req: any, res: any, next) => {
    try {
      const id = req.params.id;
      const update = await prisma.studentCase.update({
        where: {id}, 
        data: {status: 'RESOLVED', resolvedAt: new Date()},
      });

      res.status(200).json(update);
      
    } catch (err: any) {
        if (err?.code == 'P2025') {
            return next (new NotFoundError('Case not found'));
        }
        next(err);
    }
  })

// staff request feedback 
app.post('/feedback-tokens', requireStaff, async (req: any, res: any, next) => {
    try {
      const {caseId, ttlMinutes} = req.body ?? {};
      if (!caseId) throw new MissingFieldError(["caseId"]);


      const exists = await prisma.studentCase.findUnique({where: {id: caseId} });
      if (!exists) throw new NotFoundError("Case not found");

      const token = genToken();
      const shortCode = genShortCode();
      const expireAt = nowPlus(Number.isInteger(ttlMinutes) ? ttlMinutes : 60);

      const created = await prisma.feedbackToken.create({
        data: { token, shortCode, caseId, staffId: req.user!.id, expireAt },
      });
  
      const base = process.env.FRONTEND_URL || process.env.PUBLIC_WEB_URL || "http://localhost:3001";
      const url = `${base}/kiosk/feedback?token=${created.token}`;
      const qrUrl = await QRCode.toDataURL(url);

      res.status(201).json({
        token: created.token, 
        shortCode: created.shortCode, 
        expireAt: created.expireAt,
        url, 
        qrUrl,
      });
      
    } catch (err) {
        next(err);
    }
  })


// token validation 
app.get('/feedback-tokens/:token', async (req, res, next) => {
    try {
        const ft = await prisma.feedbackToken.findUnique({
            where: {token: req.params.token},
            include: {case: true, staff: {select: { id: true, name: true }}},
        });

        if (!ft || ft.used || ft.expireAt < new Date()) {
            return res.status(410).json({ valid: false });
        }

        res.status(200).json({
            valid: true,
            caseId: ft.caseId,
            staff: ft.staff,
            studentName: ft.case.studentName,
            category: ft.case.category,
        });
    } catch(err) {
        next(err);
    }
})

// token submission adds student feedback
// app.post
app.post('/feedback', async (req, res, next) => {
    try {
      const { tokenOrCode, rating, comment } = req.body ?? {};
      if (!tokenOrCode || !Number.isInteger(rating)) {
        throw new MissingFieldError(['tokenOrCode', 'rating']);
      }
      if (rating < 1 || rating > 5) {
        throw new BadRequestError('rating must be between 1 and 5');
      }
  
      const ft = await prisma.feedbackToken.findFirst({
        where: {
          AND: [
            { used: false },
            { expireAt: { gt: new Date() } },
            { OR: [{ token: tokenOrCode }, { shortCode: tokenOrCode }] },
          ],
        },
      });
      if (!ft) {
        throw new NotFoundError("Feedback token invalid or expired");
      }
  
      const fb = await prisma.feedback.create({
        data: { caseId: ft.caseId, staffId: ft.staffId, rating, comment },
      });
      await prisma.feedbackToken.update({
        where: { token: ft.token },
        data: { used: true },
      });
  
      res.status(201).json(fb);
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);

export { app };