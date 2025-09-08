// tests/device/device.by-mode.test.ts
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

// 缺省放行 staff；某用例中再重载为拒绝
jest.mock('../../src/middlewares/auth.middleware', () => ({
  __esModule: true,
  requireDevice: (_req: any, _res: any, next: any) => next(),
  requireStaff: (_req: any, _res: any, next: any) => next(),
}));

import deviceRouter from '../../src/routers/device.router';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('GET /device/by-mode/:mode', () => {
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

  it('200 | returns devices mapped for a valid mode (REGISTRATION)', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'dev-1',
        name: 'Pad-1',
        mode: 'REGISTRATION',
        lastSeenAt: mk(-20_000), // 在线
        currentLock: null, // => IDLE
      },
      {
        id: 'dev-2',
        name: 'Pad-2',
        mode: 'REGISTRATION',
        lastSeenAt: mk(-3 * 60_000 - 1000), // 离线
        currentLock: null,
      },
      {
        id: 'dev-3',
        name: 'Pad-3',
        mode: 'REGISTRATION',
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

    const res = await request(app).get('/device/by-mode/REGISTRATION');

    expect(res.status).toBe(200);
    // 顶层回传 { devices, mode }
    expect(res.body.mode).toBe('REGISTRATION');
    expect(Array.isArray(res.body.devices)).toBe(true);
    expect(res.body.devices).toHaveLength(3);

    // dev-1: ONLINE + IDLE
    const d1 = res.body.devices.find((d: any) => d.deviceId === 'dev-1');
    expect(d1).toMatchObject({
      deviceId: 'dev-1',
      name: 'Pad-1',
      mode: 'REGISTRATION',
      isOnline: true,
      status: 'IDLE',
      currentLock: null,
    });

    // dev-2: OFFLINE
    const d2 = res.body.devices.find((d: any) => d.deviceId === 'dev-2');
    expect(d2).toMatchObject({
      deviceId: 'dev-2',
      name: 'Pad-2',
      mode: 'REGISTRATION',
      isOnline: false,
      status: 'OFFLINE',
      currentLock: null,
    });

    // dev-3: ONLINE + BUSY（ACTIVE）
    const d3 = res.body.devices.find((d: any) => d.deviceId === 'dev-3');
    expect(d3).toMatchObject({
      deviceId: 'dev-3',
      name: 'Pad-3',
      mode: 'REGISTRATION',
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

    // 确认 DB 查询参数
    expect(prisma.kioskDevice.findMany).toHaveBeenCalledTimes(1);
    const arg = (prisma.kioskDevice.findMany as jest.Mock).mock.calls[0][0];
    expect(arg.where).toEqual({ mode: 'REGISTRATION', deletedAt: null });
    expect(arg.include).toBeDefined();
    expect(arg.orderBy).toEqual({ lastSeenAt: 'desc' });
  });

  it('200 | also works for FEEDBACK mode', async () => {
    (prisma.kioskDevice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'dev-f1',
        name: 'FB-1',
        mode: 'FEEDBACK',
        lastSeenAt: mk(-40_000),
        currentLock: {
          id: 'l1',
          status: 'RELEASED',
          case: { id: 'c1', studentName: 'Eve', category: 'ADMIN', status: 'RESOLVED' },
          staff: { name: 'Tom' },
          leaseExpireAt: mk(30_000),
        },
      },
    ]);

    const res = await request(app).get('/device/by-mode/FEEDBACK');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('FEEDBACK');
    expect(res.body.devices).toHaveLength(1);
    expect(res.body.devices[0]).toMatchObject({
      deviceId: 'dev-f1',
      name: 'FB-1',
      mode: 'FEEDBACK',
      isOnline: true,
      status: 'IDLE', // RELEASED => 非 BUSY
      currentLock: {
        id: 'l1',
        status: 'RELEASED',
        case: {
          id: 'c1',
          studentName: 'Eve',
          category: 'ADMIN',
          status: 'RESOLVED',
        },
        staffName: 'Tom',
      },
    });
  });

  it('400 | invalid mode returns BadRequestError', async () => {
    const res = await request(app).get('/device/by-mode/INVALID_MODE');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid device mode' });
    expect(prisma.kioskDevice.findMany).not.toHaveBeenCalled();
  });

  it('401 | requireStaff denies access', async () => {
    // 使用 isolateModules 重载 requireStaff 为直接拒绝
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

      (global as any).__APP__BYMODE__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__BYMODE__;
    const res = await request(freshApp).get('/device/by-mode/DUAL');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });
});
