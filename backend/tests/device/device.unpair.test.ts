// tests/device/device.unpair.test.ts
import express from 'express';
import request from 'supertest';
import http from 'http';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
      update: jest.fn(), // 仅备用；事务里我们传 tx.kioskDevice.update
    },
    $transaction: jest.fn(),
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

describe('DELETE /device/:id (unpair)', () => {
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

  it('204 | soft-deletes device and broadcasts UNPAIRED', async () => {
    // 1) findUnique: 存在且未处于 ACTIVE、未软删
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      name: 'Pad-1',
      mode: 'FEEDBACK',
      deletedAt: null,
      currentLock: null,
    });

    // 2) $transaction：模拟 tx 流程（两次 update）
    const txUpdate = jest.fn()
      // 第一次：清空 currentLockId
      .mockResolvedValueOnce({ id: 'dev-1', currentLockId: null })
      // 第二次：写 deletedAt & secretHash
      .mockResolvedValueOnce({ id: 'dev-1', deletedAt: new Date(), secretHash: null });

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = { kioskDevice: { update: txUpdate } };
      return cb(tx);
    });

    const res = await request(app).delete('/device/dev-1');

    expect(res.status).toBe(204);
    expect(res.text).toBe(''); // no body

    // findUnique 校验
    expect(prisma.kioskDevice.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.kioskDevice.findUnique).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      include: { currentLock: true },
    });

    // 事务调用
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(2);

    // 第一次 update：清空 currentLockId
    expect(txUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 'dev-1' },
      data: { currentLockId: null },
    });
    // 第二次 update：软删除并失效 secret
    const secondCallArg = txUpdate.mock.calls[1][0];
    expect(secondCallArg.where).toEqual({ id: 'dev-1' });
    expect(secondCallArg.data).toMatchObject({ secretHash: null });
    expect(secondCallArg.data.deletedAt).toBeInstanceOf(Date);

    // 广播
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith('dev-1', { type: 'UNPAIRED' });
  });

  it('409 | conflict when device has ACTIVE lock', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-2',
      name: 'Pad-2',
      mode: 'REGISTRATION',
      deletedAt: null,
      currentLock: { status: 'ACTIVE' },
    });

    const res = await request(app).delete('/device/dev-2');

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Device is in an ACTIVE session; please end it before unpairing',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('404 | not found when device missing', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).delete('/device/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('404 | not found when device soft-deleted', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-3',
      deletedAt: new Date(),
      currentLock: null,
    });

    const res = await request(app).delete('/device/dev-3');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Device not found' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('401 | requireStaff denies access', async () => {
    // 使用 isolateModules 重载 requireStaff 为拒绝
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
        requireStaff: (_req: any, _res: any, next: any) =>
          next(new AuthError('Unauthorized', 401)),
      }));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = require('../../src/routers/device.router').default;
      const freshError = require('../../src/middlewares/error.middleware').errorHandler;

      freshApp.use('/device', freshRouter);
      freshApp.use(freshError);

      (global as any).__APP__UNPAIR__ = freshApp;
    });

    const freshApp: express.Express = (global as any).__APP__UNPAIR__;
    const res = await request(freshApp).delete('/device/dev-4');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });
});
