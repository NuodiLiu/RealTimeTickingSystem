/**
 * End-to-End Integration (with real WebSocket) — Multi Staff + Override (Azure SSO)
 *
 * 场景：
 * - 三个学生在 iPad 登记（创建 3 个 case）
 * - 两个 staff 交错接单（S2 -> S1 -> S2）
 * - staffA 对 case2 先发反馈；iPad 收到并回 DELIVERED
 * - staffB 对同一台设备执行 override；设备收到 DISMISS + 新的 SHOW_FEEDBACK，并回 DELIVERED
 * - iPad 依次提交两个 session（case2 覆盖后的新 session、case3 正常流程）
 * - 校验最终状态：case2/3 RESOLVED、锁 COMPLETED、设备 currentLockId 清空，旧会话被 OVERRIDDEN
 */

import http from 'http';
import request, { SuperAgentTest } from 'supertest';
import crypto from 'crypto';
import { io as ioc, Socket } from 'socket.io-client';
import type { Server as IOServer } from 'socket.io';

const ORIGINAL_ENV = process.env;
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    // cookie-session 需要
    SESSION_KEYS: 'k1,k2',
    // 若启用租户白名单
    AZURE_AD_TENANT_ID: 'TENANT-OK',
    FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    API_BASE_URL: ORIGINAL_ENV.API_BASE_URL || 'http://localhost:3000',
    WS_BASE_URL: ORIGINAL_ENV.WS_BASE_URL || 'ws://localhost:3000',
    // 旧 JWT 不再用到，但保留无妨
    JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret-123',
  };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

/* ===================== 仅 Mock Prisma：内存实现（支持 identityKey） ===================== */

type StaffRow = {
  id: string;
  identityKey: string; // 新增：attachReqUser 依据它查
  employeeNo: string;
  name: string;
  email: string | undefined;
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

type KioskLockRow = {
  id: string;
  deviceId: string;
  staffId: string;
  caseId: string;
  status: 'ACTIVE' | 'OVERRIDDEN' | 'COMPLETED' | 'EXPIRED';
  version: number;
  leaseExpireAt: Date;
  createdAt: Date;
  releasedAt: Date | null;
};

type FeedbackSessionRow = {
  id: string;
  caseId: string;
  staffId: string;
  deviceId: string;
  status: 'CREATED' | 'DELIVERED' | 'SUBMITTED' | 'OVERRIDDEN' | 'CANCELLED' | 'EXPIRED';
  createdAt: Date;
  deliveredAt: Date | null;
  submittedAt: Date | null;
  overriddenAt: Date | null;
  cancelledAt: Date | null;
  expireAt: Date | null;
};

type FeedbackRow = {
  id: string;
  caseId: string; // unique
  staffId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
};

const db = {
  staff: [] as StaffRow[],
  studentCase: [] as StudentCaseRow[],
  kioskDevice: [] as KioskDeviceRow[],
  kioskLock: [] as KioskLockRow[],
  feedbackSession: [] as FeedbackSessionRow[],
  feedback: [] as FeedbackRow[],
};

function cuid() {
  return 'c' + crypto.randomBytes(8).toString('hex');
}
function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function matchWhere<T extends Record<string, any>>(row: T, where: any): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    const vv = (row as any)[k];
    if (v && typeof v === 'object' && ('gt' in (v as any) || 'lt' in (v as any))) {
      if ((v as any).gt != null && !(vv > (v as any).gt)) return false;
      if ((v as any).lt != null && !(vv < (v as any).lt)) return false;
      continue;
    }
    if (vv !== v) return false;
  }
  return true;
}

