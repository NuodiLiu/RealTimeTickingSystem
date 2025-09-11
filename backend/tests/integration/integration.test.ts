/**
 * 集成测试：设备创建 Case，员工查看/接单/FIFO 接单/解决 Case（SSO 版本）
 * - 员工认证：通过 test-only /auth/__test/mock-login 注入 cookie-session
 * - 设备认证：仍用 requireDevice（Device <id>:<secret>）
 * - 仅 mock prisma（内存实现），不 mock 其它 helper/middleware。
 */

import request from "supertest";
import crypto from "crypto";

// -------------------- 环境变量 --------------------
const ORIGINAL_ENV = process.env;
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    // cookie-session 需要
    SESSION_KEYS: "k1,k2",
    // 你如果启用了 requireTenant，这里给个固定 tenant
    AZURE_AD_TENANT_ID: "TENANT-OK",
    // 其它环境项（可能被代码使用）
    FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || "http://localhost:3001",
    API_BASE_URL: ORIGINAL_ENV.API_BASE_URL || "http://localhost:3000",
    WS_BASE_URL: ORIGINAL_ENV.WS_BASE_URL || "ws://localhost:3000",
    // 若项目里仍存在旧 JWT 路径也不影响（本测试不用）
    JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || "test-secret-123",
  };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// -------------------- Prisma 内存 Mock --------------------
type StaffRow = {
  id: string;
  identityKey: string; // 关键：attachReqUser 按这个查
  employeeNo: string;
  name: string;
  email: string | undefined;
  password: string;
  role: "STAFF" | "ADMIN";
  createdAt: Date;
};

