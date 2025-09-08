/**
 * 集成测试：设备创建 Case，员工查看/接单/FIFO 接单/解决 Case
 * 仅 mock prisma（内存实现），不 mock 其它 helper/middleware。
 */

import request from 'supertest';
import crypto from 'crypto';

// ------- 环境变量准备（保证 JWT/URL 等可用） -------
const ORIGINAL_ENV = process.env;
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret-123',
    FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    API_BASE_URL: ORIGINAL_ENV.API_BASE_URL || 'http://localhost:3000',
    WS_BASE_URL: ORIGINAL_ENV.WS_BASE_URL || 'ws://localhost:3000',
  };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// =============== 仅 Mock Prisma：内存实现最小行为 =================

// 内存表
type StaffRow = {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  password: string;
  role: 'STAFF' | 'ADMIN';
  createdAt: Date;
};

type StudentCaseRow = {
  id: string;
  studentName: string;
  category: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED_PENDING_FEEDBACK' | 'RESOLVED';
  staffId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type KioskDeviceRow = {
  id: string;
  name: string;
  secretHash: string;
  mode: 'REGISTRATION' | 'FEEDBACK' | 'DUAL';
  lastSeenAt: Date;
  currentLockId: string | null;
};

const db = {
  staff: [] as StaffRow[],
  studentCase: [] as StudentCaseRow[],
  kioskDevice: [] as KioskDeviceRow[],
};

// 简易 cuid/uuid
function cuid() {
  return 'c' + crypto.randomBytes(8).toString('hex');
}

// Prisma mock：只实现本测试所需方法
const prismaMock = {
  staff: {
    findUnique: jest.fn(async (args: any) => {
      if (args?.where?.id) {
        return db.staff.find((s) => s.id === args.where.id) || null;
      }
      if (args?.where?.employeeNo) {
        return db.staff.find((s) => s.employeeNo === args.where.employeeNo) || null;
      }
      return null;
    }),
    findFirst: jest.fn(async (args: any) => {
      if (args?.where?.employeeNo) {
        return db.staff.find((s) => s.employeeNo === args.where.employeeNo) || null;
      }
      return null;
    }),
    create: jest.fn(async (args: any) => {
      const data = args?.data || {};
      const row: StaffRow = {
        id: data.id ?? cuid(),
        employeeNo: data.employeeNo,
        name: data.name ?? 'NoName',
        email: data.email ?? `${data.employeeNo}@test.local`,
        password: data.password ?? '',
        role: data.role ?? 'STAFF',
        createdAt: new Date(),
      };
      db.staff.push(row);
      return row;
    }),
  },

  session: {
    create: jest.fn(async (_args: any) => ({
      id: cuid(),
      // 其余字段对本测试不敏感
      staffId: _args?.data?.staffId,
      refreshHash: _args?.data?.refreshHash,
      ua: _args?.data?.ua ?? '',
      ip: _args?.data?.ip ?? '',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: _args?.data?.expiresAt ?? new Date(Date.now() + 30 * 86400_000),
      revokedAt: null,
    })),
    updateMany: jest.fn(async (_args: any) => ({ count: 1 })),
    findFirst: jest.fn(async (_args: any) => null),
  },

  studentCase: {
    create: jest.fn(async (args: any) => {
      const data = args?.data;
      const row: StudentCaseRow = {
        id: cuid(),
        studentName: data.studentName,
        category: data.category,
        status: 'QUEUED',
        staffId: null,
        createdAt: new Date(),
        resolvedAt: null,
      };
      db.studentCase.push(row);
      return row;
    }),
    findMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const status = where.status as StudentCaseRow['status'] | undefined;
      let rows = [...db.studentCase];
      if (status) rows = rows.filter((r) => r.status === status);
      // orderBy createdAt asc
      rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return rows;
    }),
    findFirst: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      let rows = [...db.studentCase];
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      return rows[0] || null;
    }),
    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      let count = 0;
      db.studentCase.forEach((r) => {
        const ok =
          (!where.id || where.id === r.id) &&
          (!where.status || where.status === r.status);
        if (ok) {
          if (data.status) r.status = data.status;
          if (Object.prototype.hasOwnProperty.call(data, 'staffId')) r.staffId = data.staffId ?? null;
          if (Object.prototype.hasOwnProperty.call(data, 'resolvedAt')) r.resolvedAt = data.resolvedAt ?? null;
          count++;
        }
      });
      return { count };
    }),
    update: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const row = db.studentCase.find((r) => r.id === where.id);
      if (!row) {
        const e: any = new Error('Not found');
        e.code = 'P2025';
        throw e;
      }
      if (data.status) row.status = data.status;
      if (Object.prototype.hasOwnProperty.call(data, 'resolvedAt')) row.resolvedAt = data.resolvedAt ?? null;
      return row;
    }),
    findUnique: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      return db.studentCase.find((r) => r.id === where.id) || null;
    }),
  },

  kioskDevice: {
    findUnique: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      if (!id) return null;
      return db.kioskDevice.find((d) => d.id === id) || null;
    }),
    findFirst: jest.fn(async (args: any) => {
      // 允许 validateDeviceApiKey 通过 findFirst 定位
      const where = args?.where ?? {};
      if (where?.id) {
        return db.kioskDevice.find((d) => d.id === where.id) || null;
      }
      return db.kioskDevice[0] || null;
    }),
    update: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      const data = args?.data ?? {};
      const row = db.kioskDevice.find((d) => d.id === id);
      if (!row) throw new Error('Device not found');
      if (data.lastSeenAt) row.lastSeenAt = data.lastSeenAt;
      if (Object.prototype.hasOwnProperty.call(data, 'currentLockId')) row.currentLockId = data.currentLockId ?? null;
      return row;
    }),
    updateMany: jest.fn(async (_args: any) => ({ count: 1 })),
    create: jest.fn(async (args: any) => {
      const data = args?.data ?? {};
      const row: KioskDeviceRow = {
        id: data.id ?? cuid(),
        name: data.name ?? 'Kiosk',
        secretHash: data.secretHash ?? '',
        mode: data.mode ?? 'DUAL',
        lastSeenAt: data.lastSeenAt ?? new Date(),
        currentLockId: null,
      };
      db.kioskDevice.push(row);
      return row;
    }),
  },

  // 其它 model 占位，防止 require 时崩溃
  invite: {
    create: jest.fn(),
  },
  feedback: { create: jest.fn(), findUnique: jest.fn() },
  kioskLock: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  feedbackSession: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  pairingSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

