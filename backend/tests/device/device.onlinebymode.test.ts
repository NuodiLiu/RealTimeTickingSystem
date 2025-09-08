// tests/device/device.online-by-mode.test.ts
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

// 缺省放行 staff
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

describe('GET /device/online/:mode', () => {
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
  const mk = (d: number) => new Date(now + d);

  it('200 | returns only ONLINE devices for given mode', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'dev-1',
        name: 'Pad-1',
        mode: 'DUAL',
        lastSeenAt: mk(-20_000), // 在线
        currentLock: null, // => IDLE
      },
      {
        id: 'dev-2',
        name: 'Pad-2',
        mode: 'DUAL',
        lastSeenAt: mk(-3 * 60_000 - 1000), // 离线
        currentLock: null,
      },
      {
        id: 'dev-3',
        name: 'Pad-3',
        mode: 'DUAL',
        lastSeenAt: mk(-10_000), // 在线
        currentLock: {
          id: 'lock-3',
          status: 'ACTIVE',
          case: { id: 'case-3', studentName: 'Alice', category: 'TECH', status: 'IN_PROGRESS' },
          staff: { name: 'Bob' },
          leaseExpireAt: mk(60_000),
        },
      },
    ]);

    const res = await request(app).get('/device/online/DUAL');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('DUAL');
    expect(res.body.count).toBe(2);
    expect(Array.isArray(res.body.devices)).toBe(true);

    // dev-1: ONLINE + IDLE
    const d1 = res.body.devices.find((d: any) => d.deviceId === 'dev-1');
    expect(d1).toMatchObject({
      deviceId: 'dev-1',
      name: 'Pad-1',
      mode: 'DUAL',
      isOnline: true,
      status: 'IDLE',
      currentLock: null,
    });

    // dev-3: ONLINE + BUSY
    const d3 = res.body.devices.find((d: any) => d.deviceId === 'dev-3');
    expect(d3).toMatchObject({
      deviceId: 'dev-3',
      name: 'Pad-3',
      mode: 'DUAL',
      isOnline: true,
      status: 'BUSY',
      currentLock: {
        id: 'lock-3',
        status: 'ACTIVE',
        case: {
          id: 'case-3',
          studentName: 'Alice',
          category: 'TECH',
          status: 'IN_PROGRESS',
        },
        staffName: 'Bob',
      },
    });

    // 离线设备不在结果里
    const ids = res.body.devices.map((d: any) => d.deviceId);
    expect(ids).not.toContain('dev-2');
  });

  it('400 | invalid mode rejected', async () => {
    const res = await request(app).get('/device/online/INVALID');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid device mode' });
  });

  it('401 | requireStaff denies access', async () => {
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

      (global as any).__APP__ONLINE__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__ONLINE__;
    const res = await request(freshApp).get('/device/online/DUAL');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });
});
