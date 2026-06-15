# Feedback API 详细文档

评价流程。**与 Cases、KioskLock、KioskDevice 多表联动最强**——所有写操作都走 `prisma.$transaction`，并大量使用 CAS（Compare-And-Set，靠 `updateMany` + 条件 where 实现乐观锁）。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:205](../src/expressApp.ts#L205) → `app.use("/feedback", feedbackRouter)`
- 路由：[backend/src/routers/feedback.router.ts](../src/routers/feedback.router.ts)
- 控制器：[backend/src/controllers/feedback.controller.ts](../src/controllers/feedback.controller.ts)
- 服务：[backend/src/services/feedback.service.ts](../src/services/feedback.service.ts)
- 共享工具（CAS / 校验 / 事务步骤）：[backend/src/services/utils/feedback.utils.ts](../src/services/utils/feedback.utils.ts)
- 常量：[backend/src/services/utils/feedback.constants.ts](../src/services/utils/feedback.constants.ts)
  - `ONLINE_GRACE_MS = 120s`
  - `LOCK_LEASE_SECONDS = 60`
  - `SESSION_EXPIRE_MINUTES = 5`

### 相关 DB 模型

**FeedbackSession**（[schema.prisma:133](../prisma/schema.prisma#L133)）—— 评价会话生命周期
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | cuid | PK |
| `caseId / staffId / deviceId` | FK | 三方绑定 |
| `status` | enum `FeedbackSessionStatus` | `CREATED \| DELIVERED \| SUBMITTED \| OVERRIDDEN \| CANCELLED \| EXPIRED` |
| `createdAt` | DateTime | 默认 now() |
| `deliveredAt / submittedAt / overriddenAt / cancelledAt` | DateTime? | 状态切换时间戳 |
| `expireAt` | DateTime? | 默认 now+5min |

**KioskLock**（[schema.prisma:113](../prisma/schema.prisma#L113)）—— 设备占用锁（乐观锁带 version）
| 字段 | 说明 |
|---|---|
| `deviceId / staffId / caseId` | FK |
| `status` | enum `LockStatus`：`ACTIVE \| OVERRIDDEN \| COMPLETED \| EXPIRED` |
| `version` | int，每次状态切换 +1（乐观锁） |
| `leaseExpireAt` | now+60s |
| `releasedAt` | 完成/被覆盖时记录 |

**KioskDevice.currentLockId**（[schema.prisma:102](../prisma/schema.prisma#L102)）—— `@unique`，指向当前 ACTIVE lock；为 null 表示 IDLE。

**Feedback**（[schema.prisma:81](../prisma/schema.prisma#L81)）—— 最终评价结果
| 字段 | 说明 |
|---|---|
| `caseId` | `@unique`（一个 case 只能有一次评价） |
| `rating` | int [1, 5] |
| `comment` | string? |

### FeedbackSession 状态机
```
                  (POST /feedback/send)
                          │
                          ▼
                    ┌─────────┐
                    │ CREATED │
                    └─────────┘
                          │
              ┌───────────┼────────────────┐
              │           │                │
   (SignalR delivered)    │                │
              ▼           │                │
        ┌───────────┐     │                │
        │ DELIVERED │     │                │
        └───────────┘     │                │
              │           │                │
              │ (POST /feedback/submit)    │
              │           │                │
              ▼           ▼                ▼
        ┌───────────┐ ┌──────────────┐ ┌───────────┐
        │ SUBMITTED │ │  OVERRIDDEN  │ │ CANCELLED │
        └───────────┘ │ (/override)  │ └───────────┘
                      └──────────────┘    │
                          │               (resolveCase Path A1)
                      也走 OVERRIDDEN
                          
        ┌─────────┐
        │ EXPIRED │  ← DeviceCleanupService.cleanupExpiredSessions（cron）
        └─────────┘
```

> 注意 `DELIVERED` 状态当前代码里**没有任何路径写入**——是给未来 SignalR ACK 回执留的空位。

### KioskLock 状态机
```
                ┌────────┐
                │ ACTIVE │ ← createLockTx（send / override 都会建新 lock）
                └────────┘
                    │
        ┌───────────┼────────────┐
        │           │            │
(submit         (override)  (lease 过期 + cron)
 success)
        ▼           ▼            ▼
   ┌───────────┐ ┌────────────┐ ┌─────────┐
   │ COMPLETED │ │ OVERRIDDEN │ │ EXPIRED │
   └───────────┘ └────────────┘ └─────────┘
```

### 鉴权矩阵
| Endpoint | 中间件 | 入参的 staffId 来源 |
|---|---|---|
| `POST /feedback/send` | `requireJWTAuth + requireStaff` | `req.user.id` |
| `POST /feedback/override` | `requireJWTAuth + requireStaff` | `req.user.id` |
| `POST /feedback/submit` | `requireDevice` | （不需要 staffId）|

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **`sendFeedback` 的 busy 检查在事务外**（[feedback.service.ts:36-38](../src/services/feedback.service.ts#L36-L38)） | check-then-act race：检查完之后到事务开始之前，另一个 staff 可能也通过了检查 | `casBindCurrentLock` 是兜底（`where currentLockId=null`），但错误信息会变成"Device just became busy"。是 by design 还是想统一错误？ |
| 2 | **`existingActiveFeedback` 跨设备检查也在事务外**（[feedback.service.ts:41-54](../src/services/feedback.service.ts#L41-L54)） | 检查"该 case 是否在别的设备上做" + 事务内创建之间存在 race window | 改为事务内 `findFirst` + 抛错；或加唯一约束 `(caseId, status in ACTIVE)` 部分索引 |
| 3 | **`assertOnline` 用的是 `lastSeenAt` 简单版**（[feedback.utils.ts:41-48](../src/services/utils/feedback.utils.ts#L41-L48)），不查 SignalR | 设备 HTTP 心跳活但 SignalR 断了，依然认为在线，但 `showFeedback` 推送会失败 | 改为 `isDeviceOnlineDynamic`（接 SignalR），代价是多一次外部调用 |
| 4 | **设备 mode 校验在事务内外都做了**（[feedback.service.ts:33,68](../src/services/feedback.service.ts#L33) + 109,127） | 防止事务前 mode 被改；冗余但安全 | 当前可接受 |
| 5 | **`assertModeAllowsFeedback` 抛 `ForbiddenError`**（[feedback.utils.ts:34-38](../src/services/utils/feedback.utils.ts#L34-L38)），其它地方抛 `ConflictError` | HTTP 错误码不一致：mode 不对 → 403，busy → 409，offline → 409 | 决策：用户视角是"功能拒绝"还是"冲突"？目前 403 + 409 混用 |
| 6 | **`overrideFeedback` 直接 resolve 原 case**（[feedback.service.ts:134](../src/services/feedback.service.ts#L134) → `resolveOriginalCase`） | 被覆盖的旧 case 直接置为 RESOLVED + 写 resolvedAt = now，**不留任何痕迹/audit** | 业务上"override 等于放弃旧 case"是否合理？要不要加 `escalatedTo='OVERRIDDEN_BY_STAFF'` 或 audit log？ |
| 7 | **`submitFeedback` 重复提交（P2002）静默吞**（[feedback.service.ts:223-226](../src/services/feedback.service.ts#L223-L226)） | Feedback unique on caseId，重复 create 抛 P2002 → 被吞，但事务继续把 session 改 SUBMITTED、把 lock 改 COMPLETED | 看似幂等，但 race 下两次 submit 都会走完整流程；第二次拿不到 feedbackId，response 里 feedback 是 null。前端要判断 |
| 8 | **`submitFeedback` 对 `OVERRIDDEN/CANCELLED/EXPIRED` 抛 409，对 `SUBMITTED` 走幂等**（[feedback.service.ts:197-208](../src/services/feedback.service.ts#L197-L208)） | session 状态多种"已结束"，处理逻辑分裂 | 抽 `isSessionActive(status)` 统一判断；幂等返回是好事，但建议在响应里带状态码区分"刚提交"与"重复提交" |
| 9 | **`submitFeedback` SignalR 推送在事务外**（[feedback.service.ts:259-270](../src/services/feedback.service.ts#L259-L270)），未 try/catch | 推送失败 → 500，但 DB 已经提交完毕 → 数据 + 状态不一致 | 加 try/catch + log；或加 outbox |
| 10 | **`sendFeedback` 返回的 `case.status` 计算逻辑奇怪**（[feedback.service.ts:96](../src/services/feedback.service.ts#L96)）：`scase.status === 'RESOLVED' ? 'RESOLVED' : 'RESOLVED_PENDING_FEEDBACK'` | 用的是事务前的 `scase.status`，不是事务后的实际状态 | `markCasePendingIfNeeded` 已经处理了，但响应里硬编码会误导 |
| 11 | **`overrideFeedback` 不校验 `caseId == currentLock.caseId`** | 可以把 lock A（绑 caseX）override 成 lock B（绑 caseY），但 `resolveOriginalCase(currentLock.caseId)` 仍 resolve caseX | 看上去 by design（override 就是"放弃旧 case 接新 case"），但要明确文档 |
| 12 | **`overrideFeedback` 的 `precondition_failed` 信息里带了 lock 详情**（[feedback.utils.ts:142-155](../src/services/utils/feedback.utils.ts#L142-L155)） | 客户端可拿到最新 lock 信息直接重试 | 是 by design |
| 13 | **`createLockTx` 没把 `expireAt` 加进 device 检查** | lock 过期但 device.currentLockId 仍指向它时，`findActiveLock` 用 `leaseExpireAt > now` 过滤，能正确判 IDLE；但 device.currentLockId **不会自动清空**——靠 `casBindCurrentLock` 的 `currentLockId=null` 兜底会失败 → 抛 "Device just became busy" | 加后台 cron 释放过期 lock + 清 device 指针；或 send/override 前先尝试释放过期 lock |
| 14 | **`casBindCurrentLock` 错误信息根据上下文不同**（busy vs precondition_failed） | 同一段代码两种错误码，仅靠调用方传参区分 | 当前可接受 |
| 15 | **`overrideActiveSessionsOnDevice` 把该设备**所有**`CREATED/DELIVERED` 都改 OVERRIDDEN**（[feedback.utils.ts:184-189](../src/services/utils/feedback.utils.ts#L184-L189)） | 通常一台设备只有一个 active session，但若历史数据异常（多个 active），全被一次 override | 多个 active 本身就是脏状态；建议加监控告警 |
| 16 | **`submitFeedback` 没鉴权 `req.device.deviceId === session.deviceId`** | 设备 A 拿到设备 B 的 sessionId 也能提交 | 加校验：`if (req.device.deviceId !== session.deviceId) throw ForbiddenError` |
| 17 | **`submitFeedback` 的 lock COMPLETED 用 `updateMany where status:'ACTIVE'`**（[feedback.service.ts:240-243](../src/services/feedback.service.ts#L240-L243)） | CAS 兜底：lock 已被覆盖/过期时不会写错；但 affected count 没检查，结果只看 `tx.kioskLock.findFirst` 是否找到 | 加 `if (updated.count === 0)` 处理；当前路径里只是 best-effort |
| 18 | **`rating` 校验在 controller 没做，service 做了**（[feedback.controller.ts:60](../src/controllers/feedback.controller.ts#L60), [feedback.service.ts:184-186](../src/services/feedback.service.ts#L184-L186)） | controller 仅校验 `rating != null`，service 校验整数 + [1, 5] | 应在 controller 也加，更早失败更省事务 |
| 19 | **`comment` 没有长度限制** | 可写任意长度字符串 | 加 `if (comment.length > 1000) throw BadRequestError` |
| 20 | **`comment` 防 XSS 全靠前端** | DB 存原文，输出时若前端直接渲染 HTML 有风险 | 后端不强制；但要在导出 Excel / 显示前端处确保转义 |
| 21 | **`feedbackSession.expireAt` 是软过期，靠 `DeviceCleanupService.cleanupExpiredSessions` 跑 cron 清理**（[device-cleanup.service.ts:70-136](../src/services/device-cleanup.service.ts#L70-L136)） | 如果 cron 不跑，过期 session 仍 `CREATED/DELIVERED`，会污染 `existingActiveFeedback` 检查 | 部署时确认 cron 已挂；或在 send/submit 前主动清理同 session |
| 22 | **`submitFeedback` 跳过 `RESOLVED` 直接写**（[feedback.service.ts:251-254](../src/services/feedback.service.ts#L251-L254)） | 不论 case 当前 status，都强写为 RESOLVED + resolvedAt | 即使 case 已 RESOLVED（如被 staff override 后 resolve），这里会覆盖时间戳 |
| 23 | **重复语义字段**：`FeedbackSession.expireAt` vs `KioskLock.leaseExpireAt` 同时存在 | 一个 5min（session），一个 60s（lock）；语义不同但容易混 | 文档化两者用途差异 |
| 24 | **`feedback_in_progress` 错误是 ConflictError + `code` 属性** | 客户端要判 `err.code === 'feedback_in_progress'` 区分场景 | 标准化错误响应 schema（带 code 字段） |
| 25 | **SignalR `showFeedback` 失败不重试也不补偿**（[feedback.service.ts:80-85](../src/services/feedback.service.ts#L80-L85)） | DB session 已创建但 iPad 没收到，iPad 不知道要弹评价界面；session 5min 后过期被清理 | 加 retry（指数退避 1-2 次）；或让 iPad 主动 poll `GET /feedback/active?deviceId` |

---

## 1. `POST /feedback/send`

Staff 把评价请求推送到指定设备（开始评价流程）。**最复杂的"创建型"endpoint**。

源码：[feedback.controller.ts:16-29](../src/controllers/feedback.controller.ts#L16-L29) / [feedback.service.ts:26-98](../src/services/feedback.service.ts#L26-L98)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Body：
  | 字段 | 类型 | 必填 |
  |---|---|---|
  | `caseId` | string | ✅ |
  | `deviceId` | string | ✅ |

`staffId` 来自 `req.user.id`（不是 body）。

### 业务逻辑（完整流程）

```
1. requireJWTAuth + requireStaff
2. controller 校验：
   !staffId → 400 'Unauthorised: missing staffId'
   !caseId || !deviceId → 400 'caseId and deviceId are required'

3. FeedbackService.sendFeedback({ caseId, deviceId, staffId }):

   3a. loadBasics(prisma, {caseId, deviceId, staffId}):
       并行 findUnique case/device/staff
       任一为 null → 404 NotFoundError('Case/Device/Staff not found')

   3b. assertModeAllowsFeedback(device.mode):
       mode === 'REGISTRATION' → 403 ForbiddenError('Device mode does not allow feedback')

   3c. assertOnline(device.lastSeenAt):
       Date.now() - lastSeenAt > 120s → 409 ConflictError('Device offline', code:'offline')

   3d. activeLock = findActiveLock(prisma, deviceId)
       存在 → throwBusy(activeLock)
              → 409 ConflictError('Device busy', code:'busy', busy:{...})

   3e. existingActiveFeedback = findFirst feedbackSession
         where { caseId, status:{in:[CREATED,DELIVERED]}, deviceId:{ not:deviceId } }
       存在 → 409 ConflictError(`This case already has an active feedback session on device "${name}"`,
                                code:'feedback_in_progress')

   3f. $transaction:
       i.   再次 findUnique device select { id, mode }
            不存在 → 404
            assertModeAllowsFeedback (二次校验)
       ii.  createSessionTx → feedbackSession {
              caseId, staffId, deviceId,
              status:'CREATED', expireAt: now + 5min
            }
       iii. createLockTx → kioskLock {
              deviceId, staffId, caseId,
              status:'ACTIVE', version:1,
              leaseExpireAt: now + 60s
            }
       iv.  casBindCurrentLock(tx, deviceId, lock.id, 'busy'):
            UPDATE kioskDevice WHERE id=deviceId AND currentLockId IS NULL
              SET currentLockId = lock.id
            updateMany.count !== 1 → 409 'Device just became busy', code:'busy'
       v.   markCasePendingIfNeeded(tx, caseId, scase.status):
            scase.status !== 'RESOLVED' → UPDATE case set status='RESOLVED_PENDING_FEEDBACK'
            scase.status === 'RESOLVED' → 不变（special branch！见下）

       事务结束

   3g. SignalR（事务外，未 try/catch）：
       SignalRGateway.showFeedback(deviceId, {
         sessionId, caseId,
         staff: { id, name },
         expireAt: ISO string
       })
       SignalRGateway.notifyDashboard({
         type: 'device:updated',
         payload: { id:deviceId, isBusy:true, isOnline:true }
       })

   3h. 200 {
         session: { id, status:'CREATED', deviceId, caseId, expireAt },
         lock: { id, status:'ACTIVE', version, leaseExpireAt },
         case: { id, status: scase.status === 'RESOLVED' ? 'RESOLVED' : 'RESOLVED_PENDING_FEEDBACK' }
       }
```

### 分支汇总表
| # | 触发 | HTTP | error code |
|---|---|---|---|
| 1 | 未登录 / 非 staff | 401 / 403 | — |
| 2 | 缺 caseId / deviceId | 400 | invalid_request |
| 3 | case / device / staff 不存在 | 404 | — |
| 4 | device.mode === 'REGISTRATION' | 403 | — |
| 5 | device offline（>2min 没心跳） | 409 | `offline` |
| 6 | device 当前有 active lock | 409 | `busy` + busy 详情 |
| 7 | 同一 case 在别的设备已有活跃 session | 409 | `feedback_in_progress` |
| 8 | 事务前 device 被删 | 404 | — |
| 9 | 事务内 mode 被改成 REGISTRATION | 403 | — |
| 10 | CAS 绑 currentLock 失败（被别人抢） | 409 | `busy` |
| 11 | 成功 + 原 case 不是 RESOLVED | 200 + case.status='RESOLVED_PENDING_FEEDBACK' |
| 12 | **成功 + 原 case 已 RESOLVED** | 200 + case.status='RESOLVED'（**特殊路径**，见下） |
| 13 | SignalR 失败 | 冒泡 → 500（事务已 commit，状态不一致） |

### ⚠️ 特殊路径："case 已 RESOLVED 还能发 feedback"
[feedback.utils.ts:132-139](../src/services/utils/feedback.utils.ts#L132-L139) 的 `markCasePendingIfNeeded` 只在 `status !== 'RESOLVED'` 时才改状态——**意味着 case 已 RESOLVED 的也能发 feedback，且 case 状态不变**。

这是为了什么？可能场景：staff 解决 case 后忘了发 feedback，事后补发。但这条路径会导致：
- `existingActiveFeedback` 检查不会拦（因为 caseId 不同则查得到 OK）
- iPad 收到 `showFeedback` 时，case 已显示为 RESOLVED
- 用户提交后 `submitFeedback` 又把 status 改回 RESOLVED（无副作用，但 resolvedAt 会被覆盖）

迁移时要明确这是不是 by design。

---

## 2. `POST /feedback/override`

Staff 强制覆盖某设备上的现有评价请求（通常是接错单后纠正）。

源码：[feedback.controller.ts:31-54](../src/controllers/feedback.controller.ts#L31-L54) / [feedback.service.ts:100-178](../src/services/feedback.service.ts#L100-L178)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`
- Body：
  | 字段 | 类型 | 必填 |
  |---|---|---|
  | `caseId` | string | ✅（新 case） |
  | `deviceId` | string | ✅ |
  | `expectedLockId` | string | ✅（前端持有的当前 lock id） |
  | `expectedVersion` | number | ✅（前端持有的 lock version） |

### 业务逻辑

```
1. requireJWTAuth + requireStaff
2. controller 校验：caseId/deviceId/expectedLockId/expectedVersion 任一缺 → 400

3. FeedbackService.overrideFeedback(...):

   3a. loadBasics（case/device/staff，并行 findUnique）
   3b. assertModeAllowsFeedback(device.mode) → 403 if REGISTRATION
   3c. assertOnline(device.lastSeenAt)       → 409 if offline

   3d. currentLock = findActiveLock(prisma, deviceId)
       不存在 → 409 ConflictError('Device is not busy', code:'idle')
       存在但 (id !== expectedLockId || version !== expectedVersion):
         → preconditionFailed(currentLock)
           → 409 ConflictError('Precondition failed', code:'precondition_failed', current:{...})

   3e. $transaction:
       i.   再次 findUnique device → 不存在 404 / mode 变 → 403
       ii.  clearDevicePointerToLock(tx, deviceId, expectedLockId):
            UPDATE device WHERE id=deviceId AND currentLockId=expectedLockId
              SET currentLockId = null
            count !== 1 → 409 'Precondition failed (device pointer changed)', code:'precondition_failed'

       iii. overrideOldLockTx(tx, expectedLockId, expectedVersion):
            UPDATE kioskLock WHERE id=expectedLockId AND status='ACTIVE' AND version=expectedVersion
              SET status='OVERRIDDEN', releasedAt=now, version=expectedVersion+1
            count !== 1 → 409 'Precondition failed (lock changed)', code:'precondition_failed'

       iv.  overrideActiveSessionsOnDevice(tx, deviceId, staffId, now):
            UPDATE feedbackSession WHERE deviceId=deviceId AND status IN (CREATED, DELIVERED)
              SET status='OVERRIDDEN', overriddenAt=now
            （注意：是该 device 上所有 active session，不是按 lockId 关联）

       v.   resolveOriginalCase(tx, currentLock.caseId, now):
            UPDATE studentCase WHERE id=currentLock.caseId
              SET status='RESOLVED', resolvedAt=now
            ⚠️ 旧 case 直接置为 RESOLVED，没有任何 audit / 标记

       vi.  newSession = createSessionTx(tx, {caseId, staffId, deviceId, expireAt: now+5min})
       vii. newLock = createLockTx(tx, {deviceId, staffId, caseId, leaseExpireAt: now+60s})
       viii.casBindCurrentLock(tx, deviceId, newLock.id, 'precondition_failed'):
            count !== 1 → 409 'Precondition failed', code:'precondition_failed'
       ix.  markCasePendingIfNeeded(tx, caseId, scase.status)
            （新 case：scase 是事务前查的，可能与实际状态不一致，但 markCasePendingIfNeeded 内部 SQL 是 UPDATE 不依赖入参）

       事务结束

   3f. SignalR（事务外）：
       SignalRGateway.dismissDevice(deviceId)     // 先关旧界面
       SignalRGateway.showFeedback(deviceId, {    // 再开新评价
         sessionId: newSession.id,
         caseId,
         staff: { id, name },
         expireAt: ISO
       })
       SignalRGateway.notifyDashboard({
         type: 'device:updated',
         payload: {
           id: deviceId,
           isBusy: true,
           isOnline: true,
           currentCaseId: caseId,
           overriddenCaseId: currentLock.caseId   // 让 dashboard 知道哪个被覆盖了
         }
       })

   3g. 200 {
         previous: { lockId, status:'OVERRIDDEN', caseId, caseStatus:'RESOLVED' },
         session: { id, status:'CREATED', deviceId, caseId, expireAt },
         lock:    { id, status:'ACTIVE', version, leaseExpireAt }
       }
```

### 分支汇总表
| # | 触发 | HTTP | code |
|---|---|---|---|
| 1 | 未登录 / 非 staff | 401 / 403 | — |
| 2 | 任一字段缺 | 400 | — |
| 3 | case/device/staff 不存在 | 404 | — |
| 4 | device.mode === REGISTRATION | 403 | — |
| 5 | device offline | 409 | `offline` |
| 6 | 设备没有 active lock | 409 | `idle` |
| 7 | expectedLockId / expectedVersion 与实际不符 | 409 | `precondition_failed` + current 详情 |
| 8 | 事务前 device 被删 / mode 变 | 404 / 403 | — |
| 9 | 事务内 CAS 失败（pointer / lock 已被改） | 409 | `precondition_failed` |
| 10 | 新 lock CAS 绑定失败 | 409 | `precondition_failed` |
| 11 | 成功 | 200 | — |
| 12 | SignalR 失败 | 冒泡 → 500（事务已 commit） |

### ⚠️ 关键观察
1. **`currentLock.caseId` 直接 RESOLVED**：被覆盖的 case 无任何"被覆盖"标记。如果业务上要追溯"哪个 case 被 override 了"，必须通过 `KioskLock.status='OVERRIDDEN'` 反查。
2. **三个 CAS 防御**：device pointer、old lock version、new lock binding——任一失败都返回 `precondition_failed`，但语义略不同。前端可重新 `GET /device/status` 拿最新 lock 后重试。
3. **`overrideActiveSessionsOnDevice` 用 `deviceId` 而非 `lockId`**：理论上一个设备只一个 active session，但如果有脏数据多个 active，全被一锅端。

---

## 3. `POST /feedback/submit`

设备端用户提交评价（评分 + 评论）。

源码：[feedback.controller.ts:56-74](../src/controllers/feedback.controller.ts#L56-L74) / [feedback.service.ts:180-276](../src/services/feedback.service.ts#L180-L276)

### 入参
- Header：`Authorization: Device <deviceId>:<deviceSecret>`
- Body：
  | 字段 | 类型 | 必填 | 备注 |
  |---|---|---|---|
  | `sessionId` | string | ✅ | feedbackSession.id |
  | `rating` | number (1-5 integer) | ✅ | service 内校验 |
  | `comment` | string | 否 | 空串 / null / 非 string 都归一为 "" |

### 业务逻辑

```
1. requireDevice → req.device.deviceId（顺手刷 lastSeenAt + isConnected）

2. controller 校验：
   !sessionId → 400 'sessionId required'
   rating == null → 400 'rating required'
   comment 归一化：typeof === 'string' ? comment : ''

3. FeedbackService.submitFeedback({ sessionId, rating:Number(rating), comment }):

   3a. service 二次校验：
       !sessionId || rating==null → 400
       !Number.isInteger(rating) || rating<1 || rating>5 → 400

   3b. session = findUnique feedbackSession by id select { id, status, caseId, deviceId, staffId }
       不存在 → 404 NotFoundError('Feedback session not found')

   3c. session.status 分支：
       OVERRIDDEN | CANCELLED | EXPIRED → 409 ConflictError('Session inactive', code:'session_inactive')

       SUBMITTED → 幂等返回：
         existing = findUnique feedback by caseId
         return {
           feedback: existing ? { id, caseId, rating, comment } : null,
           session: { id, status:'SUBMITTED' }
         }
         ⚠️ HTTP 200，跟首次提交无法区分

       CREATED | DELIVERED → 继续 3d

   3d. $transaction:
       i. INSERT feedback {
            caseId: session.caseId,
            staffId: session.staffId,
            rating, comment
          }
          捕获 P2002 → feedbackId = null（重复 → 不抛错，事务继续）
          其它错误 → 抛出

       ii. UPDATE feedbackSession SET status='SUBMITTED', submittedAt=now

       iii. activeLock = findFirst kioskLock { deviceId, caseId, status:'ACTIVE' } select { id }
            存在：
              UPDATE kioskLock WHERE id=activeLock.id AND status='ACTIVE'
                SET status='COMPLETED', releasedAt=now, version+=1
              UPDATE kioskDevice WHERE id=deviceId AND currentLockId=activeLock.id
                SET currentLockId=null
            不存在：跳过（容错：lock 已被 override / expired）

       iv. UPDATE studentCase WHERE id=caseId
             SET status='RESOLVED', resolvedAt=now
           ⚠️ 不论原 status，强写 RESOLVED + resolvedAt=now

       事务返回 { feedbackId }

   3e. SignalR（事务外）：
       SignalRGateway.dismissDevice(session.deviceId)  // 关 iPad 评价界面
       SignalRGateway.notifyDashboard({
         type: 'case:updated',
         payload: { id:caseId, status:'RESOLVED' }
       })
       SignalRGateway.notifyDashboard({
         type: 'device:updated',
         payload: { id:deviceId, isBusy:false, isOnline:true }
       })

   3f. 200 {
         feedback: feedbackId ? { id, caseId, rating, comment } : null,
         session: { id, status:'SUBMITTED' }
       }
```

### 分支汇总表
| # | 触发 | HTTP | code |
|---|---|---|---|
| 1 | device auth 失败 | 401 | — |
| 2 | sessionId / rating 缺 | 400 | — |
| 3 | rating 非整数 / 不在 [1,5] | 400 | — |
| 4 | session 不存在 | 404 | — |
| 5 | session 状态为 OVERRIDDEN / CANCELLED / EXPIRED | 409 | `session_inactive` |
| 6 | session 已 SUBMITTED（重复提交） | 200（**幂等**，feedback 可能为 null） | — |
| 7 | session 是 CREATED / DELIVERED → 正常路径 | 200 | — |
| 8 | feedback P2002（caseId 已有 feedback） | 200，response.feedback=null（事务继续） | — |
| 9 | activeLock 已 not active | 跳过 lock/device 更新 | — |
| 10 | case 已 RESOLVED | 仍写 status + resolvedAt=now（覆盖） | — |
| 11 | SignalR 失败 | 冒泡 → 500（DB 已提交） | — |

### ⚠️ 关键观察
1. **没校验 `req.device.deviceId === session.deviceId`**：设备 A 拿到 B 的 sessionId 也能提交。这是个安全漏洞。
2. **`SUBMITTED` 幂等返回**：好处是网络重试不会出错；坏处是 first vs replay 无法区分（同样 HTTP 200）。
3. **P2002 静默吞**：feedback 表 caseId unique，已有 feedback 时再 create 抛 P2002 → 被吞，事务继续 → session 仍标 SUBMITTED。可能场景：旧 session 已被 override 但 feedback 已写过（不该出现，是兜底）。
4. **case 状态强写**：即使 case 已 RESOLVED，也会被覆盖 `resolvedAt = now`。

---

## SignalR 事件汇总

| Endpoint | 事件 | 目标 | payload |
|---|---|---|---|
| `POST /feedback/send` | `showFeedback` | iPad（指定 deviceId） | `{ sessionId, caseId, staff:{id,name}, expireAt }` |
| `POST /feedback/send` | `device:updated` | dashboard | `{ id:deviceId, isBusy:true, isOnline:true }` |
| `POST /feedback/override` | `dismissDevice` | iPad（先关旧界面） | — |
| `POST /feedback/override` | `showFeedback` | iPad（开新评价） | 同 send |
| `POST /feedback/override` | `device:updated` | dashboard | `{ id, isBusy:true, isOnline:true, currentCaseId, overriddenCaseId }` |
| `POST /feedback/submit` | `dismissDevice` | iPad | — |
| `POST /feedback/submit` | `case:updated` | dashboard | `{ id:caseId, status:'RESOLVED' }` |
| `POST /feedback/submit` | `device:updated` | dashboard | `{ id, isBusy:false, isOnline:true }` |

⚠️ 全部 SignalR 推送当前**没有 try/catch**，失败会让 HTTP 请求返回 500（DB 已提交，但响应是错误）。

---

## CAS / 乐观锁清单

迁移时务必复审这些 CAS，全部是"并发安全"的关键：

| 函数 | CAS 条件 | 失败错误 |
|---|---|---|
| `casBindCurrentLock`（绑定新 lock）| `currentLockId IS NULL` | `busy` 或 `precondition_failed`（看上下文） |
| `clearDevicePointerToLock`（清理旧 lock 指针）| `currentLockId = expectedLockId` | `precondition_failed` |
| `overrideOldLockTx`（覆盖旧 lock）| `status='ACTIVE' AND version=expectedVersion` | `precondition_failed` |
| `submitFeedback` 内 lock 完成 | `status='ACTIVE'` | （不检查 count） |
| `submitFeedback` 内 device 指针清理 | `currentLockId=activeLock.id` | （不检查 count） |
| `takeCase` / `takeNextCase`（cases module）| `status='QUEUED'` | `BadRequestError` / `ConflictError` |

---

## 关键时序：完整评价流程

```
Staff Portal            Backend                  iPad                   DB                Dashboard
   │                       │                       │                     │                     │
   │ POST /feedback/send                                                                       │
   │  { caseId, deviceId } │                                                                  │
   │ ───────────────────►  │  loadBasics ─────────────────────────────► │                    │
   │                       │  assertOnline (lastSeenAt)                  │                    │
   │                       │  findActiveLock                              │                    │
   │                       │  $transaction:                                                    │
   │                       │   - feedbackSession.create                                        │
   │                       │   - kioskLock.create                                              │
   │                       │   - device.currentLockId = lock.id (CAS)                          │
   │                       │   - case.status = RESOLVED_PENDING_FEEDBACK                       │
   │                       │  showFeedback ──────────────────────────► (评价界面)              │
   │                       │  notify('device:updated', isBusy:true) ───────────────────────► │
   │ ◄── 200 {session,lock,case}                                                              │
   │                       │                                                                   │
   │                       │ POST /feedback/submit  Device <apiKey>                            │
   │                       │ ◄── { sessionId, rating, comment }                                │
   │                       │  $transaction:                                                    │
   │                       │   - feedback.create (P2002 ignored)                               │
   │                       │   - session.status = SUBMITTED                                    │
   │                       │   - lock.status = COMPLETED                                       │
   │                       │   - device.currentLockId = null                                   │
   │                       │   - case.status = RESOLVED                                        │
   │                       │  dismissDevice ──────────────────────────► (关界面)               │
   │                       │  notify('case:updated', RESOLVED) ─────────────────────────────► │
   │                       │  notify('device:updated', isBusy:false) ──────────────────────► │
   │                       │ ──► 200 { feedback, session }                                     │
```

**override 路径**：

```
   │ POST /feedback/override                                                                   │
   │   { caseId, deviceId, expectedLockId, expectedVersion }                                    │
   │ ───────────────────►  │  findActiveLock ─ check expectedLockId/version                    │
   │                       │  $transaction:                                                     │
   │                       │   - device.currentLockId = null (CAS)                              │
   │                       │   - oldLock.status = OVERRIDDEN (CAS version)                      │
   │                       │   - device 上所有 active session = OVERRIDDEN                       │
   │                       │   - originalCase.status = RESOLVED ⚠️ 直接结案                      │
   │                       │   - newSession.create, newLock.create                              │
   │                       │   - device.currentLockId = newLock.id (CAS)                        │
   │                       │   - newCase.status = RESOLVED_PENDING_FEEDBACK                      │
   │                       │  dismissDevice ──────────────────────────► (关旧界面)              │
   │                       │  showFeedback ───────────────────────────► (开新界面)              │
   │                       │  notify('device:updated', currentCaseId/overriddenCaseId) ────►   │
   │ ◄── 200 {previous, session, lock}                                                          │
```

---

## 迁移 checklist

- [ ] **常量配置化**：`ONLINE_GRACE_MS / LOCK_LEASE_SECONDS / SESSION_EXPIRE_MINUTES` 抽 env
- [ ] **SignalR 容错**：所有 `showFeedback / dismissDevice / notifyDashboard` 调用包 try/catch，失败 log 不中断
- [ ] **设备身份校验**：`submitFeedback` 校验 `req.device.deviceId === session.deviceId`（**关键安全补丁**）
- [ ] **过期清理 cron**：`DeviceCleanupService.cleanupExpiredSessions` 必须挂上定时器，否则过期 session 会污染 `existingActiveFeedback` 检查
- [ ] **lock lease 过期处理**：当前没有自动释放过期 lock 的机制，只能靠 send 时的 CAS 失败拒绝；考虑加 cron 或 send 前清理
- [ ] **`sendFeedback` 对已 RESOLVED case 的特殊路径**：明确 by design vs 拦截
- [ ] **`overrideFeedback` audit log**：记录"谁在什么时候覆盖了哪个 case"，至少落 console.log → 集中日志
- [ ] **错误码标准化**：`code` 字段（`offline / busy / feedback_in_progress / idle / precondition_failed / session_inactive`）写入文档供前端消费
- [ ] **rating / comment 边界校验**：comment 长度限制
- [ ] **`SUBMITTED` 幂等返回的语义**：是否在 response 加 `wasFirstSubmission` 区分
- [ ] **DB 索引**：`FeedbackSession[deviceId, status, createdAt]`、`KioskLock[deviceId, status]` 已有；查询路径都走到索引