type StudentCaseRow = {
  id: string;
  studentName: string;
  category: string;
  status: "QUEUED" | "IN_PROGRESS" | "RESOLVED_PENDING_FEEDBACK" | "RESOLVED";
  staffId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type KioskDeviceRow = {
  id: string;
  name: string;
  secretHash: string;
  mode: "REGISTRATION" | "FEEDBACK";
  lastSeenAt: Date;
  currentLockId: string | null;
};

const db = {
  staff: [] as StaffRow[],
  studentCase: [] as StudentCaseRow[],
  kioskDevice: [] as KioskDeviceRow[],
};

function cuid() {
  return "c" + crypto.randomBytes(8).toString("hex");
}

const prismaMock = {
  staff: {
    findUnique: jest.fn(async (args: any) => {
      const w = args?.where ?? {};
      if (w.id) return db.staff.find((s) => s.id === w.id) || null;
      if (w.employeeNo) return db.staff.find((s) => s.employeeNo === w.employeeNo) || null;
      if (w.identityKey) return db.staff.find((s) => s.identityKey === w.identityKey) || null;
      return null;
    }),
    findFirst: jest.fn(async (args: any) => {
      const w = args?.where ?? {};
      if (w.employeeNo) return db.staff.find((s) => s.employeeNo === w.employeeNo) || null;
      if (w.identityKey) return db.staff.find((s) => s.identityKey === w.identityKey) || null;
      return null;
    }),
    create: jest.fn(async (args: any) => {
      const d = args?.data || {};
      const row: StaffRow = {
        id: d.id ?? cuid(),
        identityKey: d.identityKey ?? "iss|sub",
        employeeNo: d.employeeNo ?? `ext-${cuid().slice(1, 8)}`,
        name: d.name ?? "NoName",
        email: d.email,
        password: d.password ?? "",
        role: d.role ?? "STAFF",
        createdAt: new Date(),
      };
      db.staff.push(row);
      return row;
    }),
    // 可选：支持 attachReqUser 优化版的 upsert
    upsert: jest.fn(async (args: any) => {
      const w = args?.where || {};
      let row = db.staff.find((s) => s.identityKey === w.identityKey);
      if (!row) {
        const d = args?.create || {};
        row = {
          id: d.id ?? cuid(),
          identityKey: d.identityKey,
          employeeNo: d.employeeNo ?? `ext-${cuid().slice(1, 8)}`,
          name: d.name ?? "New User",
          email: d.email,
          password: "",
          role: d.role ?? "STAFF",
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
    create: jest.fn(async (_args: any) => ({
      id: cuid(),
      staffId: _args?.data?.staffId,
      refreshHash: _args?.data?.refreshHash,
      ua: _args?.data?.ua ?? "",
      ip: _args?.data?.ip ?? "",
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
      const d = args?.data;
      const row: StudentCaseRow = {
        id: cuid(),
        studentName: d.studentName,
        category: d.category,
        status: "QUEUED",
        staffId: null,
        createdAt: new Date(),
        resolvedAt: null,
      };
      db.studentCase.push(row);
      return row;
    }),
    findMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const status = where.status as StudentCaseRow["status"] | undefined;
      let rows = [...db.studentCase];
      if (status) rows = rows.filter((r) => r.status === status);
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
        const ok = (!where.id || where.id === r.id) && (!where.status || where.status === r.status);
        if (ok) {
          if (data.status) r.status = data.status;
          if (Object.prototype.hasOwnProperty.call(data, "staffId")) r.staffId = data.staffId ?? null;
          if (Object.prototype.hasOwnProperty.call(data, "resolvedAt")) r.resolvedAt = data.resolvedAt ?? null;
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
        const e: any = new Error("Not found");
        e.code = "P2025";
        throw e;
      }
      if (data.status) row.status = data.status;
      if (Object.prototype.hasOwnProperty.call(data, "resolvedAt")) row.resolvedAt = data.resolvedAt ?? null;
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
      const where = args?.where ?? {};
      if (where?.id) return db.kioskDevice.find((d) => d.id === where.id) || null;
      return db.kioskDevice[0] || null;
    }),
    update: jest.fn(async (args: any) => {
      const id = args?.where?.id;
      const data = args?.data ?? {};
      const row = db.kioskDevice.find((d) => d.id === id);
      if (!row) throw new Error("Device not found");
      if (data.lastSeenAt) row.lastSeenAt = data.lastSeenAt;
      if (Object.prototype.hasOwnProperty.call(data, "currentLockId")) row.currentLockId = data.currentLockId ?? null;
      return row;
    }),
    updateMany: jest.fn(async (_args: any) => ({ count: 1 })),
    create: jest.fn(async (args: any) => {
      const d = args?.data ?? {};
      const row: KioskDeviceRow = {
        id: d.id ?? cuid(),
        name: d.name ?? "Kiosk",
        secretHash: d.secretHash ?? "",
        mode: d.mode ?? "DUAL",
        lastSeenAt: d.lastSeenAt ?? new Date(),
        currentLockId: null,
      };
      db.kioskDevice.push(row);
      return row;
    }),
  },

  // 占位
  invite: { create: jest.fn() },
  feedback: { create: jest.fn(), findUnique: jest.fn() },
  kioskLock: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  feedbackSession: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  pairingSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

// 挂到模块系统
jest.mock("../../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

// 必须在 mock 之后再引入 app
import app from "../../src/server";

// -------------------- 测试工具 --------------------
function makeDeviceAuthHeader(deviceId: string, deviceSecret: string) {
  return { Authorization: `Device ${deviceId}:${deviceSecret}` };
}

// -------------------- 用例 --------------------
describe("Integration | Cases flow (device + staff, Azure SSO)", () => {
  const staffId = "staff-1";
  const staffIdentityKey = "iss|sub"; // 和 mock-login 对齐
  const employeeNo = "S001";
  const deviceId = "dev-1";
  const deviceSecret = "super-secret";
  const deviceSecretHash = crypto.createHash("sha256").update(deviceSecret).digest("hex");

  // 用 agent 维持 cookie（员工侧请求都用它）
  const agent = request.agent(app);

  beforeEach(async () => {
    db.staff.length = 0;
    db.studentCase.length = 0;
    db.kioskDevice.length = 0;
    jest.clearAllMocks();

    // 种子员工（与 mock-login 的 identityKey 对齐，便于 attachReqUser 命中）
    await prismaMock.staff.create({
      data: {
        id: staffId,
        identityKey: staffIdentityKey,
        employeeNo,
        name: "Sam Staff",
        email: "sam@test.local",
        password: "x",
        role: "STAFF",
      },
    });

    // 种子设备
    await prismaMock.kioskDevice.create({
      data: {
        id: deviceId,
        name: "iPad 1",
        secretHash: deviceSecretHash,
        mode: "DUAL",
        lastSeenAt: new Date(),
      },
    });

    // 注入 SSO 会话（等价于用户已在浏览器完成微软登录）
    await agent.post("/auth/__test/mock-login").send({
      identityKey: staffIdentityKey,
      tid: "TENANT-OK",
      upn: "sam@test.local",
      name: "Sam Staff",
    });
  });

  it("Device creates case → Staff lists queued → Staff take → FIFO take-next → Staff resolve", async () => {
    // 1) 设备创建两条 Case
    const c1 = await request(app)
      .post("/cases")
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({ studentName: "Alice", category: "Academic" });
    expect(c1.status).toBe(201);
    const caseId1 = c1.body.id;

    const c2 = await request(app)
      .post("/cases")
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({ studentName: "Bob", category: "Financial" });
    expect(c2.status).toBe(201);
    const caseId2 = c2.body.id;

    // 2) 员工查看队列（cookie 会话）
    const list = await agent.get("/cases?status=queued");
    expect(list.status).toBe(200);
    expect(list.body.map((c: any) => c.studentName)).toEqual(["Alice", "Bob"]);

    // 3) 员工接第一条
    const take = await agent.post(`/cases/${caseId1}/take`).send();
    expect(take.status).toBe(200);
    expect(take.body).toMatchObject({ id: caseId1, status: "IN_PROGRESS", staffId });

    // 4) FIFO 接单（应拿到第二条 Bob）
    const takeNext = await agent.post(`/cases/take-next`).send();
    expect(takeNext.status).toBe(200);
    expect(takeNext.body).toMatchObject({ id: caseId2, status: "IN_PROGRESS", staffId });

    // 5) 解决第一条
    const resolve = await agent.post(`/cases/${caseId1}/resolve`).send();
    expect(resolve.status).toBe(200);
    expect(resolve.body.id).toBe(caseId1);
    expect(resolve.body.status).toBe("RESOLVED");
    expect(resolve.body.resolvedAt).toBeTruthy();

    // 最终数据库状态
    const row1 = db.studentCase.find((r) => r.id === caseId1)!;
    const row2 = db.studentCase.find((r) => r.id === caseId2)!;
    expect(row1.status).toBe("RESOLVED");
    expect(row1.staffId).toBe(staffId);
    expect(row1.resolvedAt).not.toBeNull();
    expect(row2.status).toBe("IN_PROGRESS");
    expect(row2.staffId).toBe(staffId);
  });

  it("Device auth fails with wrong secret", async () => {
    const bad = await request(app)
      .post("/cases")
      .set(makeDeviceAuthHeader(deviceId, "WRONG-SECRET"))
      .send({ studentName: "Carol", category: "General" });
    expect(bad.status).toBe(401);
  });

  it("Staff guard works (missing session => 401)", async () => {
    // 清空 agent 的会话
    await agent.post("/auth/__test/clear").send();
    const res = await agent.get("/cases?status=queued");
    expect(res.status).toBe(401);
  });

  it("Validation: missing fields -> 4xx", async () => {
    const res = await request(app)
      .post("/cases")
      .set(makeDeviceAuthHeader(deviceId, deviceSecret))
      .send({}); // 缺少必填
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
