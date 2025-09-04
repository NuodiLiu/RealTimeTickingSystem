// src/services/auth.service.ts
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import jwt from "jsonwebtoken";
import { Response, Request } from "express";

export class AuthService {
    static async createInvite(userId: string) {
        const token = crypto.randomUUID();
        const hash = crypto.createHash("sha256").update(token).digest("hex");

        const invite = await prisma.invite.create({
            data: {
                tokenHash: hash,
                createdById: userId,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });

        return { token, invite };
    }

    static async useInvite(token: string) {
        const hash = crypto.createHash("sha256").update(token).digest("hex");

        const invite = await prisma.invite.findFirst({
            where: {
                tokenHash: hash,
                expiresAt: { gt: new Date() }, // only allow invitation that greater than current date
                usedAt: null,
            },
        });

        if (!invite) return null;

        await prisma.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
        });

        return invite;
    }

    static async createSession(staffId: string, req: Request, res: Response) {
        const refreshToken = crypto.randomBytes(32).toString("hex");
        const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await prisma.session.create({
        data: {
            staffId,
            refreshHash: hash,
            ua: req.headers["user-agent"] || "",
            ip: req.ip,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        });

        // create access token
        const accessToken = jwt.sign(
            { sub: staffId, role: "STAFF" },
            process.env.JWT_SECRET!,
            { expiresIn: "15m" }
        );

        // write refresh token to cookie
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return { accessToken, sessionId: session.id, expiresAt: session.expiresAt };
    }

    static async refreshSession(refreshToken: string) {
        const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await prisma.session.findFirst({
            where: {
                refreshHash: hash,
                expiresAt: { gt: new Date() },
                revokedAt: null,
            },
        });

        if (!session) return null;

        // update lastUsedAt
        await prisma.session.update({
            where: { id: session.id },
            data: { lastUsedAt: new Date() },
        });

        // generate access token
        const accessToken = jwt.sign(
            { sub: session.staffId, role: "STAFF" },
            process.env.JWT_SECRET!,
            { expiresIn: "15m" }
        );

        return { accessToken };
    }

    static async revokeSessionByRefresh(refreshToken: string) {
        const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const updated = await prisma.session.updateMany({
            where: { refreshHash: hash, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        return updated.count; // 0 or >=1
    }

    static async revokeAllSessionsForUser(staffId: string) {
        const updated = await prisma.session.updateMany({
            where: { staffId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return updated.count;
    }
}