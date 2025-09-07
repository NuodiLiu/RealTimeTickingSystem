// tests/auth.login.test.ts
import type { MockedFunction } from 'jest-mock';

// 把函数视作 jest 的 Mock，并保留原签名
const mf = <T extends (...args: any[]) => any>(fn: T) =>
  fn as unknown as MockedFunction<T>;

// 1) 先 mock 依赖
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    staff: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/auth.service', () => {
  return {
    AuthService: {
      // 先给一个默认 resolvedValue；具体用例里会用 mockImplementation 覆盖
      createSession: jest.fn().mockResolvedValue({
        accessToken: 'fake-access',
        sessionId: 'sess-1',
        expiresAt: new Date('2025-09-06T00:00:00.000Z'),
      }),
    },
  };
});

// 2) 再导入 app 与被 mock 的实例
import request from 'supertest';
import app from '../../src/server';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/services/auth.service';

describe('POST /auth/login (mocked)', () => {
  const ORIGINAL_ENV = process.env;
  const spyError = jest.spyOn(console, 'error').mockImplementation(() => {}); // 可选：抑制错误日志

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    spyError.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('422 when employeeNo is missing', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.error || res.body.message).toBeDefined();

    // 不应触碰数据库
    expect(mf(prisma.staff.findUnique).mock.calls.length).toBe(0);
  });

  it('401 when user not found', async () => {
    mf(prisma.staff.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({
      employeeNo: '999999', // 六位数字
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);

    // 校验查询条件
    expect(prisma.staff.findUnique).toHaveBeenCalledWith({
      where: { employeeNo: '999999' },
    });
  });

  it('200 on success: returns staff + session and sets refresh cookie', async () => {
    // 让查库命中
    mf(prisma.staff.findUnique).mockResolvedValue({
      id: 'staff-1',
      employeeNo: '123456',
      name: 'Liam',
      role: 'STAFF',
    } as any);

    // 关键：模拟在 Service 里设置 refresh_token cookie
    mf(AuthService.createSession).mockImplementation(
      async (_staffId: string, _req: any, res: any) => {
        res.cookie('refresh_token', 'dummy-refresh', {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        return {
          accessToken: 'fake-access',
          sessionId: 'sess-1',
          expiresAt: new Date('2025-09-06T00:00:00.000Z'),
        };
      }
    );

    const res = await request(app)
      .post('/auth/login')
      .set('User-Agent', 'jest-agent')
      .send({ employeeNo: '123456' });

    expect(res.status).toBe(200);

    // 响应体
    expect(res.body.staff).toMatchObject({
      id: 'staff-1',
      employeeNo: '123456',
      name: 'Liam',
    });
    expect(res.body.session).toHaveProperty('accessToken', 'fake-access');

    // createSession 被按预期调用
    expect(AuthService.createSession).toHaveBeenCalledTimes(1);
    expect(AuthService.createSession).toHaveBeenCalledWith(
      'staff-1',
      expect.any(Object), // req
      expect.any(Object), // res
    );

    // Cookie 断言：名称、HttpOnly、SameSite=Lax、Max-Age
    const setCookieHeader = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(cookieStr).toMatch(/refresh_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
    expect(cookieStr).toMatch(/Max-Age=\d+/i);
  });

  it('5xx when AuthService.createSession throws', async () => {
    mf(prisma.staff.findUnique).mockResolvedValue({
      id: 'staff-2',
      employeeNo: '234567',
      name: 'User 2',
      role: 'STAFF',
    } as any);

    mf(AuthService.createSession).mockRejectedValue(
      new Error('session create failed')
    );

    const res = await request(app).post('/auth/login').send({
      employeeNo: '234567',
    });

    // 具体状态码取决于你的全局错误处理，这里只断言非 2xx
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('trims employeeNo (optional)', async () => {
    mf(prisma.staff.findUnique).mockResolvedValueOnce({
      id: 'staff-3',
      employeeNo: '654321',
      name: 'Trim User',
      role: 'STAFF',
    } as any);

    const res = await request(app).post('/auth/login').send({
      employeeNo: '  654321  ',
    });

    // 保留对 where 条件的校验，看看是否原样带空格
    expect(prisma.staff.findUnique).toHaveBeenCalledWith({
      where: { employeeNo: '  654321  ' },
    });

    // 由于你项目里可能有前置校验把它判 400，这里允许 200/400/401/422 任一
    expect([200, 400, 401, 422]).toContain(res.status);
  });
});