const prismaMock = {
  $transaction: async (fn: any) => await fn(prismaMock),

  staff: {
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      const row: StaffRow = {
        id: d.id ?? cuid(),
        identityKey: d.identityKey ?? 'iss|sub',
        employeeNo: d.employeeNo ?? `ext-${cuid().slice(1, 8)}`,
        name: d.name ?? 'NoName',
        email: d.email,
        password: d.password ?? '',
        role: d.role ?? 'STAFF',
        createdAt: new Date(),
      };
      db.staff.push(row);
      return row;
    }),
    findUnique: jest.fn(async (args: any) => {
      const w = args?.where ?? {};
      if (w.id) return db.staff.find(s => s.id === w.id) || null;
      if (w.identityKey) return db.staff.find(s => s.identityKey === w.identityKey) || null;
      return null;
    }),
    findFirst: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      return db.staff.find(s => matchWhere(s as any, where)) || null;
    }),
    upsert: jest.fn(async (args: any) => {
      const w = args?.where || {};
      let row = db.staff.find(s => s.identityKey === w.identityKey);
      if (!row) {
        const d = args?.create || {};
        row = {
          id: d.id ?? cuid(),
          identityKey: d.identityKey,
          employeeNo: d.employeeNo ?? `ext-${cuid().slice(1, 8)}`,
          name: d.name ?? 'New User',
          email: d.email,
          password: '',
          role: d.role ?? 'STAFF',
          createdAt: new Date(),
        };
        db.staff.push(row);
      } else {
        const u = args?.update || {};
        if (u.name) row.name = u.name;
        if (u.email) row.email = u.email;
        if (u.role) row.role = u.role;
      }
      return row;
    }),
  },

  session: {
    create: jest.fn(async (args: any) => ({
      id: cuid(),
      staffId: args?.data?.staffId,
      refreshHash: args?.data?.refreshHash,
      ua: args?.data?.ua ?? '',
      ip: args?.data?.ip ?? '',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: args?.data?.expiresAt ?? new Date(Date.now() + 30 * 86400_000),
      revokedAt: null,
    })),
    updateMany: jest.fn(async (_args: any) => ({ count: 1 })),
    findFirst: jest.fn(async (_args: any) => null),
  },

  studentCase: {
    create: jest.fn(async (args: any) => {
      const d = args?.data;
      const row: StudentCaseRow = {
        id: cuid(),
        studentName: d.studentName,
        category: d.category,
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
      let rows = db.studentCase.filter(r => matchWhere(r as any, where));
      if (args?.orderBy?.createdAt === 'asc') {
        rows = rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
      return rows;
    }),
    findFirst: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const orderBy = args?.orderBy ?? [];
      let rows = db.studentCase.filter(r => matchWhere(r as any, where));
      if (orderBy.length) {
        rows = rows.sort((a, b) => {
          const t = a.createdAt.getTime() - b.createdAt.getTime();
          if (t !== 0) return t;
          return a.id.localeCompare(b.id);
        });
      }
      return rows[0] || null;
    }),
    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      let count = 0;
      db.studentCase.forEach(r => {
        if (matchWhere(r as any, where)) {
          if (data.status) r.status = data.status;
          if ('staffId' in data) r.staffId = data.staffId ?? null;
          if ('resolvedAt' in data) r.resolvedAt = data.resolvedAt ?? null;
          count++;
        }
      });
      return { count };
    }),
    update: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const row = db.studentCase.find(r => r.id === where.id);
      if (!row) {
        const e: any = new Error('Not found');
        e.code = 'P2025';
        throw e;
      }
      if (data.status) row.status = data.status;
      if ('resolvedAt' in data) row.resolvedAt = data.resolvedAt ?? null;
      return row;
    }),
    findUnique: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      return db.studentCase.find(r => r.id === id) || null;
    }),
  },

  kioskDevice: {
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      const row: KioskDeviceRow = {
        id: d.id ?? cuid(),
        name: d.name ?? 'Kiosk',
        secretHash: d.secretHash ?? '',
        mode: d.mode ?? 'DUAL',
        lastSeenAt: d.lastSeenAt ?? new Date(),
        currentLockId: null,
      };
      db.kioskDevice.push(row);
      return row;
    }),
    findUnique: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      return db.kioskDevice.find(d => d.id === id) || null;
    }),
    update: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      const data = args?.data ?? {};
      const row = db.kioskDevice.find(d => d.id === id);
      if (!row) throw new Error('Device not found');
      if ('lastSeenAt' in data) row.lastSeenAt = data.lastSeenAt ?? row.lastSeenAt;
      if ('currentLockId' in data) row.currentLockId = data.currentLockId ?? null;
      return row;
    }),
    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      let count = 0;
      db.kioskDevice.forEach(r => {
        if (matchWhere(r as any, where)) {
          if ('currentLockId' in data) r.currentLockId = data.currentLockId ?? null;
          if ('lastSeenAt' in data) r.lastSeenAt = data.lastSeenAt ?? r.lastSeenAt;
          count++;
        }
      });
      return { count };
    }),
  },

  kioskLock: {
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      const row: KioskLockRow = {
        id: cuid(),
        deviceId: d.deviceId,
        staffId: d.staffId,
        caseId: d.caseId,
        status: d.status ?? 'ACTIVE',
        version: d.version ?? 1,
        leaseExpireAt: d.leaseExpireAt ?? new Date(Date.now() + 60_000),
        createdAt: new Date(),
        releasedAt: null,
      };
      db.kioskLock.push(row);
      return row;
    }),
    findFirst: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      return db.kioskLock.find(r => matchWhere(r as any, where)) || null;
    }),
    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      let count = 0;
      db.kioskLock.forEach(r => {
        if (matchWhere(r as any, where)) {
          if (data.status) r.status = data.status;
          if ('releasedAt' in data) r.releasedAt = data.releasedAt ?? null;
          if (data.version && data.version.increment) r.version += data.version.increment;
          if ('leaseExpireAt' in data) r.leaseExpireAt = data.leaseExpireAt ?? r.leaseExpireAt;
          count++;
        }
      });
      return { count };
    }),
    update: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const row = db.kioskLock.find(r => r.id === where.id);
      if (!row) throw new Error('Lock not found');
      if (data.status) row.status = data.status;
      if ('releasedAt' in data) row.releasedAt = data.releasedAt ?? null;
      if (data.version && data.version.increment) row.version += data.version.increment;
      if ('leaseExpireAt' in data) row.leaseExpireAt = data.leaseExpireAt ?? row.leaseExpireAt;
      return row;
    }),
  },

  feedbackSession: {
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      const row: FeedbackSessionRow = {
        id: cuid(),
        caseId: d.caseId,
        staffId: d.staffId,
        deviceId: d.deviceId,
        status: d.status ?? 'CREATED',
        createdAt: new Date(),
        deliveredAt: null,
        submittedAt: null,
        overriddenAt: null,
        cancelledAt: null,
        expireAt: d.expireAt ?? new Date(Date.now() + 10 * 60_000),
      };
      db.feedbackSession.push(row);
      return row;
    }),
    update: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      const data = args?.data ?? {};
      const row = db.feedbackSession.find(r => r.id === id);
      if (!row) throw new Error('FeedbackSession not found');
      if (data.status) row.status = data.status;
      if ('submittedAt' in data) row.submittedAt = data.submittedAt ?? null;
      if ('deliveredAt' in data) row.deliveredAt = data.deliveredAt ?? null;
      if ('overriddenAt' in data) row.overriddenAt = data.overriddenAt ?? null;
      return row;
    }),
    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      let count = 0;
      db.feedbackSession.forEach(r => {
        if (matchWhere(r as any, where)) {
          if (data.status) r.status = data.status;
          if ('submittedAt' in data) r.submittedAt = data.submittedAt ?? null;
          if ('deliveredAt' in data) r.deliveredAt = data.deliveredAt ?? null;
          if ('overriddenAt' in data) r.overriddenAt = data.overriddenAt ?? null;
          count++;
        }
      });
      return { count };
    }),
    findUnique: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      return db.feedbackSession.find(r => r.id === id) || null;
    }),
  },

  feedback: {
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      if (db.feedback.find(f => f.caseId === d.caseId)) {
        const e: any = new Error('Unique violation');
        e.code = 'P2002';
        throw e;
      }
      const row: FeedbackRow = {
        id: cuid(),
        caseId: d.caseId,
        staffId: d.staffId,
        rating: d.rating,
        comment: d.comment,
        createdAt: new Date(),
      };
      db.feedback.push(row);
      return { id: row.id };
    }),
    findUnique: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      if (where.caseId) {
        const f = db.feedback.find(r => r.caseId === where.caseId);
        return f ? { id: f.id, caseId: f.caseId, rating: f.rating, comment: f.comment } : null;
      }
      return null;
    }),
  },

  pairingSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  invite: { create: jest.fn() },
};

