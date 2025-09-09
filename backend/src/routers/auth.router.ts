// src/routers/auth.router.ts
import { Router } from "express";
import crypto from "crypto";
import { msalClient, authParams } from "../auth/azure";
import { AuthError, BadRequestError } from "../error"; // <- 用你的错误类
import { prisma } from "../lib/prisma";

const router = Router();

if (process.env.NODE_ENV === 'development') {
  router.post('/dev-login', async (req, res) => {
    try {
      // Create or find the dev staff member
      const devStaff = await prisma.staff.upsert({
        where: { identityKey: 'dev|user' },
        update: {},
        create: {
          identityKey: 'dev|user',
          employeeNo: 'DEV001',
          name: 'Dev User',
          email: 'dev@test.local',
          password: '',
          role: 'ADMIN'
        }
      });

      (req.session as any).user = {
        identityKey: 'dev|user',
        tid: 'dev-tenant',
        upn: 'dev@test.local',
        name: 'Dev User',
        staffId: devStaff.id, // Use the actual database ID
        role: 'ADMIN',
        employeeNo: 'DEV001',
        _staffCachedAt: Date.now()
      };
      console.log('Dev login - session set:', (req.session as any).user); // Add this line


      res.json({ ok: true, user: (req.session as any).user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create dev user' });
    }
  });
}

if (process.env.NODE_ENV === "test") {
  router.post("/__test/mock-login", (req, res) => {
    const body = req.body || {};
    (req.session as any).user = {
      identityKey: body.identityKey || "iss|sub",
      tid: body.tid || process.env.AZURE_AD_TENANT_ID || "common",
      upn: body.upn || "sam@test.local",
      name: body.name || "Sam Staff",
    };
    res.json({ ok: true });
  });

  router.post("/__test/clear", (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });
}

// GET /auth/login -> 重定向微软登录页
router.get("/login", async (req, res, next) => {
  try {
    if ((req.session as any)?.user) {
      return res.status(204).end(); // 已登录：不算错误，直接 204/或重定向前端
    }

    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    (req.session as any).oauth_state = state;
    (req.session as any).oauth_nonce = nonce;

    const url = await msalClient.getAuthCodeUrl({
      scopes: authParams.scopes,
      redirectUri: authParams.redirectUri,
      state,
      nonce,
      responseMode: "query",
    });
    res.redirect(url);
  } catch (e) { next(e); }
});

// GET /auth/redirect -> 用授权码换 token, 保存 session
router.get("/redirect", async (req, res, next) => {
  try {
    // Azure 回传错误时，交给 errorHandler
    if (req.query.error) {
      const err = String(req.query.error);
      const desc = String(req.query.error_description || "");
      // 用户点取消多数是 access_denied，更贴近鉴权错误 → 401
      if (err === "access_denied") {
        return next(new AuthError(desc || "Access denied", 401));
      }
      // 其它统一当作 400
      return next(new BadRequestError(desc ? `${err}: ${desc}` : err));
    }

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || state !== (req.session as any).oauth_state) {
      return next(new BadRequestError("Invalid state or code"));
    }

    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: authParams.scopes,
      redirectUri: authParams.redirectUri,
    });

    const claims: any = tokenResponse?.idTokenClaims || {};

    // 可选 nonce 二次校验（更显式）
    const expectedNonce = (req.session as any).oauth_nonce;
    if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) {
      return next(new BadRequestError("Invalid nonce"));
    }

    (req.session as any).user = {
      identityKey: `${claims.iss}|${claims.sub}`,
      tid: claims.tid ?? null,
      oid: claims.oid ?? null,
      upn: claims.preferred_username || claims.upn || claims.email || null,
      name: claims.name || null,
      // attachReqUser 之后会把 staffId/role/employeeNo 写回 session.user
    };

    // 清理一次性字段
    (req.session as any).oauth_state = undefined;
    (req.session as any).oauth_nonce = undefined;

    res.redirect(process.env.FRONTEND_URL || "/");
  } catch (e: any) {
    // MSAL 抛出的错误（如 AADSTS50011 等）更贴近鉴权失败
    if (e && (e.errorMessage || e.message)) {
      return next(new AuthError(e.errorMessage || e.message, 401));
    }
    next(e);
  }
});

// POST /auth/logout -> 本地登出 + 可选全局登出
router.post("/logout", (req, res) => {
  const global = String(req.query.global || "").toLowerCase() === "true";
  req.session = null; // cookie-session 置空

  if (global) {
    const tenant = process.env.AZURE_AD_TENANT_ID || "common";
    const postLogout = encodeURIComponent(
      process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:3000"
    );
    return res.redirect(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogout}`
    );
  }
  res.json({ ok: true });
});

// GET /auth/me -> 返回当前用户（SSO claims）
router.get("/me", (req, res) => {
  res.json({ user: (req.session as any).user ?? null });
});

export default router;
