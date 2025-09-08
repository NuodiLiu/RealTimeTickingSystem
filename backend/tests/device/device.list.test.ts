// tests/device/device.list.test.ts
import express from 'express';
import request from 'supertest';
import http from 'http';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    kioskDevice: {
      findMany: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

// 缺省：staff 已登录（放行）。特定用例再 isolateModules 覆盖成拒绝。
jest.mock('../../src/middlewares/auth.middleware', () => ({
  __esModule: true,
  requireDevice: (_req: any, _res: any, next: any) => next(),
  requireStaff: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../src/middlewares/azure-auth.middleware', () => ({
  __esModule: true,
  // 你的 router 里可能用的是 requireAuth 或 requireLogin；全都放行以防命名差异
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireLogin: (_req: any, _res: any, next: any) => next(),
  requireTenant: (_req: any, _res: any, next: any) => next(),
  // 一些 RBAC 代码需要 req.user；这里顺手补一个管理员身份
  attachReqUser: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-admin', role: 'ADMIN', employeeNo: 'E001' };
    next();
  },
}));

import deviceRouter from '../../src/routers/device.router';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('GET /device (listDevices)', () => {
  let app: express.Express;
  let server: http.Server;
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: ORIGINAL_ENV.NODE_ENV || 'test',
      JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret',
    };

    app = express();
    app.use(express.json());
    app.use('/device', deviceRouter);
    app.use(errorHandler);

    server = app.listen();
  });

  afterAll((done) => {
    process.env = ORIGINAL_ENV;
    server && server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const now = Date.now();
  const mkDate = (deltaMs: number) => new Date(now + deltaMs);

  // 准备 4 台设备：ONLINE+BUSY, ONLINE+IDLE, OFFLINE, ONLINE+IDLE(不同mode)
  const rows = [
    {
      id: 'dev-busy',
      name: 'Kiosk-Busy',
      mode: 'DUAL',
      lastSeenAt: mkDate(-30_000), // 30s 前 => 在线
      currentLock: {
        id: 'lock-busy',
        status: 'ACTIVE',
        case: { id: 'case-busy', studentName: 'Alice', category: 'TECH', status: 'IN_PROGRESS' },
        staff: { name: 'Bob' },
        leaseExpireAt: mkDate(60_000),
      },
    },
    {
      id: 'dev-idle',
      name: 'Kiosk-Idle',
      mode: 'FEEDBACK',
      lastSeenAt: mkDate(-45_000), // 在线
      currentLock: {
        id: 'lock-idle',
        status: 'RELEASED',
        case: { id: 'case-idle', studentName: 'Cindy', category: 'ADMIN', status: 'RESOLVED' },
        staff: { name: 'Dora' },
        leaseExpireAt: mkDate(120_000),
      },
    },
    {
      id: 'dev-off',
      name: 'Kiosk-Off',
      mode: 'REGISTRATION',
      lastSeenAt: mkDate(-3 * 60_000 - 5000), // >2min => 离线
      currentLock: null,
    },
    {
      id: 'dev-idle-2',
      name: 'Kiosk-Idle-2',
      mode: 'DUAL',
      lastSeenAt: mkDate(-10_000), // 在线
      currentLock: null, // 无锁 => IDLE
    },
  ];

  it('200 | returns mapped list without filters', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(rows);

    const res = await request(app).get('/device');

    expect(res.status).toBe(200);
    // 数量匹配
    expect(res.body).toHaveLength(4);

    // BUSY 一项
    const busy = res.body.find((d: any) => d.deviceId === 'dev-busy');
    expect(busy).toMatchObject({
      deviceId: 'dev-busy',
      name: 'Kiosk-Busy',
      mode: 'DUAL',
      status: 'BUSY',
      isOnline: true,
      currentLock: {
        id: 'lock-busy',
        status: 'ACTIVE',
        case: {
          id: 'case-busy',
          studentName: 'Alice',
          category: 'TECH',
          status: 'IN_PROGRESS',
        },
        staffName: 'Bob',
      },
    });

    // IDLE 一项（有 currentLock 但非 ACTIVE）
    const idle = res.body.find((d: any) => d.deviceId === 'dev-idle');
    expect(idle).toMatchObject({
      deviceId: 'dev-idle',
      name: 'Kiosk-Idle',
      mode: 'FEEDBACK',
      status: 'IDLE',
      isOnline: true,
      currentLock: {
        id: 'lock-idle',
        status: 'RELEASED',
        case: {
          id: 'case-idle',
          studentName: 'Cindy',
          category: 'ADMIN',
          status: 'RESOLVED',
        },
        staffName: 'Dora',
      },
    });

    // OFFLINE 一项
    const off = res.body.find((d: any) => d.deviceId === 'dev-off');
    expect(off).toMatchObject({
      deviceId: 'dev-off',
      name: 'Kiosk-Off',
      mode: 'REGISTRATION',
      status: 'OFFLINE',
      isOnline: false,
      currentLock: null,
    });

    // 另一个 IDLE（无锁）
    const idle2 = res.body.find((d: any) => d.deviceId === 'dev-idle-2');
    expect(idle2).toMatchObject({
      deviceId: 'dev-idle-2',
      name: 'Kiosk-Idle-2',
      mode: 'DUAL',
      status: 'IDLE',
      isOnline: true,
      currentLock: null,
    });

    // 未传 mode 时，DB 查询不应带 where.mode
    expect(prisma.kioskDevice.findMany).toHaveBeenCalledTimes(1);
    const arg = (prisma.kioskDevice.findMany as jest.Mock).mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: null });
    expect(arg.include).toBeDefined();
    expect(arg.orderBy).toEqual({ lastSeenAt: 'desc' });
  });

  it('200 | filters by mode only (DB-side)', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(
      rows.filter((r) => r.mode === 'FEEDBACK')
    );

    const res = await request(app).get('/device').query({ mode: 'FEEDBACK' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // 返回的每一项都是 FEEDBACK
    for (const d of res.body) {
      expect(d.mode).toBe('FEEDBACK');
    }

    // 验证 DB where.mode 生效
    const call = (prisma.kioskDevice.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ mode: 'FEEDBACK', deletedAt: null });
  });

  it('200 | filters by status=ONLINE (memory-side filter)', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(rows);

    const res = await request(app).get('/device').query({ status: 'ONLINE' });

    expect(res.status).toBe(200);
    // ONLINE: dev-busy, dev-idle, dev-idle-2
    const ids = res.body.map((d: any) => d.deviceId).sort();
    expect(ids).toEqual(['dev-busy', 'dev-idle', 'dev-idle-2'].sort());
  });

  it('200 | filters by status=OFFLINE', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(rows);

    const res = await request(app).get('/device').query({ status: 'OFFLINE' });

    expect(res.status).toBe(200);
    const ids = res.body.map((d: any) => d.deviceId);
    expect(ids).toEqual(['dev-off']);
  });

  it('200 | filters by status=BUSY', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(rows);

    const res = await request(app).get('/device').query({ status: 'BUSY' });

    expect(res.status).toBe(200);
    const ids = res.body.map((d: any) => d.deviceId);
    expect(ids).toEqual(['dev-busy']);
    expect(res.body[0]).toMatchObject({ status: 'BUSY', isOnline: true });
  });

  it('200 | filters by status=IDLE', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue(rows);

    const res = await request(app).get('/device').query({ status: 'IDLE' });

    expect(res.status).toBe(200);
    const ids = res.body.map((d: any) => d.deviceId).sort();
    expect(ids).toEqual(['dev-idle', 'dev-idle-2'].sort());
    for (const d of res.body) {
      expect(d.status).toBe('IDLE');
    }
  });

  it('401 | when requireStaff denies access', async () => {
    // 使用 isolateModules 重载中间件，使 requireStaff 直接拒绝
    jest.isolateModules(() => {
      jest.resetModules();

      jest.doMock('../../src/lib/prisma', () => ({
        __esModule: true,
        prisma,
      }));

      const { AuthError } = require('../../src/error');

      jest.doMock('../../src/middlewares/auth.middleware', () => ({
        __esModule: true,
        requireDevice: (_req: any, _res: any, next: any) => next(),
        requireStaff: (_req: any, _res: any, next: any) => next(new AuthError('Unauthorized', 401)),
      }));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = require('../../src/routers/device.router').default;
      const freshError = require('../../src/middlewares/error.middleware').errorHandler;

      freshApp.use('/device', freshRouter);
      freshApp.use(freshError);

      (global as any).__APP__LIST__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__LIST__;
    const res = await request(freshApp).get('/device');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });
});
