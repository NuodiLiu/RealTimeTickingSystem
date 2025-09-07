import request from 'supertest';

// 先 mock prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    staff: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    invite: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
    },
  },
}));

// mock AuthService.createSession（避免依赖 jwt/redis/db 等）
jest.mock('../../src/services/auth.service', () => {
  return {
    AuthService: {
      createSession: jest.fn().mockResolvedValue({
        accessToken: 'fake-access',
        sessionId: 'sess-1',
        expiresAt: new Date('2025-09-06T00:00:00.000Z'),
      }),
      useInvite: jest.fn(),
    },
  };
});

// 注意：mock 要在 import app 前执行
import app from '../../src/server';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/services/auth.service';

describe('POST /auth/register', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      FRONTEND_URL: 'http://localhost:3001',
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if missing required fields', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'abc@example.com',
      // token/employeeNo/name
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if invite is invalid/expired', async () => {
    (AuthService.useInvite as jest.Mock).mockResolvedValue(null);

    const res = await request(app).post('/auth/register').send({
      token: 'badtoken',
      employeeNo: 'E001',
      name: 'Liam',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invite/);
  });

  it('should return 409 if user already exists', async () => {
    (AuthService.useInvite as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      employeeNo: 'E001',
    });

    const res = await request(app).post('/auth/register').send({
      token: 'goodtoken',
      employeeNo: 'E001',
      name: 'Liam',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('should create new user and return staff + session', async () => {
    (AuthService.useInvite as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.staff.create as jest.Mock).mockResolvedValue({
      id: 'staff-123',
      employeeNo: 'E002',
      name: 'New User',
      email: 'E002@example.com',
      password: '',
    });

    const res = await request(app).post('/auth/register').send({
      token: 'goodtoken',
      employeeNo: 'E002',
      name: 'New User',
    });

    expect(res.status).toBe(200);
    expect(res.body.staff).toHaveProperty('id', 'staff-123');
    expect(res.body.session).toHaveProperty('accessToken', 'fake-access');
  });
});
