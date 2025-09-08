// tests/device/device.status.test.ts
import express from 'express';
import request from 'supertest';
import http from 'http';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

// 默认 mock 掉 auth 中间件，注入 req.device（可在个别用例里覆盖）
jest.mock('../../src/middlewares/auth.middleware', () => ({
  __esModule: true,
  requireDevice: (req: any, _res: any, next: any) => {
    req.device = { deviceId: 'dev-1', device: {} };
    next();
  },
  requireStaff: (_req: any, _res: any, next: any) => next(),
}));

import deviceRouter from '../../src/routers/device.router';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('GET /device/status', () => {
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

    server = app.listen(); // supertest 可直接用 app，这里留着不影响
  });

  afterAll((done) => {
    process.env = ORIGINAL_ENV;
    server && server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('200 | ONLINE+IDLE: when device seen recently and no ACTIVE lock', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'iPad-A',
      mode: 'DUAL',
      lastSeenAt: new Date(Date.now() - 30_000), // 30s 前
      currentLock: {
        id: 'lock-1',
        status: 'RELEASED',
        case: { id: 'case-1', studentName: 'Alice', category: 'TECH', status: 'RESOLVED' },
        staff: { name: 'Bob' },
        leaseExpireAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await request(app).get('/device/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deviceId: 'dev-1',
      name: 'iPad-A',
      mode: 'DUAL',
      status: 'IDLE',
      isOnline: true,
      currentLock: {
        id: 'lock-1',
        status: 'RELEASED',
        case: {
          id: 'case-1',
          studentName: 'Alice',
          category: 'TECH',
          status: 'RESOLVED',
        },
        staffName: 'Bob',
      },
    });

    // GET /status 不应写 DB
    expect((prisma.kioskDevice as any).update).toBeUndefined();
  });

  it('200 | ONLINE+BUSY: when current lock is ACTIVE', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'iPad-A',
      mode: 'FEEDBACK',
      lastSeenAt: new Date(), // 刚刚在线
      currentLock: {
        id: 'lock-2',
        status: 'ACTIVE',
        case: { id: 'case-2', studentName: 'Charlie', category: 'ADMIN', status: 'IN_PROGRESS' },
        staff: { name: 'Dora' },
        leaseExpireAt: new Date(Date.now() + 120_000),
      },
    });

    const res = await request(app).get('/device/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deviceId: 'dev-1',
      name: 'iPad-A',
      mode: 'FEEDBACK',
      status: 'BUSY',
      isOnline: true,
      currentLock: {
        id: 'lock-2',
        status: 'ACTIVE',
        case: {
          id: 'case-2',
          studentName: 'Charlie',
          category: 'ADMIN',
          status: 'IN_PROGRESS',
        },
        staffName: 'Dora',
      },
    });
  });

  it('200 | OFFLINE: when lastSeenAt is older than 2 minutes', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'iPad-A',
      mode: 'REGISTRATION',
      lastSeenAt: new Date(Date.now() - 3 * 60_000 - 1000), // 超过 2 分钟阈值
      currentLock: null,
    });

    const res = await request(app).get('/device/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deviceId: 'dev-1',
      name: 'iPad-A',
      mode: 'REGISTRATION',
      status: 'OFFLINE',
      isOnline: false,
      currentLock: null,
    });
  });

  it('404 | when device not found', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get('/device/status');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });
  });

  it('400 | when device auth is missing (requireDevice does not populate req.device)', async () => {
    // 用 isolateModules 重载模块，使 requireDevice 不注入 device
    jest.isolateModules(() => {
      jest.resetModules();

      jest.doMock('../../src/lib/prisma', () => ({
        __esModule: true,
        prisma,
      }));

      jest.doMock('../../src/middlewares/auth.middleware', () => ({
        __esModule: true,
        requireDevice: (_req: any, _res: any, next: any) => next(), // 不注入 req.device
        requireStaff: (_req: any, _res: any, next: any) => next(),
      }));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = require('../../src/routers/device.router').default;
      const freshError = require('../../src/middlewares/error.middleware').errorHandler;

      freshApp.use('/device', freshRouter);
      freshApp.use(freshError);

      (global as any).__APP__STATUS__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__STATUS__;
    const res = await request(freshApp).get('/device/status');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Device authentication required' });
  });
});

