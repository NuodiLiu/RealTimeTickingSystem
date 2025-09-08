// tests/device/device.change-mode.test.ts
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

// 缺省放行 staff；某用例中再重载为拒绝
jest.mock('../../src/middlewares/auth.middleware', () => ({
  __esModule: true,
  requireDevice: (_req: any, _res: any, next: any) => next(),
  requireStaff: (_req: any, _res: any, next: any) => next(),
}));

// mock 网关广播
const publishMock = jest.fn();
jest.mock('../../src/websocket/deviceSocket', () => ({
  __esModule: true,
  DeviceGateway: { publish: (...args: any[]) => publishMock(...args) },
}));

import deviceRouter from '../../src/routers/device.router';
import { errorHandler } from '../../src/middlewares/error.middleware';

describe('PATCH /device/:id/mode', () => {
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

  it('200 | changes mode and broadcasts MODE_CHANGED', async () => {
    // findUnique: 设备存在且未处于 ACTIVE
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'Pad-1',
      mode: 'FEEDBACK',
      deletedAt: null,
      currentLock: null,
    });

    // update: 返回更新后的记录
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'Pad-1',
      mode: 'REGISTRATION',
      lastSeenAt: new Date(),
    });

    const res = await request(app)
      .patch('/device/dev-1/mode')
      .send({ mode: 'REGISTRATION' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'dev-1',
      name: 'Pad-1',
      mode: 'REGISTRATION',
    });

    // DB 交互
    expect(prisma.kioskDevice.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.kioskDevice.findUnique).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      include: { currentLock: true },
    });
    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(1);
    expect(prisma.kioskDevice.update).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      data: { mode: 'REGISTRATION' },
      select: { id: true, name: true, mode: true, lastSeenAt: true },
    });

    // 广播（注意 payload 结构）
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith('dev-1', {
      type: 'MODE_CHANGED',
      payload: { mode: 'REGISTRATION' },
    });
  });

  it('409 | conflict when device has ACTIVE lock', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-2',
      name: 'Pad-2',
      mode: 'FEEDBACK',
      deletedAt: null,
      currentLock: { status: 'ACTIVE' },
    });

    const res = await request(app)
      .patch('/device/dev-2/mode')
      .send({ mode: 'REGISTRATION' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Device is in an ACTIVE session; please end it before changing mode',
    });

    // 冲突时不应更新或广播
    expect(prisma.kioskDevice.update).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('404 | not found when device missing or soft-deleted', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch('/device/does-not-exist/mode')
      .send({ mode: 'FEEDBACK' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });
    expect(prisma.kioskDevice.update).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('401 | requireStaff denies access', async () => {
    // 使用 isolateModules 重载 requireStaff 为拒绝
    jest.isolateModules(() => {
      jest.resetModules();

      // 继续复用已 mock 的 prisma & gateway
      jest.doMock('../../src/lib/prisma', () => ({
        __esModule: true,
        prisma,
      }));
      const { AuthError } = require('../../src/error');

      jest.doMock('../../src/middlewares/auth.middleware', () => ({
        __esModule: true,
        requireDevice: (_req: any, _res: any, next: any) => next(),
        requireStaff: (_req: any, _res: any, next: any) =>
          next(new AuthError('Unauthorized', 401)),
      }));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = require('../../src/routers/device.router').default;
      const freshError = require('../../src/middlewares/error.middleware').errorHandler;

      freshApp.use('/device', freshRouter);
      freshApp.use(freshError);

      (global as any).__APP__CHANGEMODE__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__CHANGEMODE__;
    const res = await request(freshApp)
      .patch('/device/dev-3/mode')
      .send({ mode: 'DUAL' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });
});
