// tests/auth.logout.test.ts
import type { MockedFunction } from 'jest-mock';
const mf = <T extends (...args: any[]) => any>(fn: T) =>
  fn as unknown as MockedFunction<T>;

// --- 先 mock 依赖 ---
jest.mock('../../src/lib/prisma', () => ({
  prisma: {}, // 这个文件不直接用到 prisma；空对象避免其它路由初始化时报错
}));

// 服务器在挂载其它路由时会用到这些中间件；统一 mock 掉防止 “argument handler must be a function”
jest.mock('../../src/middlewares/auth.middleware', () => {
  const injectUser = (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'ADMIN', employeeNo: '123456' };
    next();
  };
  const injectDevice = async (req: any, _res: any, next: any) => {
    req.device = { deviceId: 'dev-1', device: { id: 'dev-1', name: 'mock device' } };
    next();
  };
  return {
    requireAuth: injectUser,
    requireStaff: injectUser,
    requireAdmin: injectUser,
    requireDevice: injectDevice,
  };
});

jest.mock('../../src/services/auth.service', () => ({
  AuthService: {
    revokeSessionByRefresh: jest.fn().mockResolvedValue(1),
    revokeAllSessionsForUser: jest.fn().mockResolvedValue(1),
  },
}));

// --- 再导入 app / 依赖 ---
import request from 'supertest';
import express from 'express';
import app from '../../src/server';
import { AuthService } from '../../src/services/auth.service';
import { AuthController } from '../../src/controllers/auth.controller';

describe('POST /auth/logout', () => {
  const ORIGINAL_ENV = process.env;
  const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeAll(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    spyErr.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('401 when missing refresh_token and not logoutAll', async () => {
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(401);
    // 不应调用任何 revoke
    expect(AuthService.revokeSessionByRefresh).not.toHaveBeenCalled();
    expect(AuthService.revokeAllSessionsForUser).not.toHaveBeenCalled();
  });

  it('200 normal logout: revokes by refresh and clears cookie', async () => {
    mf(AuthService.revokeSessionByRefresh).mockResolvedValue(1);

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', ['refresh_token=abc123; Path=/'])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // 调用了按 refresh 撤销
    expect(AuthService.revokeSessionByRefresh).toHaveBeenCalledTimes(1);
    expect(AuthService.revokeSessionByRefresh).toHaveBeenCalledWith('abc123');
    expect(AuthService.revokeAllSessionsForUser).not.toHaveBeenCalled();

    // 检查清 cookie 头
    const setCookieHeader = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');
    expect(cookieStr).toMatch(/refresh_token=/);
    expect(cookieStr).toMatch(/Expires=|Max-Age=0/i); // 过期或 Max-Age=0
    expect(cookieStr).toMatch(/SameSite=Lax/i);       // 你的 clearCookie 传了 sameSite: 'lax'
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it('401 when logoutAll=true but no req.user', async () => {
    // 用主 app：该路由没有注入 req.user，因此会 401
    const res = await request(app).post('/auth/logout?all=true').send({});
    expect(res.status).toBe(401);
    expect(AuthService.revokeAllSessionsForUser).not.toHaveBeenCalled();
  });

  it('200 logoutAll=true with injected user: revokes all and clears cookie', async () => {
    // 用一个“迷你” app，在路由前手动注入 req.user，专测 all=true 分支
    const mini = express();
    mini.use(express.json());
    mini.post(
      '/auth/logout',
      (req, _res, next) => {
        req.user = { id: 'user-999', role: 'ADMIN', employeeNo: '654321' };
        next();
      },
      AuthController.logout
    );

    mf(AuthService.revokeAllSessionsForUser).mockResolvedValue(5);

    const res = await request(mini).post('/auth/logout?all=true').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    expect(AuthService.revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
    expect(AuthService.revokeAllSessionsForUser).toHaveBeenCalledWith('user-999');

    // 也应清 cookie（即便没有传入 refresh_token）
    const setCookieHeader = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');
    expect(cookieStr).toMatch(/refresh_token=/);
    expect(cookieStr).toMatch(/Expires=|Max-Age=0/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });
});
