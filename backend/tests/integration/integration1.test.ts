/**
 * End-to-End Integration (with real WebSocket) — Azure SSO 版
 * 设备创建 Case → Staff 接单 → 发反馈 → iPad 经 Socket 收到并回 DELIVERED
 * → iPad（设备鉴权）HTTP 提交反馈 → Case RESOLVED、Lock COMPLETED、Device 清空 currentLockId
 */

import http from 'http';
import request from 'supertest';
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
    // 旧 JWT 保留无妨（本测不用）
    JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret-123',
  };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

/* ===================== 仅 Mock Prisma：内存实现（支持 identityKey） ===================== */

type StaffRow = {
  id: string;
  identityKey: string; // 新增：attachReqUser 依据它查/建
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
      const sel = args?.select;
      if (sel) {
        const out: any = {};
        for (const k of Object.keys(sel)) if (sel[k]) out[k] = (row as any)[k];
        return out;
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

// 注入 prisma mock
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));

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
  // 1) /device/ws-token（设备鉴权）
  const r = await request(server)
    .post('/device/ws-token')
    .set({ Authorization: `Device ${deviceId}:${deviceSecret}` })
    .send();

  expect(r.status).toBe(200);
  const { deviceToken } = r.body;
  expect(deviceToken).toBeTruthy();

  // 2) 连接 socket
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

describe('Integration | E2E feedback via real WebSocket (Azure SSO)', () => {
  const staffId = 'staff-1';
  const staffIdentityKey = 'iss|sub'; // 与 mock-login 对齐
  const employeeNo = 'S001';

  const deviceId = 'dev-1';
  const deviceSecret = 'super-secret';
  const deviceHash = sha256(deviceSecret);

  // 员工端使用 agent 维持 cookie 会话
  let staffAgent: request.SuperTest<request.Test>;

  beforeEach(async () => {
    db.staff.length = 0;
    db.studentCase.length = 0;
    db.kioskDevice.length = 0;
    db.kioskLock.length = 0;
    db.feedbackSession.length = 0;
    db.feedback.length = 0;

    jest.clearAllMocks();

    // 种子员工（identityKey 对齐）
    await prismaMock.staff.create({
      data: {
        id: staffId,
        identityKey: staffIdentityKey,
        employeeNo,
        name: 'Sam Staff',
        email: 'sam@test.local',
        password: 'x',
        role: 'STAFF',
      },
    });

    // 种子设备
    await prismaMock.kioskDevice.create({
      data: {
        id: deviceId,
        name: 'iPad-1',
        secretHash: deviceHash,
        mode: 'DUAL',
        lastSeenAt: new Date(),
      },
    });

    // 建立员工会话
    staffAgent = request.agent(server) as unknown as request.SuperTest<request.Test>;
    const login = await staffAgent.post('/auth/__test/mock-login').send({
      identityKey: staffIdentityKey,
      tid: 'TENANT-OK',
      upn: 'sam@test.local',
      name: 'Sam Staff',
    });
    expect(login.status).toBe(200);

    // 可选：确认会话
    const me = await staffAgent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user?.identityKey).toBe(staffIdentityKey);
  });

  it('Device creates case → Staff takes → send feedback → iPad receives+DELIVERED → iPad submits → case resolved', async () => {
    // 1) 设备创建 Case（登记）
    const createCase = await request(server)
      .post('/cases')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ studentName: 'Alice', category: 'Academic' });

    expect(createCase.status).toBe(201);
    const caseId: string = createCase.body.id;

    // 2) Staff 查看队列并接单（使用 cookie 会话；status 大写）
    const listQueued = await staffAgent.get('/cases?status=QUEUED');
    expect(listQueued.status).toBe(200);
    expect(listQueued.body.map((c: any) => c.id)).toContain(caseId);

    const takeRes = await staffAgent.post(`/cases/${caseId}/take`).send();
    expect(takeRes.status).toBe(200);
    expect(takeRes.body).toMatchObject({ id: caseId, status: 'IN_PROGRESS', staffId });

    // 3) 启动 iPad WebSocket 客户端
    const { socket: ipad, waitForPing } = await connectIpadClient(deviceId, deviceSecret);
    await waitForPing();

    // 监听 SHOW_FEEDBACK
    const receivedShow = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no SHOW_FEEDBACK received')), 8000);
      iPadOn();
      function iPadOn() {
        ipad.on('message', (msg: any) => {
          if (msg?.type === 'SHOW_FEEDBACK') {
            clearTimeout(timer);
            resolve(msg);
          }
        });
      }
    });

    // 4) Staff 发送反馈
    const sendRes = await staffAgent.post('/feedback/send').send({ caseId, deviceId, staffId });
    expect(sendRes.status).toBe(200);
    const sessionId = sendRes.body.session.id;
    expect(sessionId).toBeTruthy();

    // 5) iPad 收到并回 DELIVERED
    const showMsg = await receivedShow;
    expect(showMsg.payload).toMatchObject({
      sessionId,
      caseId,
      staff: { id: staffId, name: expect.any(String) },
      expireAt: expect.any(String),
    });
    ipad.emit('message', { type: 'DELIVERED', payload: { sessionId } });

    // 6) iPad（设备鉴权）HTTP 提交反馈
    const submitRes = await request(server)
      .post('/feedback/submit')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ sessionId, rating: 5, comment: 'Great service!' });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.session).toMatchObject({ id: sessionId, status: 'SUBMITTED' });
    expect(submitRes.body.feedback).toMatchObject({ caseId, rating: 5, comment: 'Great service!' });

    // 7) 校验最终状态
    const caseRow = db.studentCase.find(r => r.id === caseId)!;
    expect(caseRow.status).toBe('RESOLVED');
    expect(caseRow.resolvedAt).toBeTruthy();

    const lockRow = db.kioskLock.find(l => l.caseId === caseId && l.deviceId === deviceId)!;
    expect(lockRow.status).toBe('COMPLETED');
    expect(lockRow.releasedAt).toBeTruthy();

    const deviceRow = db.kioskDevice.find(d => d.id === deviceId)!;
    expect(deviceRow.currentLockId).toBeNull();

    // 8) 幂等：再次提交
    const submitAgain = await request(server)
      .post('/feedback/submit')
      .set(deviceAuth(deviceId, deviceSecret))
      .send({ sessionId, rating: 5, comment: 'duplicate' });

    expect(submitAgain.status).toBe(200);
    expect(submitAgain.body.session).toMatchObject({ id: sessionId, status: 'SUBMITTED' });
    expect(submitAgain.body.feedback.caseId).toBe(caseId);

    ipad.close();
  });
});
