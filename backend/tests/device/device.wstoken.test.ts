// tests/device/device.ws-token.test.ts
import express from 'express';
import request from 'supertest';
import http from 'http';
import jwt from 'jsonwebtoken';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

// 缺省：设备已通过认证（注入 req.device）
// 个别用例使用 isolateModules 重载为“不注入”以触发 400
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

describe('POST /device/ws-token', () => {
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

  it('200 | issues a device WebSocket token with 12h expiry and correct payload', async () => {
    // DB 中存在设备
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      mode: 'DUAL',
    });

    const res = await request(app).post('/device/ws-token').send({});
    expect(res.status).toBe(200);

    // 返回体
    expect(res.body).toHaveProperty('deviceToken');
    expect(res.body).toHaveProperty('expiresIn', 12 * 60 * 60);

    // 校验 token 内容
    const decoded = jwt.verify(res.body.deviceToken, process.env.JWT_SECRET!) as any;
    expect(decoded).toMatchObject({
      typ: 'device',
      sub: 'dev-1',
      mode: 'DUAL',
    });
    // 校验有效期（exp - iat ≈ 12h）
    const lifetime = (decoded.exp - decoded.iat) as number; // 秒
    expect(lifetime).toBeGreaterThanOrEqual(12 * 60 * 60 - 10); // 允许少许误差
    expect(lifetime).toBeLessThanOrEqual(12 * 60 * 60 + 10);

    // 确认使用了正确的 DB 查询条件
    expect(prisma.kioskDevice.findUnique).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      select: { id: true, mode: true },
    });
  });

  it('404 | when device not found', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).post('/device/ws-token').send({});
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });
  });

  it('400 | when device auth is missing (requireDevice does not populate req.device)', async () => {
    // 用 isolateModules 重载中间件，使 requireDevice 不注入 device
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

      (global as any).__APP__WSTOKEN__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__WSTOKEN__;
    const res = await request(freshApp).post('/device/ws-token').send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Device authentication required' });
  });
});
