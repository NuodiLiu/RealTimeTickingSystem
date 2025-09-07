// tests/auth.refresh.test.ts
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

// === 如果你使用路径别名 "@/..."，确保在 jest.config 里配了 moduleNameMapper ===
import { AuthController } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';

// ---- mock prisma（供 AuthService 使用）----
const findFirst = jest.fn();
const update = jest.fn();
const updateMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    session: {
      findFirst: (...args: any[]) => findFirst(...args),
      update: (...args: any[]) => update(...args),
      updateMany: (...args: any[]) => updateMany(...args),
    },
  },
}));

// ---- mock jsonwebtoken（供 AuthService 使用）----
const sign = jest.fn();
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { sign: (...args: any[]) => sign(...args) },
  sign: (...args: any[]) => sign(...args),
}));

// ---- 简易错误处理中间件（捕获 AuthController.refresh 里 throw 的错误）----
function testErrorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err?.message ?? 'Internal Error';
  res.status(status).json({ error: message });
}

// ---- 创建仅含 /auth/refresh 的最小应用 ----
function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.post('/auth/refresh', AuthController.refresh);
  app.use(testErrorHandler);
  return app;
}

describe('AuthController /auth/refresh', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // 恢复被 spyOn 的实现
  });

  it('缺少 refresh_token cookie → 401', async () => {
    const app = makeApp();
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(String(res.body?.error || res.text)).toMatch(/Missing refresh token/i);
  });

  it('无效或过期 → 401', async () => {
    const app = makeApp();
    // 用 spy 覆盖 AuthService.refreshSession 的实现（不需要 mock 整个模块）
    const spy = jest.spyOn(AuthService, 'refreshSession').mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=bad-token']);

    expect(spy).toHaveBeenCalledWith('bad-token');
    expect(res.status).toBe(401);
    expect(String(res.body?.error || res.text)).toMatch(/Invalid or expired refresh token/i);
  });

  it('有效 → 200 & 返回 accessToken', async () => {
    const app = makeApp();
    const spy = jest.spyOn(AuthService, 'refreshSession').mockResolvedValueOnce({
      accessToken: 'ACCESS_123',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=good-token']);

    expect(spy).toHaveBeenCalledWith('good-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: 'ACCESS_123' });
  });
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('refreshSession', () => {
    it('未找到会话 → 返回 null', async () => {
      findFirst.mockResolvedValueOnce(null);

      const out = await AuthService.refreshSession('BAD_TOKEN');

      expect(findFirst).toHaveBeenCalledTimes(1);
      const expectedHash = crypto.createHash('sha256').update('BAD_TOKEN').digest('hex');
      const whereArg = findFirst.mock.calls[0][0].where;
      expect(whereArg.refreshHash).toBe(expectedHash);

      expect(out).toBeNull();
      expect(update).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
    });

    it('找到有效会话 → 更新 lastUsedAt 并签发 accessToken', async () => {
      const session = {
        id: 's1',
        staffId: 'user-1',
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: null,
        refreshHash: 'hash',
        lastUsedAt: new Date(),
      };
      findFirst.mockResolvedValueOnce(session);
      update.mockResolvedValueOnce({ ...session, lastUsedAt: new Date() });
      sign.mockReturnValueOnce('JWT_ACCESS_15M');

      const out = await AuthService.refreshSession('GOOD_TOKEN');

      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { lastUsedAt: expect.any(Date) },
      });
      expect(sign).toHaveBeenCalledWith(
        { sub: 'user-1', role: 'STAFF' },
        'test-secret',
        { expiresIn: '15m' }
      );
      expect(out).toEqual({ accessToken: 'JWT_ACCESS_15M' });
    });
  });

  describe('revokeSessionByRefresh', () => {
    it('按 refreshToken 撤销 → 返回撤销数量', async () => {
      updateMany.mockResolvedValueOnce({ count: 2 });

      const count = await AuthService.revokeSessionByRefresh('TOK');

      const expectedHash = crypto.createHash('sha256').update('TOK').digest('hex');
      const whereArg = updateMany.mock.calls[0][0].where;
      expect(whereArg.refreshHash).toBe(expectedHash);

      expect(count).toBe(2);
    });
  });

  describe('revokeAllSessionsForUser', () => {
    it('按用户撤销所有会话 → 返回撤销数量', async () => {
      updateMany.mockResolvedValueOnce({ count: 5 });

      const count = await AuthService.revokeAllSessionsForUser('user-xyz');

      expect(updateMany).toHaveBeenCalledWith({
        where: { staffId: 'user-xyz', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(count).toBe(5);
    });
  });
});