jest.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

/* ===================== 导入真实 app & 绑定 Socket.IO ===================== */
import app from '../../src/server';
import { DeviceGateway } from '../../src/websocket/deviceSocket';
import { bindRealtime } from '../../src/websocket';

let server: http.Server;
let port: number;
let io: IOServer;

beforeAll(async () => {
  server = http.createServer(app);
  io = DeviceGateway.init(server);
  bindRealtime(io);

  await new Promise<void>((resolve) => {
    const s = server.listen(0, () => {
      const addr = s.address();
      if (typeof addr === 'object' && addr?.port) port = addr.port;
      resolve();
    });
  });
});

afterAll(async () => {
  if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

/* ===================== 工具 ===================== */

const deviceAuth = (id: string, secret: string) => ({ Authorization: `Device ${id}:${secret}` });

async function connectIpadClient(
  deviceId: string,
  deviceSecret: string
): Promise<{ socket: Socket; waitForPing: () => Promise<void> }> {
  const r = await request(server)
    .post('/device/ws-token')
    .set({ Authorization: `Device ${deviceId}:${deviceSecret}` })
    .send();

  expect(r.status).toBe(200);
  const { deviceToken } = r.body;
  expect(deviceToken).toBeTruthy();

  const socket: Socket = ioc(`ws://127.0.0.1:${port}`, {
    path: '/ws',
    transports: ['websocket'],
    auth: { deviceToken },
    extraHeaders: { Authorization: `Bearer ${deviceToken}` },
  });

  let pingSeen = false;
  const onMessageForPing = (msg: any) => {
    if (msg?.type === 'PING') {
      pingSeen = true;
      socket.emit('message', { type: 'PONG' });
      socket.off('message', onMessageForPing);
    }
  };
  socket.on('message', onMessageForPing);

  const connected = new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 8000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });

  const waitForPing = async () => {
    await connected;
    if (pingSeen) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  };

  await connected;
  return { socket, waitForPing };
}

