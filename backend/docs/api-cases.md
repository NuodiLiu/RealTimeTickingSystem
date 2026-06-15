# Cases API 详细文档

工单核心流程。**整个系统最重要的模块**——分支最多、并发风险最高、SignalR 联动最多。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:202](../src/expressApp.ts#L202) → `app.use("/cases", casesRouter)`
- 路由：[backend/src/routers/cases.router.ts](../src/routers/cases.router.ts)
- 控制器：[backend/src/controllers/cases.controller.ts](../src/controllers/cases.controller.ts)
- 服务：[backend/src/services/cases.service.ts](../src/services/cases.service.ts)
- 主要 DB 模型：`StudentCase` ([prisma/schema.prisma:60](../prisma/schema.prisma#L60))、`KioskLock`、`FeedbackSession`、`KioskDevice`

### 工单状态机
```
       (POST /cases by device)
              │
              ▼
        ┌──────────┐
        │  QUEUED  │ ◄────────────  (DB 唯一入口)
        └──────────┘
              │
              │ (POST /cases/:id/take      —— staff 指定接单)
              │ (POST /cases/take-next     —— staff FIFO 抢单)
              ▼
       ┌─────────────┐
       │ IN_PROGRESS │
       └─────────────┘
              │
              │  (POST /feedback/send  —— 进入评价流程，case 状态不变？或转 PENDING_FEEDBACK)
              │                          ⚠️ resolveCase 中处理 RESOLVED_PENDING_FEEDBACK 分支
              ▼
   ┌────────────────────────────┐
   │ RESOLVED_PENDING_FEEDBACK  │
   └────────────────────────────┘
              │
              │ (POST /cases/:id/resolve  —— staff 强制结案，会同时取消 feedback session)
              │ (POST /feedback/submit    —— 设备提交评价后由 feedback flow 转 RESOLVED)
              ▼
        ┌──────────┐
        │ RESOLVED │
        └──────────┘
```

`escalate` 不改 `status`（只写 `escalatedTo` 和 `resolvedOnSite` 两个字段），是状态机的"侧路"。

### 字段定义（[schema.prisma:60-79](../prisma/schema.prisma#L60-L79)）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | cuid | PK |
| `zID` | string? | 学号，可选 |
| `studentName` | string | 必填 |
| `category` | string | 必填，自由文本 |
| `status` | enum `CaseStatus` | `QUEUED \| IN_PROGRESS \| RESOLVED_PENDING_FEEDBACK \| RESOLVED` |
| `staffId` | string? | 接单 staff（QUEUED 时为 null） |
| `escalatedTo` | string? | 升级到的部门 |
| `resolvedOnSite` | boolean? | 是否现场解决 |
| `createdAt` / `startedAt` / `resolvedAt` | DateTime? | 三个时间戳 |

### 鉴权矩阵
| Endpoint | 中间件 |
|---|---|
| `POST /cases` | `requireDevice`（设备 apiKey） |
| `GET /cases/public-queue` | **无** |
| `GET /cases` | `requireJWTAuth + requireStaff` |
| `POST /cases/take-next` | `requireJWTAuth + requireStaff` |
| `POST /cases/:id/take` | `requireJWTAuth + requireStaff` |
| `POST /cases/:id/resolve` | `requireJWTAuth + requireStaff` |
| `POST /cases/:id/escalate` | `requireJWTAuth + requireStaff` |

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **`takeCase` 不重试**（[cases.service.ts:73-119](../src/services/cases.service.ts#L73-L119)），但 `takeNextCase` 重试 3 次（[cases.service.ts:121-178](../src/services/cases.service.ts#L121-L178)） | 并发抢单时 `takeCase` 直接 400，体验差；`takeNextCase` 抢失败会重试 | 统一行为：`takeCase` 抢失败直接 400 是合理的（指定 ID 表示明确意图），但错误信息要区分"已被别人接"和"不存在" |
| 2 | **`takeCase` / `takeNextCase` 用 `updateMany where { id, status:'QUEUED' }` 做 CAS** | 这是好的；但接完之后再 `findUnique` 拉一次（两次 DB round-trip） | 用 `prisma.studentCase.updateMany` 后直接根据 affected count + cached id 自构 DTO；或用 `update` 一次性返回 |
| 3 | **`resolveCase` 三个分支共享出口都返回 updatedCase，但 SignalR 事件 payload 不同**（[cases.service.ts:270-303](../src/services/cases.service.ts#L270-L303)） | 前端需写 if 区分；漏推 `device:updated` 事件时 dashboard 设备状态不刷新 | 抽出 `notifyResolveSuccess(deviceId?)` 统一推送 |
| 4 | **`resolveCase` 的 SignalR 推送在事务外**（[cases.service.ts:268-285](../src/services/cases.service.ts#L268-L285)） | 事务成功但 SignalR 失败 → DB 已变但 iPad 不会关闭 feedback 界面 | 推送失败应至少 log + 不让请求失败；如果要更稳，加 outbox pattern |
| 5 | **`resolveCase` 对 `IN_PROGRESS` 之外的状态没拦** | 已经 RESOLVED 的 case 调 resolve 仍会改 `resolvedAt=now`（覆盖原值）；QUEUED 状态的也能"被解决" | 加 status 白名单：只允许 `IN_PROGRESS` 和 `RESOLVED_PENDING_FEEDBACK` 进入 |
| 6 | **`escalateCase` 不改 status、不写时间戳、不推 SignalR**（[cases.service.ts:328-341](../src/services/cases.service.ts#L328-L341)） | 升级后 dashboard 看不到变化；升级不是状态机的一部分，只是元数据 | 决策：要不要广播 `case:escalated`？要不要把 `resolvedOnSite=true` 时联动 status=RESOLVED？ |
| 7 | **`postCase` 由设备发起，body 没有 deviceId 写入 case**（[cases.service.ts:43-71](../src/services/cases.service.ts#L43-L71)） | 无法追溯一个 case 是从哪台设备创建的 | 是否需要在 `StudentCase` 加 `createdByDeviceId`？要先在 schema 加字段 |
| 8 | **`postCase` 不校验 `category` 是否在白名单内** | 任意字符串都能写入（category 是 string 而非 enum） | 加 enum 或维护 category 表 |
| 9 | **`takeCase`/`takeNextCase` 没校验 staff 是否已经有其它 IN_PROGRESS case** | 一个 staff 可同时接多个 case，违反业务直觉 | 决策：是否限制 "1 staff 1 active case"？需先确定业务规则 |
| 10 | **`takeNextCase` 在 N+1 查询里没做事务**（findFirst + updateMany） | 两次操作之间 case 可能被改/删；好在 CAS 兜底，最多就是重试或返回 null | 当前可接受；如果将来要做更复杂的接单逻辑（如基于负载分配）必须改事务 |
| 11 | **`getPublicQueue` 不分页**（[cases.service.ts:7-26](../src/services/cases.service.ts#L7-L26)） | QUEUED 数量很大时拉全量 | 加 `take: 50` 或类似上限；公开屏一般也只显示前 N 个 |
| 12 | **`getQueuedCases` 不分页、不限时间窗** | 查 `RESOLVED` 时会拉历史全表 | 加 `take` + `skip` 分页；或按时间窗过滤 |
| 13 | **`getPublicQueue` 直接暴露 `studentName`**（无脱敏） | 公开屏会显示完整姓名 | 是否要脱敏（如 `Liam L.` / `L. L*`）取决于隐私要求 |
| 14 | **`resolveCase` 的 `device:updated` 事件 payload 不带 `mode`**（[cases.service.ts:275-278](../src/services/cases.service.ts#L275-L278)） | dashboard 想根据 mode 分组渲染时收到的事件信息不全 | 推送时把 device 完整快照带上，或要求 dashboard 收到后重拉 |
| 15 | **错误信息没区分"已接单 vs 不存在"**（[cases.service.ts:95-96](../src/services/cases.service.ts#L95-L96)） | `updateMany.count===0` 抛 `BadRequestError("Case already taken or not in queue")`，前端无法精确提示 | 在抛之前 `findUnique` 一次区分两种情况 |
| 16 | **`P2025` 的转换在 `escalateCase` 和 `resolveCase` 都有，但 `takeCase` 没有** | takeCase 拉不到 case 时抛 `NotFoundError`（其它路径用 `BadRequestError`），错误码不一致 | 统一用 `NotFoundError(404)` |
| 17 | **`takeNextCase` 用 `maxAttempts = 3`** 是默认参数，外部无法配置 | 高并发场景可能不够 | 抽常量或基于 staff 总数动态调整 |
| 18 | **`takeNextCase` 的 staff 检查只做一次** | 第一次循环前查；如果在循环过程中 staff 被删，仍然能完成 update（FK 约束会拦） | 当前可接受 |
| 19 | **大量 `console.log` 调试日志** | 生产环境噪音大，可能影响性能 | 替换为带 level 的 logger |
| 20 | **`postCase` 接收的字段类型为 any**（来自 `req.body`，无 zod/joi 校验） | category 可能是 number、object 等，运行时才报错 | 加 schema 校验中间件 |

---

## 1. `POST /cases`

设备（iPad/Kiosk）提交新工单。

源码：[cases.controller.ts:32-39](../src/controllers/cases.controller.ts#L32-L39) / [cases.service.ts:43-71](../src/services/cases.service.ts#L43-L71)

### 入参
- Header：`Authorization: Device <deviceId>:<deviceSecret>`
- Body：
  | 字段 | 类型 | 必填 |
  |---|---|---|
  | `studentName` | string | ✅ |
  | `category` | string | ✅（自由文本） |
  | `zID` | string? | 否 |

### 鉴权
`requireDevice`（同 device 文档；附带刷新 `lastSeenAt + isConnected=true`）

### 业务逻辑
```
1. requireDevice → req.device.deviceId  (顺手刷心跳)

2. CasesService.postCase(body):
   2a. studentName || category 缺失 → throw MissingFieldError(['studentName','category']) → 400
   2b. INSERT studentCase {
         studentName,
         category,
         zID: zID || null,   // 空串也变 null
         status: 'QUEUED'  (default)
       }
   2c. SignalRGateway.notifyDashboard({
         type: 'case:created',
         payload: { id, studentName, category, zID, status, createdAt }
       })

3. 201 <full StudentCase>
```

### 分支
| 场景 | 响应 |
|---|---|
| 缺 device auth | 401 |
| 设备已软删 | 401 |
| 缺 studentName / category | 400 `MissingFieldError` |
| `zID` 为空串 / undefined / null | 写入 `null` |
| 成功 | 201 + dashboard `case:created` 事件 |
| SignalR 失败 | **冒泡 → 500**（未 try/catch） |

### ⚠️
- **没有关联 deviceId**：case 表无 `createdByDeviceId` 字段，无法追溯来源。
- SignalR 失败不应让请求失败——需要包 try/catch。

---

## 2. `GET /cases/public-queue`

公共显示屏拉队列。

源码：[cases.service.ts:7-26](../src/services/cases.service.ts#L7-L26)

### 入参
无（无鉴权）

### 业务逻辑
```
1. findMany where { status:'QUEUED' } orderBy createdAt ASC
   select { id, studentName, createdAt, status }
2. map → 加上 position = index + 1
3. 200 [ { id, studentName, position, createdAt, status }, ... ]
```

### 分支
| 场景 | 响应 |
|---|---|
| 队列为空 | `200 []` |
| 有数据 | `200 [...]` |

### ⚠️
- **不分页**：QUEUED 上百时会拉全表。
- **公开 `studentName`**：根据隐私要求决定是否脱敏。
- 只查 QUEUED；IN_PROGRESS 等不显示。
- `position` 仅在响应时计算，强依赖 `orderBy createdAt ASC` 与数据库返回顺序。

---

## 3. `GET /cases`

Staff 查看队列（可按 status 过滤）。

源码：[cases.controller.ts:15-30](../src/controllers/cases.controller.ts#L15-L30) / [cases.service.ts:28-41](../src/services/cases.service.ts#L28-L41)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Query：`status` 可选，小写枚举 `queued | in_progress | resolved_pending_feedback | resolved`（默认 `queued`）

### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. controller 校验 statusQuery：
     非法值 → throw BadRequestError(`Invalid status. Must be one of: ${valid}`) → 400
     （注意大小写：toLowerCase 校验，但 service 内自己也做 toLowerCase）
3. service.getQueuedCases(statusQuery):
     map = { queued: 'QUEUED', in_progress:..., ... }
     status = map[statusQuery?.toLowerCase()] ?? 'QUEUED'
     findMany where { status } orderBy createdAt ASC
4. 200 [<full StudentCase>, ...]
```

### 分支
| `status` 入参 | 行为 |
|---|---|
| 缺省 | 查 QUEUED |
| `queued / in_progress / resolved_pending_feedback / resolved` | 对应 enum |
| `QUEUED`（大写） | 也通过（先 lowercase 再校验）|
| 其它（如 `foo`） | 400 |

### ⚠️
- **不分页**：查 `resolved` 会拉历史全表。
- Controller 和 service 都做了 lowercase，逻辑冗余。
- 返回的是 raw `StudentCase`（含 `staffId`，但没 staff 名）；如果 dashboard 想显示 staff 名要再查或 include。

---

## 4. `POST /cases/take-next`

Staff "抢下一个" —— FIFO 接单。**有重试机制**。

源码：[cases.controller.ts:54-65](../src/controllers/cases.controller.ts#L54-L65) / [cases.service.ts:121-178](../src/services/cases.service.ts#L121-L178)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Body：无

### 业务逻辑（含重试循环）

```
1. requireJWTAuth → req.user.id
   controller: !req.user?.id → 400 'User authentication required'
                  （实际上 requireJWTAuth 不通过就 401 了，这里是双保险）

2. takeNextCase(staffId, maxAttempts=3):

   2a. findUnique staff by id
       不存在 → 400 BadRequestError(`Staff member with ID ${staffId} not found`)

   2b. for attempt in 1..3:
       step 1: findFirst {
         where: { status:'QUEUED' },
         orderBy: [{ createdAt:'asc' }, { id:'asc' }],
         select: { id: true }
       }
       step 2:
         next == null → return { case: null, message: 'No queued cases available' }
                         （200，前端要识别 case===null）
       step 3: updateMany {
         where: { id:next.id, status:'QUEUED' },
         data: { status:'IN_PROGRESS', staffId, startedAt:now }
       }
       step 4:
         updated.count > 0 → 抢到了
           findUnique by id → taken
           SignalRGateway.notifyDashboard({ type:'case:updated', payload:{id,status,staffId,startedAt} })
           return { case: taken, message: 'Case taken successfully' }
         updated.count === 0 → 被别人抢了，console.log + 进入下一次循环

   2c. 3 次都抢失败 → throw ConflictError('Case already taken by someone else') → 409

3. 200 { case, message } 或 200 { case:null, message }
```

### 分支决策树
```
                       requireJWTAuth + requireStaff
                                │
                                ▼
                        staff exists in DB?
                       /         │          \
                     NO          YES          (FK 已保证 → 实际只在 staff 被删后命中)
                     │            │
                400 BadReq    enter retry loop
                                  │
                                  ▼
                   ┌─────── attempt = 1 ─────┐
                   │  findFirst QUEUED       │
                   │           │              │
                   │           ▼              │
                   │      queue empty?        │
                   │     /        \           │
                   │   YES         NO         │
                   │    │           │         │
                   │ 200 {null}     │         │
                   │           updateMany CAS │
                   │           /        \     │
                   │      count=1       count=0 (raced)
                   │       │              │
                   │  notify dashboard    next iteration
                   │  200 {case,msg}      (max 3)
                   └──────────────────────────┘
                                │
                          全部失败 → 409 ConflictError
```

### 分支汇总
| 场景 | 响应 |
|---|---|
| 未登录/非 staff | 401 / 403 |
| staff 已被删 | 400 |
| 队列为空 | `200 { case: null, message: 'No queued cases available' }` |
| 成功 | `200 { case, message: 'Case taken successfully' }` + dashboard `case:updated` |
| 一直被别人抢 3 次 | 409 ConflictError |
| SignalR 失败 | 冒泡 → 500 |

### ⚠️
- 注意空队列返回 200 而不是 404，前端要看 `case === null`。
- 重试 3 次后才放弃；并发 staff 数 > 3 时可能多人 409。

---

## 5. `POST /cases/:id/take`

Staff 指定接单某 case（不走 FIFO，比如 staff 在列表里点了某一行）。

源码：[cases.controller.ts:41-52](../src/controllers/cases.controller.ts#L41-L52) / [cases.service.ts:73-119](../src/services/cases.service.ts#L73-L119)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Path：`id`
- Body：无

### 业务逻辑

```
1. requireJWTAuth → req.user.id
   !req.user?.id → 400

2. takeCase(id, staffId):
   2a. findUnique staff by id
       不存在 → 400 BadRequestError(`Staff member with ID ${staffId} not found`)

   2b. updateMany {
         where: { id, status:'QUEUED' },
         data: { status:'IN_PROGRESS', staffId, startedAt:now }
       }

   2c. result.count === 0 → throw BadRequestError("Case already taken or not in queue") → 400
       ⚠️ 这里不区分 "case 不存在" vs "已被接"

   2d. findUnique by id → taken
       未拉到 → throw NotFoundError("Case not found") → 404
       ⚠️ 实际上 updateMany 已经命中，taken 不会为空——这条路径是死代码兜底

   2e. SignalRGateway.notifyDashboard({ type:'case:updated', payload:{id,status,staffId,startedAt} })

   2f. 200 { case: taken, message: 'Case taken successfully' }
```

### 分支汇总
| 场景 | 响应 |
|---|---|
| 未登录/非 staff | 401 / 403 |
| staff 已被删 | 400 |
| case 不存在 | 400 'Case already taken or not in queue'（**和"已被接"混淆**） |
| case 已被接 / 不在 QUEUED | 400 同上 |
| 成功 | 200 + dashboard `case:updated` |
| SignalR 失败 | 冒泡 → 500 |

### ⚠️ 与 `take-next` 的差异
1. **没有重试**：抢不到就直接 400。原因：staff 已明确指定 ID，重试没意义。
2. **错误码统一是 400**，take-next 是 409。
3. 错误信息不区分"不存在"和"已被接"——前端无法精确提示。

---

## 6. `POST /cases/:id/resolve`

Staff 标记解决。**最复杂的 endpoint**——三条主路径，涉及 KioskLock + FeedbackSession + KioskDevice 联动。

源码：[cases.controller.ts:67-77](../src/controllers/cases.controller.ts#L67-L77) / [cases.service.ts:180-326](../src/services/cases.service.ts#L180-L326)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Path：`id`
- Body：无

### 业务逻辑（完整决策树）

```
1. requireJWTAuth + requireStaff
2. findUnique case select { id, status }
   不存在 → 404 NotFoundError('Case not found')

3. wasPendingFeedback = (status === 'RESOLVED_PENDING_FEEDBACK')

   ┌── Path A: wasPendingFeedback === true（评价流程中强制结案）
   │   ──────────────────────────────────────────────────────
   │   3a. findFirst feedbackSession {
   │         where: { caseId:id, status:{ in:['CREATED','DELIVERED'] } },
   │         select: { id, deviceId, status }
   │       }
   │       deviceId = activeFeedbackSession?.deviceId
   │
   │   ┌── Path A1: activeFeedbackSession 存在
   │   │   ──────────────────────────────────────────────────
   │   │   $transaction([
   │   │     UPDATE studentCase set status='RESOLVED', resolvedAt=now
   │   │     UPDATE feedbackSession (caseId, status in CREATED/DELIVERED)
   │   │       set status='CANCELLED', cancelledAt=now
   │   │     findFirst kioskLock { caseId:id, status:'ACTIVE' }
   │   │     if (activeLock):
   │   │       UPDATE kioskLock set status='COMPLETED', releasedAt=now, version+=1
   │   │       UPDATE kioskDevice where currentLockId=activeLock.id
   │   │         set currentLockId=null
   │   │   ])
   │   │
   │   │   SignalR（事务外）：
   │   │   if (deviceId):
   │   │     SignalRGateway.dismissDevice(deviceId)
   │   │     SignalRGateway.notifyDashboard({ type:'device:updated',
   │   │       payload:{ id:deviceId, isBusy:false, isOnline:true } })
   │   │   SignalRGateway.notifyDashboard({ type:'case:updated',
   │   │     payload:{ id, status:'RESOLVED', resolvedAt } })
   │   │
   │   │   return updatedCase
   │   │
   │   └── Path A2: activeFeedbackSession 不存在（但 case 是 PENDING_FEEDBACK）
   │       ──────────────────────────────────────────────────
   │       UPDATE studentCase set status='RESOLVED', resolvedAt=now（无事务）
   │       SignalRGateway.notifyDashboard({ type:'case:updated', payload:{...} })
   │       return updatedCase
   │       ⚠️ 异常状态：case 是 PENDING 但没 session 说明清理逻辑没跟上；这里只补救 case 表
   │
   └── Path B: wasPendingFeedback === false（不在评价流程中）
       ──────────────────────────────────────────────────────
       UPDATE studentCase set status='RESOLVED', resolvedAt=now
       SignalRGateway.notifyDashboard({ type:'case:updated', payload:{...} })
       return updatedCase
       ⚠️ 不校验当前 status：QUEUED / IN_PROGRESS / RESOLVED 都会被强写为 RESOLVED

异常分支：
   err.code === 'P2025' → 404 NotFoundError
   其它 → 冒泡到全局
```

### 分支汇总表
| # | 入参 case.status | 有 active feedbackSession? | 行为 |
|---|---|---|---|
| A1 | `RESOLVED_PENDING_FEEDBACK` | 有 | 事务：case → RESOLVED；session → CANCELLED；lock → COMPLETED；device.currentLockId → null；SignalR：dismissDevice(deviceId) + dashboard×2 |
| A2 | `RESOLVED_PENDING_FEEDBACK` | 无 | 仅 UPDATE case；SignalR：dashboard×1 |
| B  | `QUEUED \| IN_PROGRESS \| RESOLVED` | n/a | 仅 UPDATE case；SignalR：dashboard×1 |
| 404 | case 不存在 | n/a | 404 |
| 500 | DB 异常（非 P2025） | n/a | 冒泡 |

### SignalR 事件矩阵
| Path | `device:updated` | `case:updated` | `dismissDevice(deviceId)`（点对点） |
|---|---|---|---|
| A1 | ✅（仅当 deviceId 存在） | ✅ | ✅ |
| A2 | ❌ | ✅ | ❌ |
| B  | ❌ | ✅ | ❌ |

### ⚠️ 必读
1. **Path B 不校验 status**：可以把已经 RESOLVED 的 case 再 resolve 一次，`resolvedAt` 会被覆盖。
2. **Path B 不释放任何 lock/session**：因为假设 case 不在 PENDING_FEEDBACK，但如果 case 是 IN_PROGRESS 且有 active lock，这里**不会清理 lock**。要看 lock 是不是必然伴随 PENDING_FEEDBACK 状态——目前 schema 不保证。
3. **SignalR 在事务外**：事务成功后推送失败，DB 状态正确但 iPad 不会关闭 feedback 界面。建议加 outbox。
4. **A2 是异常补救路径**：理论上不该出现（case PENDING_FEEDBACK 必有 session），出现就说明清理 job 没跟上，需要监控告警。

---

## 7. `POST /cases/:id/escalate`

升级到部门（不改 status，仅写元数据）。

源码：[cases.controller.ts:79-87](../src/controllers/cases.controller.ts#L79-L87) / [cases.service.ts:328-341](../src/services/cases.service.ts#L328-L341)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Path：`id`
- Body：
  | 字段 | 类型 |
  |---|---|
  | `department` | string \| null |
  | `resolvedOnSite` | boolean \| null |

### 业务逻辑
```
1. requireJWTAuth + requireStaff
2. UPDATE studentCase {
     where: { id },
     data: { escalatedTo: department, resolvedOnSite: resolvedOnSite }
   }
3. 200 <full StudentCase>

异常分支：
   err.code === 'P2025' → 404 NotFoundError('Case not found')
```

### 分支
| 场景 | 响应 |
|---|---|
| 未登录/非 staff | 401 / 403 |
| case 不存在 | 404 |
| 成功 | 200 |

### ⚠️
- **不推 SignalR**：dashboard 看不到 escalation 变化（要靠重拉列表）。
- **不改 status**：即使 `resolvedOnSite=true` 也不会改 case 为 RESOLVED——业务逻辑可能希望联动。
- **不写时间戳**：没有 `escalatedAt` 字段，无法追溯升级时间。
- **不校验 department 是否合法**：任意字符串都能传。
- **不写日志/audit**：谁升级、什么时候升级的，都没记。

---

## 状态机相互影响

```
Endpoint                  影响表
─────────────────────────────────────────────────────────────
POST /cases               StudentCase                              (INSERT)

POST /cases/take-next     StudentCase                              (UPDATE: status, staffId, startedAt)
POST /cases/:id/take      StudentCase                              (同上)

POST /cases/:id/resolve   Path A1: StudentCase + FeedbackSession + KioskLock + KioskDevice
                          Path A2: StudentCase 仅
                          Path B : StudentCase 仅

POST /cases/:id/escalate  StudentCase                              (UPDATE: escalatedTo, resolvedOnSite)
```

`resolve` Path A1 是**唯一一个会跨 4 张表事务的接口**。

---

## SignalR 事件汇总

| Endpoint | 事件类型 | 推送目标 | payload 字段 |
|---|---|---|---|
| `POST /cases` | `case:created` | dashboard | `{ id, studentName, category, zID, status, createdAt }` |
| `POST /cases/take-next`（成功） | `case:updated` | dashboard | `{ id, status, staffId, startedAt }` |
| `POST /cases/:id/take` | `case:updated` | dashboard | 同上 |
| `POST /cases/:id/resolve` Path A1 | `device:updated` | dashboard | `{ id, isBusy:false, isOnline:true }` |
| `POST /cases/:id/resolve` Path A1 | `dismissDevice` | iPad（点对点） | （由 SignalR client 决定） |
| `POST /cases/:id/resolve` 全路径 | `case:updated` | dashboard | `{ id, status:'RESOLVED', resolvedAt }` |
| `POST /cases/:id/escalate` | （无） | — | — |

⚠️ 所有 SignalR 推送当前**未包 try/catch**，失败会让 HTTP 请求返回 500。

---

## 端到端典型时序（成功结案）

```
设备                Backend                    DB                    SignalR Dashboard      iPad（其它）
  │                   │                         │                         │                     │
  │ POST /cases       │                         │                         │                     │
  │ ─────────────►    │ INSERT case=QUEUED ────►│                         │                     │
  │                   │ notify('case:created') ────────────────────────►  │                     │
  │ ◄── 201 case      │                         │                         │                     │
  │                   │                         │                         │                     │
                                  Staff portal: 看到 QUEUED 列表
                                  │
                                  │ POST /cases/take-next
                                  │ ──────────► findFirst QUEUED
                                  │             updateMany CAS → IN_PROGRESS
                                  │             notify('case:updated')
                                  │ ◄── 200 case
                                  │
                            （处理中...）
                                  │
                                  │ POST /feedback/send  (见 feedback doc)
                                  │ → case 转 RESOLVED_PENDING_FEEDBACK
                                  │   FeedbackSession created
                                  │   KioskLock active
                                  │   KioskDevice.currentLockId set
                                  │
                            （或 staff 主动 resolve）
                                  │
                                  │ POST /cases/:id/resolve
                                  │ ──────────►Path A1 事务：
                                  │           case → RESOLVED
                                  │           session → CANCELLED
                                  │           lock → COMPLETED
                                  │           device.currentLockId → null
                                  │  notify('device:updated')
                                  │  notify('case:updated')
                                  │  dismissDevice(deviceId) ──────────────────────────────────►│ 关闭评价界面
                                  │ ◄── 200 case
```

---

## 迁移 checklist

- [ ] **环境变量**：无 cases 模块独占的；依赖 `JWT_SECRET` / `DATABASE_URL` 等基础项
- [ ] **DB 索引**：`StudentCase` 已有 `[status, createdAt]` 和 `[staffId]` 索引，FIFO 查询走得到
- [ ] **事务边界**：`resolveCase` Path A1 的事务包含 4 张表写入；A2 / B 没事务，迁移时确认是否要补
- [ ] **SignalR 容错**：所有推送当前未 try/catch，迁移时考虑统一包裹 + 错误降级（log 不阻塞）
- [ ] **分页**：`getPublicQueue` / `getQueuedCases` 加 `take/skip` 上限
- [ ] **状态白名单**：`resolveCase` Path B 加 status 检查；`escalateCase` 是否限制 status
- [ ] **错误码区分**：`takeCase` 区分"不存在"和"已被接"；`takeNextCase` 统一 NotFound vs Conflict 用法
- [ ] **`escalateCase` 拓展**：是否要加 SignalR 推送、`escalatedAt`、audit log
- [ ] **隐私**：`/public-queue` 的 `studentName` 是否脱敏
- [ ] **业务约束**：是否限制"1 staff 同时只能接 1 个 case"？schema 需配合改
- [ ] **创建归属**：是否在 `StudentCase` 加 `createdByDeviceId`
- [ ] **category 规范**：是否改为 enum 或维护字典表
- [ ] **日志**：把大量 `console.log` 换成 logger
- [ ] **请求校验**：body 加 zod/joi schema
