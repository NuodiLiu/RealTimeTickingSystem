import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/server';

// —— 按你的风格：mock prisma ——
// 只需要 invite.create 就够了；如果其它测试文件也会用到，这里可以加更多 model。
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    invite: {
      create: jest.fn(),
    },
  },
}));

// —— 该路由需要认证：mock 掉 requireAuth，直接注入 req.user ——
// 路由层面的“已登录”效果，避免依赖 JWT。
jest.mock('../../src/middlewares/auth.middleware', () => {
  const injectUser = (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'ADMIN', employeeNo: 'E001' };
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

// 取到被 mock 的 prisma
import { prisma } from '../../src/lib/prisma';

describe('POST /auth/invites', () => {
  const ORIGINAL_ENV = process.env;
  const FIXED_EXPIRES = new Date('2025-09-05T00:00:00.000Z');

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an invite and return inviteUrl + expiresAt (200)', async () => {
    // 固定 token，便于断言 inviteUrl
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111');

    // mock DB 行为：service 内部会把 hash 写库，但我们只需要返回 expiresAt
    (prisma.invite.create as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      tokenHash: 'sha256-hash',
      createdById: 'user-123',
      expiresAt: FIXED_EXPIRES,
      usedAt: null,
      createdAt: FIXED_EXPIRES,
    });

    const res = await request(app).post('/auth/invites').send({});

    expect(res.status).toBe(200);
    expect(prisma.invite.create).toHaveBeenCalledTimes(1);

    // 响应字段
    expect(res.body).toHaveProperty('inviteUrl');
    expect(res.body).toHaveProperty('expiresAt');

    // URL 必须带我们固定的 token
    expect(res.body.inviteUrl).toBe(
      `${process.env.FRONTEND_URL}/register?token=11111111-1111-1111-1111-111111111111`
    );
    // 时间能被正确序列化
    expect(new Date(res.body.expiresAt).toISOString()).toBe(
      FIXED_EXPIRES.toISOString()
    );
  });

  it('should return 5xx when DB fails', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111');

    (prisma.invite.create as jest.Mock).mockRejectedValue(new Error('DB down'));

    const res = await request(app).post('/auth/invites').send({});

    // 具体码取决于你的全局错误处理中间件，这里只断言为 4xx/5xx 非 2xx
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
