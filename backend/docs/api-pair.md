# Pair API 详细文档

设备配对流程：Staff 在 portal 上生成二维码 → iPad/Kiosk 扫码并调 `/pair/complete` 把自己注册成 `KioskDevice`，同时拿到 `apiKey`（HTTP）与 `wsToken`（SignalR/WebSocket）。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:203](../src/expressApp.ts#L203) → `app.use("/pair", pairRouter)`
- 路由：[backend/src/routers/pair.router.ts](../src/routers/pair.router.ts)
- 控制器：[backend/src/controllers/pair.controller.ts](../src/controllers/pair.controller.ts)
- 业务逻辑：[backend/src/services/pair.service.ts](../src/services/pair.service.ts)
- 中间件：
  - `requireJWTAuth`（[backend/src/middlewares/jwt-auth.middleware.ts:135](../src/middlewares/jwt-auth.middleware.ts#L135)）—— 验 staff App JWT
  - `requireStaff`（[backend/src/middlewares/auth.middleware.ts:43](../src/middlewares/auth.middleware.ts#L43)）—— 角色 ≥ STAFF
- 相关 DB 模型：
  - `PairingSession`（[prisma/schema.prisma:154](../prisma/schema.prisma#L154)）—— 配对会话
  - `KioskDevice`（[prisma/schema.prisma:94](../prisma/schema.prisma#L94)）—— 设备

### 数据模型

**PairingSession**
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | cuid | PK |
| `pairingToken` | string, **unique** | 64 hex 字符（32 字节），写进二维码 |
| `deviceId` | string? | 配对完成后回填 |
| `status` | string | `'PENDING' / 'COMPLETED'`（注意是字符串列，不是 enum） |
| `expiresAt` | DateTime | 5 分钟后过期 |
| `completedAt` | DateTime? | 完成时间戳 |
| `createdAt` | DateTime | 默认 now() |

**KioskDevice**
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | cuid | PK，作为 `apiKey` 的前半段 |
| `name` | string | 设备显示名（不在 schema 层 unique，本服务靠业务逻辑去重） |
| `secretHash` | string | sha256(deviceSecret) 的 hex |
| `mode` | enum | `REGISTRATION / FEEDBACK` |
| `isConnected` | bool | SignalR/HTTP 在线状态 |
| `lastSeenAt` | DateTime | 心跳/请求时间 |
| `deletedAt` | DateTime? | 软删除标记 |

### Token / Credential 体系
| 凭据 | 持有方 | 用途 | 签发处 |
|---|---|---|---|
| `pairingToken` | QR code | 一次性换设备凭据 | `PairService.generateQR` |
| `apiKey = deviceId:deviceSecret` | 设备本地 | 调 HTTP API（`Authorization: Device …`）| `completePairing` 返回 |
| `wsToken`（device JWT）| 设备本地 | 建 SignalR/WebSocket 连接 | `signDeviceToken` [auth.ts:22](../src/lib/utils/auth.ts#L22) |

> ⚠️ `deviceSecret` 明文**只在 `/pair/complete` 响应里返回这一次**，DB 只存 sha256。设备必须自己持久化。

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **`completePairing` 没有事务包裹**（[pair.service.ts:46-187](../src/services/pair.service.ts#L46-L187)） | Step 4（device upsert）和 Step 6（session 状态切换）之间任一失败，会留下"设备已建/已刷新但 session 仍 PENDING"的状态 | 用 `prisma.$transaction([...])` 把这两步包起来 |
| 2 | **`pairingToken` 不是真正的一次性令牌** | Step 6 把 session 改 COMPLETED 之前，重复 POST 同一 token 会进入 Path B/C 重复创建/更新设备；token 在 5min 内仍可被反复用 | 用 CAS：`updateMany where { status:'PENDING' } data { status:'COMPLETED' }`，`count===0` 即视为已被消费 |
| 3 | **`deviceSecret` 明文只返一次**（[pair.service.ts:178-186](../src/services/pair.service.ts#L178-L186)） | 设备丢失 secret 只能重新配对（必须重新生成 QR） | iPad 端必须立即持久化 + 容错；UI 上向 staff 说明 |
| 4 | **dev test token `'test-token-123'` 写死**（[pair.service.ts:24-36](../src/services/pair.service.ts#L24-L36)），仅看 `NODE_ENV==='development'` | staging/preview 环境若 `NODE_ENV !== 'production'`，会自动 upsert + 永远可重用 | 部署 staging 时确认 `NODE_ENV === 'production'`；或把"test token enable"独立为显式环境变量 |
| 5 | **软删除设备无法通过配对复活**（Path A，[pair.service.ts:107-120](../src/services/pair.service.ts#L107-L120)） | 即使带 `deviceId` 也会 400；UX 上 staff 删了设备就找不回 | 决策：是否新增"恢复设备"接口（解除 `deletedAt` 即可），或就此 by design |
| 6 | **`device:paired` SignalR 通知 fire-and-forget**（[pair.service.ts:169-176](../src/services/pair.service.ts#L169-L176)） | SignalR 不可用时配对仍成功，但 dashboard 不会实时更新 | dashboard 自身建议有 polling 兜底；本接口逻辑无需改 |
| 7 | **`KioskDevice.name` 在 DB 层不 unique** | 本服务靠 Path B 的"同名复用"去重；绕过本接口直接写 DB 可能造成重名设备 | 是否在 schema 层加 `@@unique([name, deletedAt])`？需要权衡 |
| 8 | **响应里的 `wsEndpoint` 是旧 WebSocket 路径 `/ws`**（[pair.service.ts:185](../src/services/pair.service.ts#L185)） | 实际项目用 Azure SignalR 协商 `/api/signalr/device/connect`；该字段可能误导 iPad | 确认 iPad 现在用哪条路径；如果是 SignalR，可直接删字段或改返 negotiate URL |
| 9 | **`PairingSession` 行不会自动清理** | 每次 `/pair/generate-qr` 都写一行，5min 过期但不删；表会无限增长 | 加 cron / Azure Function 定时清理 `WHERE expiresAt < now() - INTERVAL '7 days'` |
| 10 | **`/pair/complete` 无鉴权 by design** | 设备首次配对时还没有任何凭据，靠 pairingToken（一次性 5min）+ staff 持 QR 来保护 | 不动；但务必把上面 #1、#2 修了，因为这是"安全靠的就是 token 一次性"的前提 |
| 11 | **`mode` 入参默认 `'REGISTRATION'`，无白名单校验** | 传非法字符串会到 Prisma enum 才报错（500 而不是 422） | controller 层加 `if (mode && !validModes.includes(mode))` |
| 12 | **`pairingSession.status` 是字符串列不是 enum**（[schema.prisma:158](../prisma/schema.prisma#L158)） | 拼写错误不会被 schema 层挡住 | 改为 Prisma enum `PairingSessionStatus { PENDING COMPLETED EXPIRED }` |

---

## 1. `POST /pair/generate-qr`

Staff 在 portal 点"生成二维码"按钮触发。

源码：
- 路由：[pair.router.ts:12](../src/routers/pair.router.ts#L12)
- 控制器：[pair.controller.ts:30-37](../src/controllers/pair.controller.ts#L30-L37)
- 服务：[pair.service.ts:10-43](../src/services/pair.service.ts#L10-L43)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Body：无

### 鉴权链
```
requireJWTAuth → 校验 App JWT、查 staff、写 req.user
requireStaff   → req.user.role ∈ {STAFF, ADMIN}
```

### 业务逻辑（顺序）
```
1. pairingToken = crypto.randomBytes(32).toString('hex')    // 64 字符
2. expiresAt    = now + 5 min
3. INSERT pairing_session { pairingToken, expiresAt, status:'PENDING' }

4. （仅 development 环境）upsert 'test-token-123'
   expiresAt = now + 1h, status = PENDING
   —— 便于本地反复扫同一码调试

5. apiBase = BASE_URL ?? 'http://localhost:3000'
   qrData  = { pairingToken, apiEndpoint: apiBase }
   qrUrl   = `${apiBase}/pair?data=${encodeURIComponent(JSON.stringify(qrData))}`

6. 200 { qrUrl, pairingToken, sessionId, expiresAt }
```

### 分支汇总
| 场景 | 触发 | 输出 |
|---|---|---|
| 未登录 | 缺 Bearer/JWT 无效 | 401（`requireJWTAuth`） |
| 非 Staff/Admin | role 不够 | 403 `ForbiddenRoleError` |
| 成功 | 正常路径 | `200 { qrUrl, pairingToken, sessionId, expiresAt }` |
| 异常 | DB 失败 | 500，走全局 errorHandler |

### ⚠️ 迁移注意
1. **没有删除/限频**：每次请求都会写一条新的 `pairingSession`，5 分钟后才过期，但行不会自动删，需要后续定期清理 job。迁移前考虑加 TTL/清理。
2. `qrUrl` 的格式是 `${apiBase}/pair?data=<json>`。该路径**后端没有挂处理器**——它只是一个让 iPad app 解析的 URI 模板。iPad app 内部需要 parse `data` 拿到 `pairingToken` 和 `apiEndpoint`。
3. dev 模式的 `test-token-123` 写死在代码里。生产 (`NODE_ENV=production`) 下不会创建，安全。

---

## 2. `POST /pair/complete`

iPad/Kiosk 扫码后调用此接口注册自己。**整个系统的设备注册唯一入口**。

源码：
- 路由：[pair.router.ts:9](../src/routers/pair.router.ts#L9)
- 控制器：[pair.controller.ts:40-47](../src/controllers/pair.controller.ts#L40-L47)
- 服务：[pair.service.ts:46-187](../src/services/pair.service.ts#L46-L187)

### 入参（JSON body）
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pairingToken` | string | ✅ | 从二维码扫出来的 token |
| `deviceName` | string | ✅ | 设备显示名 |
| `mode` | `'REGISTRATION' \| 'FEEDBACK'` | 否 | 默认 `REGISTRATION` |
| `deviceId` | string | 否 | 有值 = 重配旧设备；无值 = 走 name 去重逻辑 |

### 鉴权
**无鉴权**（[pair.router.ts:9](../src/routers/pair.router.ts#L9) 直接挂到 controller）。
这是 by-design——设备首次配对时还没有任何凭据。安全靠 `pairingToken`（一次性、5 分钟过期）与 staff 的 QR 持有权。

### 业务逻辑（完整流程图）

```
─────────────────────────────────────────────────────────────────────────
Step 1: 校验必填
  缺 pairingToken / deviceName
    → throw MissingFieldError(['pairingToken','deviceName'])
    → 400

─────────────────────────────────────────────────────────────────────────
Step 2: 查 pairingSession
  session = prisma.pairingSession.findUnique({ pairingToken })
  isTestToken = (NODE_ENV==='development' && pairingToken==='test-token-123')

  2a. session 不存在
        isTestToken == true
          → 自动 create 一条 test-token-123，expiresAt = now+1h
        else
          → throw BadRequestError('Invalid or expired pairing token') → 400

  2b. session 存在
        isTestToken == true 且 (status=='COMPLETED' || 已过期)
          → UPDATE session set status='PENDING', deviceId=NULL,
                                completedAt=NULL, expiresAt=now+1h
                                (重置为可重用)
        isTestToken == false 且 (expiresAt < now || status != 'PENDING')
          → throw BadRequestError('Invalid or expired pairing token') → 400

─────────────────────────────────────────────────────────────────────────
Step 3: 生成设备凭据
  deviceSecret = crypto.randomBytes(32).toString('hex')   // 64 字符
  secretHash   = sha256(deviceSecret).hex()

─────────────────────────────────────────────────────────────────────────
Step 4: 写入 / 复用 KioskDevice  —— 三个分支
  ──────────────────────────────────────────────────
  Path A: body 带 deviceId（"重配旧设备"显式路径）
    existing = prisma.kioskDevice.findUnique({ id: deviceId })
    if (existing && !existing.deletedAt):
      UPDATE kioskDevice set
        name = deviceName,
        secretHash = new,
        mode = mode,
        lastSeenAt = now
    else:
      throw BadRequestError('Device not found or has been deleted') → 400
      ⚠️ 注意：即使是软删除（deletedAt != null），也会被拒绝；如果想"恢复"必须先在 DB 改 deletedAt=null。
  ──────────────────────────────────────────────────
  Path B: 无 deviceId，但同名设备存在（!deletedAt）
    existing = prisma.kioskDevice.findFirst({ name: deviceName, deletedAt: null })
    if (existing):
      UPDATE 该 device，secretHash/mode/lastSeenAt 更新
      ⚠️ name **不更新**（已经一样了），id 不变 —— 这是"同名重新配对"的路径
  ──────────────────────────────────────────────────
  Path C: 无 deviceId 且同名不存在
    INSERT 新 kioskDevice { name, secretHash, mode, lastSeenAt: now }
  ──────────────────────────────────────────────────

─────────────────────────────────────────────────────────────────────────
Step 5: 签发 WebSocket / SignalR token
  wsToken = signDeviceToken(device.id, mode)
    payload: { typ:'device', sub:deviceId, mode }
    expiresIn: '30d'

─────────────────────────────────────────────────────────────────────────
Step 6: 更新 pairingSession（test token 除外）
  if (!isTestToken):
    UPDATE pairing_session set
      status      = 'COMPLETED',
      deviceId    = device.id,
      completedAt = now
  else:
    保留 PENDING / 可再次使用

─────────────────────────────────────────────────────────────────────────
Step 7: 推 SignalR Dashboard 事件
  SignalRGateway.notifyDashboard({
    type: 'device:paired',
    payload: { deviceId, deviceName, mode }
  })
  —— 该调用是 fire-and-forget，失败不会回滚 DB

─────────────────────────────────────────────────────────────────────────
Step 8: 返回 201
  {
    deviceId,
    deviceSecret,                     // 明文！只在这次返回
    apiKey: `${deviceId}:${deviceSecret}`,
    wsToken,                          // device JWT
    deviceName: device.name,
    mode: device.mode,
    wsEndpoint: `${WS_BASE_URL || 'ws://localhost:3000'}/ws`
  }
```

### 分支汇总表
| # | 场景 | 触发条件 | 行为/响应 |
|---|---|---|---|
| 1 | 缺字段 | 无 `pairingToken` 或 `deviceName` | 400 `MissingFieldError` |
| 2 | token 无效（生产） | `findUnique` 返 null | 400 'Invalid or expired pairing token' |
| 3 | token 自动创建（dev） | `test-token-123` 且未在表里 | 自动 create，继续流程 |
| 4 | token 过期/已用（生产） | `expiresAt < now` 或 `status != PENDING` | 400 |
| 5 | test token 重用（dev） | `test-token-123` 且过期/已完成 | 重置为 PENDING + 续期，继续流程 |
| 6 | 重配指定 deviceId 成功 | body 带 deviceId 且活跃 | UPDATE 设备，apiKey 全新 |
| 7 | 重配 deviceId 失败 | 不存在或已软删 | 400 'Device not found or has been deleted' |
| 8 | 同名重新配对 | 无 deviceId，name 命中活跃记录 | UPDATE 该设备 |
| 9 | 全新设备 | 无 deviceId 且无同名 | INSERT 新 device |
| 10 | 成功 | 任一 path 完成 | 201 + 设备凭据；Dashboard 收到 `device:paired` 事件 |
| 11 | 异常 | DB/SignalR 异常 | 500，错误冒泡到全局 handler |

### ⚠️ 迁移/接手前必看
1. **没有事务包裹**：Step 2 ~ Step 7 不在一个 Prisma `$transaction` 里。如果 Step 6（更新 pairingSession）失败，设备已经创建/更新，但 session 仍 PENDING；token 在 5min 内仍可被再次提交，会再 Path B 命中同名走"重配"路径。建议迁移时用 `$transaction([...])` 把 Step 4 + Step 6 包起来。
2. **`deviceSecret` 明文只返一次**：设备端必须立即持久化；丢了只能重新配对。
3. **`pairingToken` 不一次性失效**：在 Step 6 之前如果重复 POST 同一 token，由于 session 还在 PENDING，会进入 Path B/C 重复创建/更新设备。建议加幂等性（比如把 Step 2 的状态切换提前 + 用 `updateMany where status=PENDING` 做 CAS）。
4. **`isTestToken` 仅看 `NODE_ENV==='development'`**：staging 用什么 NODE_ENV 必须确认，免得测试 token 误用在准生产。
5. **Path A 的"已软删除"会被拒**：UX 上要注意——设备被 staff 删除后，即便扫旧码、即便提供 deviceId 也无法直接复活，必须建新设备。
6. **`device:paired` 事件 fire-and-forget**：dashboard 实时性依赖 SignalR；若服务暂时不可用，配对仍成功，dashboard 拉新列表才能感知。
7. **`name` 不在 DB 层 unique**：本接口的"同名复用"是业务级保护，绕过本接口（直接写 DB）可能造成重名。
8. **`wsEndpoint` 硬编码 `/ws`**：实际项目走 Azure SignalR 时，设备应该走 `/api/signalr/device/connect` 协商；这里返回的 `wsEndpoint` 是旧 WebSocket 路径，需要确认前端是否仍依赖（或废弃）。

---

## 端到端时序

```
Staff Portal                Backend                  iPad/Kiosk            DB                Dashboard (SignalR)
   │                            │                         │                  │                      │
   │ POST /pair/generate-qr     │                         │                  │                      │
   │ ─────────────────────────► │ INSERT pairingSession ─────────────────────►                      │
   │ ◄── 200 { qrUrl, token }   │                         │                  │                      │
   │                            │                         │                  │                      │
   │ (显示二维码)               │                         │                  │                      │
   │                            │                         │                  │                      │
   │                            │                         │ 扫码读 token     │                      │
   │                            │ ◄── POST /pair/complete │                  │                      │
   │                            │     { pairingToken,     │                  │                      │
   │                            │       deviceName, mode }│                  │                      │
   │                            │   verify session ───────────────────────► │                      │
   │                            │   INSERT/UPDATE device ─────────────────► │                      │
   │                            │   UPDATE session=COMPLETED ─────────────► │                      │
   │                            │   signDeviceToken(...)  │                  │                      │
   │                            │   SignalRGateway.notifyDashboard ──────────────────────────────► │
   │                            │ ──► 201 { deviceId,     │                  │                      │
   │                            │           deviceSecret, │                  │                      │
   │                            │           apiKey,       │                  │                      │
   │                            │           wsToken,      │                  │                      │
   │                            │           wsEndpoint }  │                  │                      │
   │                            │                         │ 持久化 apiKey/wsToken                   │
   │                            │                         │ (后续 HTTP 用 Device <apiKey>)          │
```

---

## 迁移 checklist

- [ ] **环境变量**：`BASE_URL`（QR 里的 apiEndpoint）、`WS_BASE_URL`、`JWT_SECRET`、`NODE_ENV`
- [ ] **DB 迁移**：`PairingSession` 与 `KioskDevice` 索引齐全（`pairingToken` unique、`mode/lastSeenAt/isConnected` 索引）
- [ ] **iPad 客户端**：解析 `qrUrl` 的 `?data=...`，调用 `POST /pair/complete`，安全保存 `apiKey` 和 `wsToken`
- [ ] **过期会话清理**：未来需要 cron job 清理 PairingSession（当前会无限累积）
- [ ] **幂等性 / 事务**：是否把 Step 4 + Step 6 包入事务、是否需要把 Step 2 改为 CAS（写状态前抢占）
- [ ] **`wsEndpoint` 字段去留**：确认 iPad 现在是走 `/ws` 还是 SignalR `/api/signalr/device/connect`；如果是后者，本响应字段可去掉以免误导
- [ ] **生产环境关闭 dev test token**：确认部署的 `NODE_ENV='production'`，不要遗漏 staging
- [ ] **device:paired 事件 schema**：与 dashboard 前端约定 `{ type, payload:{ deviceId, deviceName, mode } }`，前端要订阅 dashboard hub
- [ ] **删除后再配对策略**：明确 UX——"软删除设备能否复用旧码"目前是不能，是否需要"恢复"功能