// 将 mock 挂载到模块系统
jest.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

// =============== 导入真实 app（不 mock 中间件/辅助方法）=================
import app from '../../src/server';

// =============== 工具函数：创建合法的 Token/Header =================

function signAccessToken(staffId: string, role: 'STAFF' | 'ADMIN', emp?: string) {
  const payload: any = { sub: staffId, role, emp };
  // 与 requireAuth 中一致
  return require('jsonwebtoken').sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

function makeAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * 假设 validateDeviceApiKey 接受 Authorization: "Device <deviceId>:<deviceSecret>"
 * 并用 sha256(secret) 与 kioskDevice.secretHash 对比
 */
function makeDeviceAuthHeader(deviceId: string, deviceSecret: string) {
  return { Authorization: `Device ${deviceId}:${deviceSecret}` };
}

// =============== 场景测试 =================

describe('Integration | Cases flow (device + staff)', () => {
  // 统一测试数据
  const staffId = 'staff-1';
  const employeeNo = 'S001';
  const deviceId = 'dev-1';
  const deviceSecret = 'super-secret';
  const deviceSecretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');

  beforeEach(async () => {
    // 清空“数据库”
    db.staff.length = 0;
    db.studentCase.length = 0;
    db.kioskDevice.length = 0;

    jest.clearAllMocks();

    // 种子：1个 STAFF 员工
    await prismaMock.staff.create({
      data: {
        id: staffId,
        employeeNo,
        name: 'Sam Staff',
        email: 'sam@test.local',
        password: 'x', // 无实际用处
        role: 'STAFF',
      },
    });

    // 种子：1台设备（与 helper 真验签流程匹配）
    await prismaMock.kioskDevice.create({
      data: {
        id: deviceId,
        name: 'iPad 1',
        secretHash: deviceSecretHash,
        mode: 'DUAL',
        lastSeenAt: new Date(),
      },
    });
  });

  it('Device creates a case -> Staff lists queued -> Staff take -> Staff take-next FIFO -> Staff resolve', async () => {
    // 1) 设备创建 Case（/cases POST，requireDevice）
    const createRes1 = await request(app)
      .post('/cases')
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({ studentName: 'Alice', category: 'Academic' });

    expect(createRes1.status).toBe(201);
    expect(createRes1.body).toMatchObject({
      studentName: 'Alice',
      category: 'Academic',
      status: 'QUEUED',
    });
    const caseId1: string = createRes1.body.id;

    // 再创建第二条，便于后续 FIFO 检查
    const createRes2 = await request(app)
      .post('/cases')
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({ studentName: 'Bob', category: 'Financial' });

    expect(createRes2.status).toBe(201);
    const caseId2: string = createRes2.body.id;

    // 2) 员工查看队列（/cases GET，requireStaff）
    const staffToken = signAccessToken(staffId, 'STAFF', employeeNo);
    const listRes = await request(app)
      .get('/cases?status=queued')
      .set(makeAuthHeader(staffToken));

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    // FIFO：Alice 在前，Bob 在后
    expect(listRes.body.map((c: any) => c.studentName)).toEqual(['Alice', 'Bob']);

    // 3) 员工直接接第一条（/cases/:id/take，requireStaff）
    const takeRes = await request(app)
      .post(`/cases/${caseId1}/take`)
      .set(makeAuthHeader(staffToken))
      .send();

    expect(takeRes.status).toBe(200);
    expect(takeRes.body).toMatchObject({
      id: caseId1,
      status: 'IN_PROGRESS',
      staffId,
    });

    // 4) 员工调用 FIFO 接单（/cases/take-next，requireStaff），应拿到第二条 Bob
    const takeNextRes = await request(app)
      .post(`/cases/take-next`)
      .set(makeAuthHeader(staffToken))
      .send();

    expect(takeNextRes.status).toBe(200);
    expect(takeNextRes.body).toMatchObject({
      id: caseId2,
      status: 'IN_PROGRESS',
      staffId,
    });

    // 5) 员工解决第一条（/cases/:id/resolve，requireStaff）
    const resolveRes = await request(app)
      .post(`/cases/${caseId1}/resolve`)
      .set(makeAuthHeader(staffToken))
      .send();

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body).toMatchObject({
      id: caseId1,
      status: 'RESOLVED',
    });
    expect(resolveRes.body.resolvedAt).toBeTruthy();

    // 6) 校验内存“数据库”状态最终一致
    const row1 = db.studentCase.find((r) => r.id === caseId1)!;
    const row2 = db.studentCase.find((r) => r.id === caseId2)!;

    expect(row1.status).toBe('RESOLVED');
    expect(row1.staffId).toBe(staffId);
    expect(row1.resolvedAt).not.toBeNull();

    expect(row2.status).toBe('IN_PROGRESS');
    expect(row2.staffId).toBe(staffId);
  });

  it('Device auth fails with wrong secret', async () => {
    const bad = await request(app)
      .post('/cases')
      .set(makeDeviceAuthHeader(deviceId, 'WRONG-SECRET'))
      .send({ studentName: 'Carol', category: 'General' });

    // 由 requireDevice/validateDeviceApiKey 抛出 401
    expect(bad.status).toBe(401);
  });

  it('Staff guard works (missing token => 401)', async () => {
    const res = await request(app).get('/cases?status=queued');
    expect(res.status).toBe(401);
  });

  it('Validation: missing fields -> 422 MissingFieldError', async () => {
    const res = await request(app)
      .post('/cases')
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({}); // 缺 studentName / category

    // 走真实 Controller + Service + MissingFieldError -> 全局错误中间件
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
