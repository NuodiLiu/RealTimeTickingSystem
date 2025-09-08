// tests/device/device.heartbeat.test.ts
import express from 'express';
import request from 'supertest';
import http from 'http';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

// 默认：mock 掉 auth 中间件，给每个用例注入 deviceId，除非用例里覆盖
jest.mock('../../src/middlewares/auth.middleware', () => {
  return {
    __esModule: true,
    requireDevice: (req: any, _res: any, next: any) => {
      // 默认给一个 device 上下文
      req.device = { deviceId: 'dev-1', device: {} };
      next();
    },
    requireStaff: (_req: any, _res: any, next: any) => next(),
  };
});

import deviceRouter from '../../src/routers/device.router';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('POST /device/heartbeat', () => {
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

    server = app.listen(); // supertest 可以直接用 app，不必 listen；这行无害
  });

  afterAll((done) => {
    process.env = ORIGINAL_ENV;
    server && server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('200 | returns IDLE status and updates lastSeenAt when no active lock', async () => {
    // 模拟设备存在，currentLock 不为 ACTIVE
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'iPad-A',
      mode: 'DUAL',
      lastSeenAt: new Date(Date.now() - 60_000), // 1 分钟前
      currentLock: {
        id: 'lock-1',
        status: 'RELEASED',
        case: { id: 'case-1', studentName: 'Alice', category: 'TECH', status: 'RESOLVED' },
        staff: { name: 'Bob' },
        leaseExpireAt: new Date(Date.now() + 60_000),
      },
    });

    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});

    const res = await request(app).post('/device/heartbeat').send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      status: 'IDLE',
      deviceMode: 'DUAL',
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

    // 确认 DB 更新了 lastSeenAt
    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(1);
    expect(prisma.kioskDevice.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'dev-1' },
      data: { lastSeenAt: expect.any(Date) },
    });

    // timestamp 返回的是字符串还是 ISO，取决于你的 JSON 序列化；这里只验证存在
    expect(res.body.timestamp).toBeTruthy();
  });

  it('200 | returns BUSY status when current lock is ACTIVE', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'iPad-A',
      mode: 'FEEDBACK',
      lastSeenAt: new Date(),
      currentLock: {
        id: 'lock-2',
        status: 'ACTIVE',
        case: { id: 'case-2', studentName: 'Charlie', category: 'ADMIN', status: 'IN_PROGRESS' },
        staff: { name: 'Dora' },
        leaseExpireAt: new Date(Date.now() + 120_000),
      },
    });

    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});

    const res = await request(app).post('/device/heartbeat').send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      status: 'BUSY',
      deviceMode: 'FEEDBACK',
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

    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(1);
  });

  it('404 | when device not found', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).post('/device/heartbeat').send({});

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });

    // 不应调用 update
    expect(prisma.kioskDevice.update).not.toHaveBeenCalled();
  });

  it('400 | when device auth is missing (requireDevice sets nothing)', async () => {
    // 重新 mock 一次 requireDevice，让其不注入 req.device
    jest.isolateModules(() => {
      jest.resetModules();

      jest.doMock('../../src/lib/prisma', () => ({
        __esModule: true,
        prisma,
      }));

      jest.doMock('../../src/middlewares/auth.middleware', () => ({
        __esModule: true,
        requireDevice: (_req: any, _res: any, next: any) => next(), // 不注入 device
        requireStaff: (_req: any, _res: any, next: any) => next(),
      }));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = require('../../src/routers/device.router').default;
      const freshError = require('../../src/middlewares/error.middleware').errorHandler;

      freshApp.use('/device', freshRouter);
      freshApp.use(freshError);

      return (global as any).__APP__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__;

    const res = await request(freshApp).post('/device/heartbeat').send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Device authentication required' });
  });
});
