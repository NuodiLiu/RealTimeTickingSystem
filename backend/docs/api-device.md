# Device API 详细文档

设备生命周期相关 endpoint。分两类：**设备侧**（iPad/Kiosk 自调，用 `Authorization: Device <apiKey>` 鉴权）和 **Staff 侧**（Portal 调，用 `Authorization: Bearer <App JWT>` + `requireStaff`）。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:204](../src/expressApp.ts#L204) → `app.use("/device", deviceRouter)`
- 路由：[backend/src/routers/device.router.ts](../src/routers/device.router.ts)
- 控制器：[backend/src/controllers/device.controller.ts](../src/controllers/device.controller.ts)
- 服务：[backend/src/services/device.service.ts](../src/services/device.service.ts)
- 在线判定常量：[backend/src/services/utils/feedback.constants.ts:5](../src/services/utils/feedback.constants.ts#L5) `ONLINE_GRACE_MS = 120_000`（2 分钟）

### 鉴权类型
| 中间件 | 来源 | 作用 |
|---|---|---|
| `requireDevice` | [auth.middleware.ts:46](../src/middlewares/auth.middleware.ts#L46) | 解析 `Authorization: Device <deviceId>:<deviceSecret>`、查 device、**顺手更新 `lastSeenAt=now, isConnected=true`** |
| `requireJWTAuth` | [jwt-auth.middleware.ts:135](../src/middlewares/jwt-auth.middleware.ts#L135) | 验 staff App JWT |
| `requireStaff` | [auth.middleware.ts:43](../src/middlewares/auth.middleware.ts#L43) | role ∈ {STAFF, ADMIN} |

> ⚠️ `requireDevice` 的副作用：**只要这个中间件通过，`lastSeenAt` 就会被刷新**。也就是说设备只要调过任意需要 `requireDevice` 的接口（heartbeat / status / ws-token / token），都算"活着"。该 update 是 fire-and-forget（失败只 warn 不 throw）。

### 在线判定规则（必须搞懂）

源码：[device.service.ts:115-158](../src/services/device.service.ts#L115-L158)

- **简单版** `isDeviceOnline(lastSeenAt, threshold?)` —— 仅看时间戳：`lastSeenAt > now - 2min` 即在线。`listDevices` / `getDevicesByMode` 用这个。
- **严格版** `isDeviceOnlineDynamic(deviceId, lastSeenAt, threshold?)` —— **同时**要求：
  1. `SignalRGateway.isDeviceOnline(deviceId)` 返回 true（设备有活跃 SignalR 连接）
  2. `lastSeenAt` 在阈值内
  3. 阈值规则：未指定时，按设备是否有 `currentLockId` 决定——**BUSY 5 分钟**，**IDLE 2 分钟**

  `getDeviceStatus`（设备自查）用这个。

> 这里有一个一致性陷阱：staff 看到的列表（简单版，2min 时间窗）和设备自己看到的状态（严格版，需要 SignalR + 动态阈值）可能不一致。迁移时如果统一在意，建议把 listDevices 也接 `isDeviceOnlineDynamic`，代价是 N+1 SignalR 调用。

### Device 状态机
```
ONLINE = isOnline === true
OFFLINE = isOnline === false  // 不论 currentLock 是什么

isOnline 内进一步：
  BUSY = currentLock.status === 'ACTIVE'
  IDLE = 其它
```

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **在线判定双轨制**：staff 列表用简单版（仅 2min 时间窗），设备自查用严格版（要 SignalR + 动态阈值） | 同一设备在 staff 列表和设备 self-status 上可能显示不同状态 | 统一选一种；若要全用严格版，`listDevices` 要做 N 次 SignalR 调用（或加并行/缓存） |
| 2 | **`requireDevice` 中间件副作用**：会刷新 `lastSeenAt + isConnected=true`（[auth.middleware.ts:55-66](../src/middlewares/auth.middleware.ts#L55-L66)） | 任意设备 HTTP 调用（包括 `/ws-token`、`/token`、`/status`）都会被算作"心跳"；心跳数据不可信 | 想精确统计心跳应只看 `POST /heartbeat`；或把中间件的 update 拆出来 |
| 3 | **`POST /heartbeat` 重复 UPDATE**：中间件刚 update 过，handler 又 update 一次 | 两次写入相同字段，多一次 DB round-trip | 移除 handler 内的 update（[device.service.ts:35-41](../src/services/device.service.ts#L35-L41)） |
| 4 | **`POST /device/token` 命名误导**：返回字段 `appJwt`，但 payload `typ === 'device'` 不是 staff | 上游误以为是 staff token，可能传错 endpoint | 改名为 `deviceToken` 或加注释；至少在响应字段里返 `typ` |
| 5 | **`GET /device/` 和 `GET /device/by-mode/:mode` DTO 不一致**：前者含 `currentLock.case.zID`，后者不含 | 前端切换接口要写两套适配 | 在 schema 层补齐 `zID`，或干脆合并两个接口 |
| 6 | **`PATCH /:id/mode` 错误处理不对称**（[device.service.ts:345-355](../src/services/device.service.ts#L345-L355)）：iPad SignalR 失败 try/catch 吞掉，Dashboard SignalR 失败会冒泡 → 500 | DB 已 update 但客户端拿到 500，状态不一致 | 给 dashboard 通知也加 try/catch，把 SignalR 错误统一记 log 不阻塞 |
| 7 | **`PATCH /:id/name` 空 name 走 raw `Error`**（[device.service.ts:426-428](../src/services/device.service.ts#L426-L428)） | errorHandler 兜底成 500，不是 400 | 改为 `throw new BadRequestError(...)` |
| 8 | **Dashboard SignalR 事件命名不统一**：`device:paired` / `device:mode_changed` / `device:unpaired` 用冒号小写；`DEVICE_NAME_UPDATED` 用大写下划线 | 前端订阅时容易漏 | 统一命名规范（建议 `device:name_updated`） |
| 9 | **`PATCH /:id/mode` 的 `mode` 没有白名单校验** | 传非法值（如 `"FOO"`）会到 Prisma enum 才报错 → 500 | controller 加 `if (!validModes.includes(mode)) throw new BadRequestError(...)` |
| 10 | **`/device/dev-unpair/:id` 仅靠 `NODE_ENV` 守护**（[device.router.ts:27-29](../src/routers/device.router.ts#L27-L29)） | staging 若 `NODE_ENV !== 'production'`，会暴露一个无鉴权的删设备接口 | 改为显式环境变量（如 `ENABLE_DEV_ROUTES=true`），且生产构建移除 |
| 11 | **unpair 不级联 `PairingSession`**（[device.service.ts:371-385](../src/services/device.service.ts#L371-L385)） | 旧的 `pairingSession.deviceId` 仍指向已软删 device | 事务里加 `pairingSession.updateMany where { deviceId } data { status:'EXPIRED' }` |
| 12 | **`updateDeviceName` 不做唯一性校验** | 可改成与其它设备同名，绕过 Path B 的同名复用机制 | DB 层 `@@unique([name, deletedAt])` 或 service 层先 `findFirst` |
| 13 | **`changeMode` 通知 iPad 不带新模式上下文（只看 SignalR client 实现）** | 若 iPad 客户端只看 `device:mode_changed` 事件而不重拉 `/status`，可能状态不同步 | 确认 SignalR 推送 payload 含 `mode`，或要求 iPad 收到事件后主动 `/status` |
| 14 | **`isDeviceOnlineDynamic` 的阈值默认值 `2 / 5` 分钟硬编码**（[device.service.ts:145](../src/services/device.service.ts#L145)） | 想调整需改代码而不是配置 | 抽出常量 `IDLE_ONLINE_THRESHOLD_MIN` / `BUSY_ONLINE_THRESHOLD_MIN` 或读 env |
| 15 | **`ONLINE_GRACE_MS = 120s` 与心跳频率耦合** | 心跳改频率必须同步改阈值，否则误判离线 | 把这两者绑定在配置 / 文档中标注 |

---

## 一、设备侧 endpoint

### 1. `POST /device/heartbeat`

iPad 每 30~60s 调一次（[feedback.constants.ts:2](../src/services/utils/feedback.constants.ts#L2) 的注释）。

源码：[device.controller.ts:8-16](../src/controllers/device.controller.ts#L8-L16) / [device.service.ts:18-68](../src/services/device.service.ts#L18-L68)

#### 入参
- Header：`Authorization: Device <deviceId>:<deviceSecret>`
- Body：无

#### 业务逻辑
```
1. requireDevice 中间件：
   - validateDeviceApiKey（timingSafeEqual 比对 sha256）
   - 顺手 UPDATE { lastSeenAt: now, isConnected: true }
   - 失败 → AuthError 401

2. handleHeartbeat(deviceId)
   2a. findUnique device + currentLock（连 case, staff.name）
       device 不存在或 deletedAt != null → 404 NotFoundError
   2b. 再次 UPDATE { lastSeenAt: now, isConnected: true }
       ⚠️ 与中间件重复了一次 update，可优化
   2c. 计算 status：
        currentLock?.status === 'ACTIVE' → BUSY
        其它                              → IDLE
        （这里不检查"是否离线"——能调到这里说明刚刚收到心跳）

3. 200 {
     success: true,
     status: 'IDLE' | 'BUSY',
     deviceMode: 'REGISTRATION' | 'FEEDBACK',
     timestamp,
     currentLock: { id, status, case:{...}, staffName, leaseExpireAt } | null
   }
```

#### 分支汇总
| 场景 | 触发 | 响应 |
|---|---|---|
| Auth 缺失/错误 | apiKey 错或缺 | 401 |
| 设备被软删 | `deletedAt != null` | 404 |
| 正常无任务 | `currentLock == null` 或 `status != ACTIVE` | `status: IDLE` |
| 正常忙碌 | `currentLock.status === 'ACTIVE'` | `status: BUSY`，附 lock 详情 |

#### ⚠️ 注意
- 心跳里**没有更新 isConnected=false 的反向逻辑**。`isConnected` 只能由：① `requireDevice` 中间件 ② 此心跳 → 改 true；只能由 SignalR webhook `/api/signalr/webhook/disconnected` → 改 false。

---

### 2. `GET /device/status`

设备自查当前状态（含动态在线判定）。

源码：[device.service.ts:71-113](../src/services/device.service.ts#L71-L113)

#### 入参
- Header：`Authorization: Device <apiKey>`

#### 业务逻辑
```
1. requireDevice → 同上

2. findUnique device + currentLock(+ case +staff.name)
   不存在/已删 → 404

3. isOnline = await isDeviceOnlineDynamic(deviceId, lastSeenAt)
   （严格版：检查 SignalR + 动态阈值）

4. status =
     !isOnline                            → 'OFFLINE'
     else currentLock.status === 'ACTIVE' → 'BUSY'
     else                                 → 'IDLE'

5. 200 { deviceId, name, mode, status, isOnline, lastSeenAt, currentLock?:{...,version,...} }
```

#### 分支
| 场景 | status |
|---|---|
| SignalR 无连接 | `OFFLINE` |
| 有 SignalR，但 `lastSeenAt` 超阈值（BUSY=5min, IDLE=2min） | `OFFLINE` |
| 在线，无 ACTIVE lock | `IDLE` |
| 在线，有 ACTIVE lock | `BUSY` |

#### ⚠️ 与 `/heartbeat` 不同
- heartbeat 返回的 `status` **不含 OFFLINE**（因为能调到就一定刚活过）
- status 是动态阈值（依赖 SignalR），listDevices 是 2min 固定阈值

---

### 3. `GET /device/pairing-status/:id`

设备启动时无凭据地查"我还配着吗"。

源码：[device.service.ts:414-422](../src/services/device.service.ts#L414-L422)

#### 入参
- URL param：`id`（deviceId）
- **无鉴权**（明文 deviceId 查询）

#### 业务逻辑
```
1. !id → 400 'Device ID required'
2. findUnique device select { id, deletedAt }
3. isPaired = !!(device && !device.deletedAt)
4. 200 { isPaired }
```

#### 分支
| 状态 | 响应 |
|---|---|
| 不存在 | `{ isPaired: false }` |
| 软删除 | `{ isPaired: false }` |
| 活跃 | `{ isPaired: true }` |
| 任何 DB 异常 | 500 |

#### ⚠️
- 无鉴权 by design：设备启动时凭据可能丢失/失效，需要先判断要不要走配对流程。
- 但泄露了"deviceId 是否存在"——属于轻度信息泄露，可接受。
- 不返回原因（是删除了还是从未存在）。

---

### 4. `POST /device/ws-token`

签发 12h device JWT，用于 SignalR/WebSocket。

源码：[device.service.ts:286-299](../src/services/device.service.ts#L286-L299) / [device.controller.ts:80-90](../src/controllers/device.controller.ts#L80-L90)

#### 入参
- Header：`Authorization: Device <apiKey>`

#### 业务逻辑
```
1. requireDevice → req.device.deviceId
2. findUnique select { id, mode, deletedAt }
   不存在/已删 → 404
3. token = jwt.sign(
     { typ:'device', sub:deviceId, mode },
     JWT_SECRET, { expiresIn:'12h' }
   )
4. 200 { deviceToken: token, expiresIn: 43200 }  // 12h in seconds
```

#### ⚠️
- `expiresIn` 在响应里硬编码 `12 * 60 * 60`（[device.controller.ts:86](../src/controllers/device.controller.ts#L86)），必须和 jwt.sign 的 `'12h'` 一致。

---

### 5. `POST /device/token`

签发 24h device JWT —— 命名上叫 `appJwt`，但实际 payload **依然是 `typ:'device'`**（不是 staff）。

源码：[device.service.ts:301-322](../src/services/device.service.ts#L301-L322)

#### 入参
同 ws-token。

#### 业务逻辑
```
1. requireDevice
2. findUnique select { id, mode, deletedAt }
   不存在/已删 → 404
3. expiresAt = now + 24h（ISO string）
   token = jwt.sign(
     { typ:'device', sub:deviceId, mode, iat:now/1000 },
     JWT_SECRET, { expiresIn:'24h' }
   )
4. 200 { appJwt: token, expiresAt }
```

#### ⚠️ 命名坑
- 返回字段叫 `appJwt`，听起来像 staff App JWT，**但 `typ === 'device'`**。
- ws-token (12h) vs token (24h)：实际只是 TTL 不同。客户端可能用 24h 版本做长 session、12h 版本做单次 ws 协商，这是 by convention，没在代码层强约束。

---

## 二、Staff 侧 endpoint

### 6. `GET /device/`

列出全部设备（含状态），可按 mode/status 过滤。

源码：[device.controller.ts:30-51](../src/controllers/device.controller.ts#L30-L51) / [device.service.ts:178-234](../src/services/device.service.ts#L178-L234)

#### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Query：
  - `mode` 可选：`REGISTRATION` / `FEEDBACK`（其它值忽略，不报错）
  - `status` 可选：`ONLINE` / `OFFLINE` / `BUSY` / `IDLE`（大写，其它值忽略）

#### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. filters = { mode?, status? }（剔除非法值）
3. listDevices(filters):
   3a. DB 查询：where { mode?, deletedAt:null }, include currentLock + case + staff.name
                orderBy lastSeenAt DESC
   3b. 映射 + 用简单版 isDeviceOnline 算 status：
        isOnline = lastSeenAt > now - 2min
        isBusy   = currentLock?.status === 'ACTIVE'
        status   = !isOnline ? 'OFFLINE' : (isBusy ? 'BUSY' : 'IDLE')
   3c. 内存中再按 status 过滤（DB 没法过滤"动态状态"）
4. 200 { items: DeviceWithStatus[] }
```

#### 分支
| 入参 | 行为 |
|---|---|
| 无 query | 全表（未删）按 lastSeenAt DESC |
| `mode=REGISTRATION` | DB where 加 mode |
| `mode=invalid` | TypeScript cast，Prisma 会拒（500）—— 没显式 422，行为不友好 |
| `status=ONLINE` | 内存过滤 isOnline=true |
| `status=OFFLINE` | 内存过滤 isOnline=false |
| `status=BUSY/IDLE` | 内存过滤 status 匹配 |

#### ⚠️
- 用的是简单版在线判定，**不查 SignalR**。这里关注是为了性能（避免 N 次 SignalR 调用）。
- DTO 字段：[type.ts:10-25](../src/lib/utils/type.ts#L10-L25)。注意 `currentLock.case` 里有 `zID`，但 `getDevicesByMode` / `handleHeartbeat` 等其它 endpoint 的 DTO **没有 `zID`**。schema 不一致。

---

### 7. `GET /device/by-mode/:mode`

仅按 mode 过滤（不能按 status 过滤）。返回不同 schema（**少了 zID**）。

源码：[device.service.ts:236-279](../src/services/device.service.ts#L236-L279)

#### 入参
- Path：`mode` ∈ `REGISTRATION | FEEDBACK`（其它直接 400 `Invalid device mode`）

#### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. mode 校验：validModes 包含 → 否则 400
3. findMany where { mode, deletedAt:null } + currentLock + case + staff.name
   orderBy lastSeenAt DESC
4. 简单版 isDeviceOnline (2min)
5. 200 { devices: DeviceDto[], mode }
```

#### 与 `GET /device/?mode=X` 的区别
| 项 | `/?mode=` | `/by-mode/:mode` |
|---|---|---|
| 非法 mode | 静默忽略 | 400 |
| 返回结构 | `{ items }` | `{ devices, mode }` |
| DTO `case.zID` | 有 | 无 |
| status 过滤 | 支持 | 不支持 |

#### ⚠️ 两个接口能力重叠且 schema 不一致——迁移时建议合并。

---

### 8. `GET /device/online/:mode`

源码：[device.service.ts:281-284](../src/services/device.service.ts#L281-L284)

#### 业务逻辑
```
1. mode 校验同上
2. devices = getDevicesByMode(mode)  // 简单版 isOnline
3. devices.filter(d => d.isOnline)
4. 200 { devices, mode, count }
```

等同于 `GET /device/by-mode/:mode` 然后内存过滤 `isOnline`。同样不查 SignalR。

---

### 9. `PATCH /device/:id/mode`

切换设备模式（REGISTRATION ↔ FEEDBACK）。

源码：[device.controller.ts:104-116](../src/controllers/device.controller.ts#L104-L116) / [device.service.ts:324-358](../src/services/device.service.ts#L324-L358)

#### 入参
- Path：`id` (deviceId)
- Body：`{ mode: 'REGISTRATION' | 'FEEDBACK' }`

#### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. !id → 400 'id required'
   !mode → 400 'mode required'
   （注意：mode 值是否合法在这里没校验，全部交给 Prisma enum）

3. findUnique device + currentLock
   不存在/已删 → 404
4. currentLock?.status === 'ACTIVE'
   → 409 ConflictError('Device is in an ACTIVE session; please end it before changing mode')

5. UPDATE device { mode: newMode, lastSeenAt: now }
   select { id, name, mode, lastSeenAt }

6. SignalR 通知（两路，**失败均被吞掉**）：
   try SignalRGateway.changeModeDevice(deviceId, newMode)  // 通知 iPad 切换
   catch { /* swallow */ }
   SignalRGateway.notifyDashboard({ type:'device:mode_changed', payload:{ deviceId, mode } })

7. 200 { id, name, mode, lastSeenAt }
```

#### 分支汇总
| 场景 | 响应 |
|---|---|
| 未登录/非 staff | 401/403 |
| id/mode 缺失 | 400 |
| device 不存在/已删 | 404 |
| 有 ACTIVE lock | **409 ConflictError**（关键分支） |
| 成功 | 200 + 两路 SignalR 推送 |
| iPad SignalR 失败 | 仍 200（已 update DB），iPad 不会切；dashboard 仍尝试推 |
| dashboard SignalR 失败 | 异常冒泡到 errorHandler → 500（**和 iPad 推送处理不一致**） |

#### ⚠️ 关键
- `mode` 入参没做白名单校验，传 `"FOO"` 会让 Prisma 抛出 `P2009`/`P2002` 等到 errorHandler，错误信息不友好。建议在 controller 加 `validModes.includes`。
- dashboard 通知未包 try/catch，会让请求失败——**和 changeModeDevice 不一致**。

---

### 10. `PATCH /device/:id/name`

源码：[device.service.ts:425-464](../src/services/device.service.ts#L425-L464)

#### 入参
- Path：`id`
- Body：`{ name: string }`

#### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. !id → 400
   !name → 400
3. updateDeviceName(id, name):
   3a. name.trim() 为空 → throw new Error('Device name cannot be empty')
       ⚠️ throw 的是普通 Error 不是 BadRequestError → errorHandler 兜底 500
   3b. findUnique device → 不存在/已删 → 404
   3c. UPDATE name = name.trim(), select { id, name, mode, lastSeenAt }
4. SignalRGateway.notifyDashboard({
     type: 'DEVICE_NAME_UPDATED',  // 大写下划线，和其它 'device:xxx' 命名不一致
     payload: { deviceId, name, mode, lastSeenAt }
   })
5. 200 { success: true, device: {...} }
```

#### ⚠️ 注意
- **没有 name 唯一性校验**——可以改重名。
- Dashboard 事件类型命名不统一（这里 `DEVICE_NAME_UPDATED`，其它地方 `device:paired` / `device:mode_changed`）。
- 不通知 iPad 自己（iPad 名字变化对自身无影响）。
- 空 name 走的是 raw `Error` → 不会被 BadRequestError 路径统一处理。

---

### 11. `DELETE /device/:id`（unpair）

源码：[device.controller.ts:118-128](../src/controllers/device.controller.ts#L118-L128) / [device.service.ts:360-412](../src/services/device.service.ts#L360-L412)

#### 入参
- Path：`id`

#### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. !id → 400
3. findUnique device + currentLock → 不存在/已删 → 404
4. currentLock?.status === 'ACTIVE' → 409 ConflictError

5. prisma.$transaction([
     UPDATE device set currentLockId = null,
     UPDATE device set deletedAt = now, secretHash = ''   // 失效旧 apiKey
   ])
   ⚠️ 两条 UPDATE 必须在同一事务，否则 secretHash 清了但 currentLockId 没清

6. SignalR 通知（两路，**各自 try/catch，不互相阻塞**）：
   6a. SignalRGateway.unpairDevice(deviceId)         // 通知 iPad 进入"未配对"状态
   6b. SignalRGateway.notifyDashboard({ type:'device:unpaired', payload:{ deviceId } })

7. 204 No Content
```

#### 分支
| 场景 | 响应 |
|---|---|
| 未授权/非 staff | 401/403 |
| id 缺失 | 400 |
| 不存在/已删 | 404 |
| ACTIVE lock | 409 |
| iPad SignalR 失败 | 仍 204，本地 console.error |
| Dashboard SignalR 失败 | 仍 204，本地 console.error |
| 成功 | 204 |

#### ⚠️ 注意
- `secretHash = ''` 之后，旧 apiKey 再来调 `requireDevice` 会因为 `timingSafeEqual` 的长度比对失败 → 401。这就是 unpair 后的"凭据失效"机制。
- iPad 端**必须订阅 SignalR**才会立刻感知 unpair；否则要等到自己下一次 HTTP 调用 401 时才知道。

---

### 12. `DELETE /device/dev-unpair/:id`（仅 dev）

源码：[device.router.ts:27-29](../src/routers/device.router.ts#L27-L29)

#### 入参
- Path：`id`
- **无鉴权**（仅 `NODE_ENV === 'development'` 注册）

#### 业务逻辑
直接复用 `unpairDevice`，没有 `requireJWTAuth` / `requireStaff`。

#### ⚠️
- 部署的 `NODE_ENV` 必须是 `production`，否则这是一个无鉴权的删设备路径。
- staging 用什么 NODE_ENV？必须确认。

---

## 状态字段相互作用矩阵

`lastSeenAt` / `isConnected` / `currentLockId` 三个字段联动：

| 触发动作 | `lastSeenAt` | `isConnected` | `currentLockId` |
|---|---|---|---|
| 任意 `requireDevice` 请求 | 更新为 now | true | 不变 |
| `POST /device/heartbeat` | 更新（×2，中间件 + handler） | true | 不变 |
| `PATCH /device/:id/mode` | 更新为 now | 不变 | 不变 |
| `PATCH /device/:id/name` | 不变 | 不变 | 不变 |
| `DELETE /device/:id` | 不变 | 不变 | 置 null（事务内） |
| `POST /pair/complete`（同设备重配） | 更新 | 不变 | 不变 |
| SignalR webhook `disconnected` | 不变 | false | 视 `cleanupDeviceOnDisconnect` 是否触发 |
| `DeviceCleanupService.cleanupDeviceOnDisconnect` | 不变 | 不变 | 置 null |

---

## 在线判定决策树

```
                     ┌─ listDevices / getDevicesByMode / getOnlineDevicesByMode
isDeviceOnline ──────┤   仅 lastSeenAt > now - 2min
(简单版)              └─ 不查 SignalR
                     
                     ┌─ getDeviceStatus（设备自查）
isDeviceOnlineDynamic┤
(严格版)              │  Step 1: SignalRGateway.isDeviceOnline(deviceId) === true?
                     │           失败 → OFFLINE
                     │  Step 2: 阈值
                     │           未指定 → currentLockId 有 → 5min, 无 → 2min
                     │  Step 3: lastSeenAt > now - 阈值?
                     │           否 → OFFLINE
                     └─ 通过则 ONLINE
```

迁移时如果想把所有 endpoint 统一用严格版，需要批量改 `listDevices`/`getDevicesByMode`，并接受 N 次 SignalR 调用的开销（或加并行/缓存）。

---

## 迁移 checklist

- [ ] **环境变量**：`JWT_SECRET`、`NODE_ENV`
- [ ] **`NODE_ENV='production'`**：避免 `/device/dev-unpair/:id` 暴露
- [ ] **DB 索引**：`KioskDevice` 已有 `mode/lastSeenAt/isConnected` 索引；新增 `deletedAt` 软删过滤建议确认是否需要部分索引（`where deletedAt is null`）
- [ ] **SignalR Gateway** 必须能用，否则：
   - `isDeviceOnlineDynamic` 直接判 OFFLINE
   - `changeModeDevice`、`unpairDevice`、`notifyDashboard` 行为退化（mode/unpair 仍可改 DB，dashboard 收不到事件）
- [ ] **DTO 一致性**：`listDevices` 含 `currentLock.case.zID`，`getDevicesByMode` 不含——前端要兼容或后端补齐
- [ ] **Dashboard 事件类型命名**：统一为 `device:xxx` 还是 `DEVICE_XXX_UPDATED`，目前混用（建议统一）
- [ ] **`mode` 入参白名单**：`PATCH /:id/mode` 没做枚举校验
- [ ] **重名校验**：`PATCH /:id/name` 是否要 unique
- [ ] **`/device/by-mode/:mode` vs `/device/?mode=`**：考虑去重
- [ ] **心跳频率**：注释写 30~60s，`ONLINE_GRACE_MS=120s`，留 1 ~ 2 倍裕量；客户端实际频率必须与之匹配
- [ ] **`isConnected` 真值源**：由 `requireDevice` 中间件 + heartbeat 置 true、由 SignalR `disconnected` webhook 置 false——必须确保 webhook 配置正确
- [ ] **PairingSession.deviceId 双向引用**：unpair 时不会清 `pairingSession.deviceId`（只软删 device），需要确认是否要级联处理
