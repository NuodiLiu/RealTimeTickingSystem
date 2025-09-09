// src/middlewares/azure-auth.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { AuthError, BadRequestError } from "../error";

/** 仅校验是否已登录（存在 session.user） */
export function requireLogin(req: Request, _res: Response, next: NextFunction) {
  const logged = (req.session as any)?.user;
  if (!logged) throw new AuthError("Unauthorized", 401);
  next();
}

/** （可选）租户白名单：将来切 UNSW 打开即可拦截非 UNSW 账号 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const u = (req.session as any)?.user;
  if (!u) throw new AuthError("Unauthorized", 401);
  const expected = process.env.AZURE_AD_TENANT_ID;
  if (expected && expected !== "common" && u.tid !== expected) {
    throw new AuthError("Forbidden (wrong tenant)", 403);
  }
  next();
}

/**
 * 把 SSO 会话映射成你系统里的 staff，回填到 req.user
 * - 用 iss|sub 作为 identityKey（全局唯一）
 * - 首登时自动创建 staff（可按需填默认字段）
 */
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

export async function attachReqUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const su = (req.session as any)?.user;
    if (!su) return next(new AuthError("Unauthorized", 401));

    // 1) 会话级缓存：有 staff 信息且在 TTL 内，直接用
    const cachedAt: number | undefined = (su as any)._staffCachedAt;
    if (su.staffId && su.role && su.employeeNo && cachedAt && Date.now() - cachedAt < STAFF_CACHE_TTL_MS) {
      req.user = { id: su.staffId, role: su.role, employeeNo: su.employeeNo };
      return next();
    }

    // 2) 从 SSO claims 取标识
    const identityKey: string | undefined = su.identityKey; // `${iss}|${sub}`
    if (!identityKey) return next(new AuthError("Unauthorized", 401));

    const upn: string | null = su.upn ?? null;
    const displayName: string | null = su.name ?? null;

    if (!upn) {
      throw new BadRequestError("UPN (email) is missing from Azure token");
    }

    // 3) 并发安全的一次性 UPSERT（基于 identityKey 唯一）
    const staff = await prisma.staff.upsert({
      where: { identityKey },
      create: {
        identityKey,
        name: displayName ?? "New User",
        email: upn,
        // employeeNo 使用随机占位，避免唯一冲突；之后允许后台/管理员修改
        employeeNo: `ext-${(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)}`,
        role: "STAFF",
        password: "", // 不再使用本地密码
      },
      // 已存在时仅在有变化时“轻量更新”
      update: {
        ...(displayName ? { name: displayName } : {}),
        ...(upn ? { email: upn } : {}),
      },
      select: { id: true, role: true, employeeNo: true },
    });

    // 4) 回填 req.user + 会话缓存，后续请求可跳查库
    (req.session as any).user.staffId = staff.id;
    (req.session as any).user.role = staff.role;                 // "STAFF" | "ADMIN"
    (req.session as any).user.employeeNo = staff.employeeNo;
    (req.session as any).user._staffCachedAt = Date.now();

    req.user = { id: staff.id, role: staff.role as any, employeeNo: staff.employeeNo };

    next();
  } catch (err) {
    next(err);
  }
}


export const requireAuth: RequestHandler[] = [
  requireLogin,     // 已通过 Azure 登录（cookie-session 里有 user）
  requireTenant,    // 【可选】限制到某个租户（AZURE_AD_TENANT_ID !== 'common' 时才生效）
  attachReqUser,    // 映射/创建本地 Staff，并填充 req.user
];

export const requireAuthAnyTenant: RequestHandler[] = [
  requireLogin,
  attachReqUser,
];