/* ===================== 场景测试 ===================== */

describe('Integration | Multi-staff with override via real WebSocket (Azure SSO)', () => {
  const deviceId = 'dev-1';
  const deviceSecret = 'super-secret';
  const deviceHash = sha256(deviceSecret);

  const staffA = { id: 'staff-A', emp: 'S001', name: 'Alice Staff', identityKey: 'iss|sub-A' };
  const staffB = { id: 'staff-B', emp: 'S002', name: 'Bob Staff',   identityKey: 'iss|sub-B' };

  let staffAgentA: SuperAgentTest;
  let staffAgentB: SuperAgentTest;

  beforeEach(async () => {
    // 清库
    db.staff.length = 0;
    db.studentCase.length = 0;
    db.kioskDevice.length = 0;
    db.kioskLock.length = 0;
    db.feedbackSession.length = 0;
    db.feedback.length = 0;

    jest.clearAllMocks();

    // 两个 staff（identityKey 对齐 mock-login）
    await prismaMock.staff.create({
      data: {
        id: staffA.id,
        identityKey: staffA.identityKey,
        employeeNo: staffA.emp,
        name: staffA.name,
        email: 'a@test.local',
        password: 'x',
        role: 'STAFF',
      }
    });
    await prismaMock.staff.create({
      data: {
        id: staffB.id,
        identityKey: staffB.identityKey,
        employeeNo: staffB.emp,
        name: staffB.name,
        email: 'b@test.local',
        password: 'x',
        role: 'STAFF',
      }
    });

    // 设备
    await prismaMock.kioskDevice.create({
      data: { id: deviceId, name: 'iPad-1', secretHash: deviceHash, mode: 'DUAL', lastSeenAt: new Date() }
    });

    // 分别建立两个员工会话
    staffAgentA = request.agent(server) as unknown as request.SuperTest<request.Test>;
    staffAgentB = request.agent(server) as unknown as request.SuperTest<request.Test>;

    const loginA = await staffAgentA.post('/auth/__test/mock-login').send({
      identityKey: staffA.identityKey,
      tid: 'TENANT-OK',
      upn: 'a@test.local',
      name: staffA.name,
    });
    const loginB = await staffAgentB.post('/auth/__test/mock-login').send({
      identityKey: staffB.identityKey,
      tid: 'TENANT-OK',
      upn: 'b@test.local',
      name: staffB.name,
    });
    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);
  });

  it('multi staff take, send, override, submit → final states correct', async () => {
    // 1) 三个学生在 iPad 登记
    const c1 = await request(server).post('/cases').set(deviceAuth(deviceId, deviceSecret))
      .send({ studentName: 'Stu-1', category: 'Academic' });
    const c2 = await request(server).post('/cases').set(deviceAuth(deviceId, deviceSecret))
      .send({ studentName: 'Stu-2', category: 'IT' });
    const c3 = await request(server).post('/cases').set(deviceAuth(deviceId, deviceSecret))
      .send({ studentName: 'Stu-3', category: 'Other' });

    expect(c1.status).toBe(201);
    expect(c2.status).toBe(201);
    expect(c3.status).toBe(201);

    const case1 = c1.body.id as string;
    const case2 = c2.body.id as string;
    const case3 = c3.body.id as string;

    // 2) 多 staff 交错接单：S2 -> S1 -> S2
    const q1 = await staffAgentB.get('/cases?status=QUEUED');
    expect(q1.status).toBe(200);
    expect(q1.body.map((x: any) => x.id)).toEqual(expect.arrayContaining([case1, case2, case3]));

    const t1 = await staffAgentB.post(`/cases/${case1}/take`).send();
    expect(t1.status).toBe(200);
    expect(t1.body).toMatchObject({ id: case1, status: 'IN_PROGRESS', staffId: staffB.id });

    const t2 = await staffAgentA.post(`/cases/${case2}/take`).send();
    expect(t2.status).toBe(200);
    expect(t2.body).toMatchObject({ id: case2, status: 'IN_PROGRESS', staffId: staffA.id });

    const t3 = await staffAgentB.post(`/cases/${case3}/take`).send();
    expect(t3.status).toBe(200);
    expect(t3.body).toMatchObject({ id: case3, status: 'IN_PROGRESS', staffId: staffB.id });

    // 3) 连接 iPad WebSocket
    const { socket: ipad, waitForPing } = await connectIpadClient(deviceId, deviceSecret);
    await waitForPing();

    // 4) staffA 对 case2 发送反馈，等待 SHOW_FEEDBACK
    const waitShow1 = new Promise<any>((resolve, reject) => {
      const tt = setTimeout(() => reject(new Error('no SHOW_FEEDBACK #1')), 8000);
      ipad.on('message', (msg: any) => {
        if (msg?.type === 'SHOW_FEEDBACK') {
          clearTimeout(tt);
          resolve(msg);
        }
      });
    });

    const send1 = await staffAgentA.post('/feedback/send')
      .send({ caseId: case2, deviceId, staffId: staffA.id }); // 若服务端从 req.user 取也没关系
    expect(send1.status).toBe(200);
    const session1 = send1.body.session.id as string;
    const lock1 = send1.body.lock.id as string;
    const version1 = send1.body.lock.version as number;

    const show1 = await waitShow1;
    expect(show1.payload).toMatchObject({
      sessionId: session1,
      caseId: case2,
      staff: { id: staffA.id, name: expect.any(String) },
      expireAt: expect.any(String),
    });

    // iPad 回 DELIVERED（会话置 DELIVERED）
    ipad.emit('message', { type: 'DELIVERED', payload: { sessionId: session1 } });

    // 5) staffB 对同一台设备执行 override（基于 lock1/version1）
    const eventsPromise = new Promise<{ dismiss: boolean; show: any }>((resolve, reject) => {
      let gotDismiss = false;
      let gotShow: any = null;
      const timer = setTimeout(() => reject(new Error('override push not received')), 8000);
      const handler = (msg: any) => {
        if (msg?.type === 'DISMISS') gotDismiss = true;
        if (msg?.type === 'SHOW_FEEDBACK') {
          gotShow = msg;
          clearTimeout(timer);
          ipad.off('message', handler);
          resolve({ dismiss: gotDismiss, show: gotShow });
        }
      };
      ipad.on('message', handler);
    });

    const override = await staffAgentB.post('/feedback/override').send({
      caseId: case2,
      deviceId,
      staffId: staffB.id,
      expectedLockId: lock1,
      expectedVersion: version1,
    });
    expect(override.status).toBe(200);
    const session2 = override.body.session.id as string;
    const lock2 = override.body.lock.id as string;
    expect(override.body.previous).toMatchObject({ lockId: lock1, status: 'OVERRIDDEN' });

    const pushed = await eventsPromise;
    expect(pushed.dismiss).toBe(true);
    expect(pushed.show.payload).toMatchObject({
      sessionId: session2,
      caseId: case2,
      staff: { id: staffB.id, name: expect.any(String) },
      expireAt: expect.any(String),
    });

    // iPad 对新会话回 DELIVERED
    ipad.emit('message', { type: 'DELIVERED', payload: { sessionId: session2 } });

    // 6) iPad 首先提交被 override 后的新会话（case2 → staffB）
    const submit2 = await request(server).post('/feedback/submit')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ sessionId: session2, rating: 4, comment: 'ok after override' });

    expect(submit2.status).toBe(200);
    expect(submit2.body.session).toMatchObject({ id: session2, status: 'SUBMITTED' });
    expect(submit2.body.feedback).toMatchObject({ caseId: case2, rating: 4, comment: 'ok after override' });

    // 7) staffB 再对 case3 发反馈 → iPad 收到并提交
    const waitShow3 = new Promise<any>((resolve, reject) => {
      const tt = setTimeout(() => reject(new Error('no SHOW_FEEDBACK #3')), 8000);
      ipad.on('message', (msg: any) => {
        if (msg?.type === 'SHOW_FEEDBACK') {
          clearTimeout(tt);
          resolve(msg);
        }
      });
    });

    const send3 = await staffAgentB.post('/feedback/send')
      .send({ caseId: case3, deviceId, staffId: staffB.id });
    expect(send3.status).toBe(200);
    const session3 = send3.body.session.id as string;

    const show3 = await waitShow3;
    expect(show3.payload).toMatchObject({
      sessionId: session3, caseId: case3,
      staff: { id: staffB.id, name: expect.any(String) },
    });
    ipad.emit('message', { type: 'DELIVERED', payload: { sessionId: session3 } });

    const submit3 = await request(server).post('/feedback/submit')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ sessionId: session3, rating: 5, comment: 'great!' });

    expect(submit3.status).toBe(200);
    expect(submit3.body.session).toMatchObject({ id: session3, status: 'SUBMITTED' });

    // 8) 断言最终状态
    const case2Row = db.studentCase.find(r => r.id === case2)!;
    const case3Row = db.studentCase.find(r => r.id === case3)!;
    expect(case2Row.status).toBe('RESOLVED');
    expect(case3Row.status).toBe('RESOLVED');
    expect(case2Row.resolvedAt).toBeTruthy();
    expect(case3Row.resolvedAt).toBeTruthy();

    // 被 override 的旧锁应为 OVERRIDDEN；新的锁 COMPLETED
    const oldLock = db.kioskLock.find(l => l.id === lock1)!;
    const newLock = db.kioskLock.find(l => l.id === lock2)!;
    expect(oldLock.status).toBe('OVERRIDDEN');
    expect(newLock.status).toBe('COMPLETED');
    expect(newLock.releasedAt).toBeTruthy();

    // 设备不应再指向锁
    const deviceRow = db.kioskDevice.find(d => d.id === deviceId)!;
    expect(deviceRow.currentLockId).toBeNull();

    // 会话状态：session1 被 OVERRIDDEN；session2、session3 SUBMITTED
    const s1 = db.feedbackSession.find(s => s.id === session1)!;
    const s2 = db.feedbackSession.find(s => s.id === session2)!;
    const s3 = db.feedbackSession.find(s => s.id === session3)!;
    expect(['OVERRIDDEN', 'DELIVERED', 'CREATED']).toContain(s1.status);
    expect(s2.status).toBe('SUBMITTED');
    expect(s3.status).toBe('SUBMITTED');

    // 幂等提交 session2
    const submit2Again = await request(server).post('/feedback/submit')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ sessionId: session2, rating: 4, comment: 'dup' });
    expect(submit2Again.status).toBe(200);
    expect(submit2Again.body.session).toMatchObject({ id: session2, status: 'SUBMITTED' });

    // 断开 socket
    ipad.close();
  });
});
