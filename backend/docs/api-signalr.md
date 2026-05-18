# SignalR API 详细文档

实时通信模块。两类 endpoint：
1. **Negotiate / Connect** —— 客户端拿 Azure SignalR Service 连接信息（URL + access token）
2. **Webhook** —— Azure SignalR Service 把连接生命周期事件（connect/disconnect/message/abuse）回调给本服务

整套系统其它模块（cases / feedback / device）的"实时通知"都是经过本模块的 `SignalRGateway` 实现的。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:209](../src/expressApp.ts#L209) → `app.use("/api/signalr", signalRRoutes)`
- 路由：[backend/src/signalr/routes.ts](../src/signalr/routes.ts)
- 客户端事件处理（webhook 内部业务）：[backend/src/signalr/eventHandler.ts](../src/signalr/eventHandler.ts)
- Webhook 控制器：[backend/src/signalr/webhook.controller.ts](../src/signalr/webhook.controller.ts)
- Webhook 中间件（签名校验/日志）：[backend/src/signalr/webhook.middleware.ts](../src/signalr/webhook.middleware.ts)
- Azure SignalR REST 客户端：[backend/src/signalr/config.ts](../src/signalr/config.ts)
- 旧版 device 鉴权：[backend/src/signalr/auth.ts](../src/signalr/auth.ts)
- 网关 facade：[backend/src/signalr/index.ts](../src/signalr/index.ts)

### 架构图
```
┌────────────────┐                        ┌────────────────────────┐
│  iPad / Portal │ ─── 1. negotiate ────► │  Backend (本服务)      │
│  (SignalR JS)  │ ◄── url+accessToken ── │   /api/signalr/...     │
└────────────────┘                        └────────────────────────┘
        │                                            │
        │ 2. WebSocket 连接                          │ 调 Azure SignalR REST API
        ▼                                            ▼ (sendToUser / broadcast)
┌──────────────────────────────────────────────────────────────────┐
│              Azure SignalR Service                                │
│              hub: realtimeticket                                  │
└──────────────────────────────────────────────────────────────────┘
        │ 3. 连接事件 webhook (connected/disconnected/message/abuse)
        ▼
┌────────────────────────────────────────┐
│  Backend /api/signalr/webhook/...      │
│  → eventHandler 处理业务逻辑           │
│     (建/删 device，cleanup lock 等)    │
└────────────────────────────────────────┘
```

### Token 双轨制

[backend/src/signalr/config.ts:92,157](../src/signalr/config.ts#L92)

Azure SignalR 需要两种 token，**都用 `AccessKey`（Base64 字符串原文，不解码）做 HMAC-SHA256**：

| Token 类型 | 用途 | audience | TTL | 角色 |
|---|---|---|---|---|
| **Client token** | 客户端连接 Azure SignalR | `https://<svc>.service.signalr.net/client/?hub=<hub>` | 1 小时 | 无（可选 role） |
| **Server token** | 后端调 REST API（broadcast / sendToUser / addToGroup）| `https://<svc>.service.signalr.net/api/v1/hubs/<hub>[/users/<id>\|/groups/<g>]` | 10 分钟 | `signalr.serviceOwner`、`signalr.hubOwner` |

> ⚠️ Azure SignalR 的特殊性：HMAC key 是 `AccessKey` 的 Base64 字符串**原文**，不是 decode 后的 Buffer。代码注释里强调了（[config.ts:42-46](../src/signalr/config.ts#L42-L46)）。

### 客户端身份模式

代码用 **userId 模式**（不依赖 group 管理）：
- 设备：`userId = deviceId`（连接时通过 `x-asrs-user-id` 上报）
- Dashboard / Staff：`userId = staff.identityKey`

后端推送目标：
- 设备点对点：`POST /api/v1/hubs/<hub>/users/<deviceId>`，method 名 `deviceMessage`，载荷 `{ type, payload }`（[config.ts:306-372](../src/signalr/config.ts#L306-L372)）
- Dashboard 广播：`POST /api/v1/hubs/<hub>`，method 名 `message`（[config.ts:239-279](../src/signalr/config.ts#L239-L279)）

### 鉴权矩阵
| Endpoint | 鉴权方式 | 来源 |
|---|---|---|
| `POST /api/signalr/negotiate` | `requireJWTAuthUnified`（device JWT 或 staff App JWT） | [jwt-auth.middleware.ts:191](../src/middlewares/jwt-auth.middleware.ts#L191) |
| `GET /api/signalr/device/connect` | `signalRAuthMiddleware`（自家 SignalR JWT） | [signalr/auth.ts:93](../src/signalr/auth.ts#L93) |
| `GET /api/signalr/dashboard/connect` | `verifyAzureJWT + requireScopes(['Api.Read'])` | [azure-auth.middleware.ts](../src/middlewares/azure-auth.middleware.ts) |
| `GET /api/signalr/health` | 无 | — |
| `POST /api/signalr/webhook/connected` | **无**（应配 webhook 签名中间件，**当前未挂**） | — |
| `POST /api/signalr/webhook/disconnected` | 同上 | — |
| `POST /api/signalr/webhook/message` | 同上 | — |
| `POST /api/signalr/webhook/abuse` | 同上 | — |
| `GET /api/signalr/webhook/health` | 无 | — |

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **Webhook 签名中间件未挂**（[routes.ts:116-118](../src/signalr/routes.ts#L116-L118) 注释说要挂，但实际 [routes.ts:121-130](../src/signalr/routes.ts#L121-L130) 没用） | webhook 接口任何人都能调，可伪造 connect/disconnect 事件 | 在路由层加 `verifySignalRWebhookSignature` 中间件；并部署 `AZURE_SIGNALR_WEBHOOK_SECRET` |
| 2 | **`AZURE_SIGNALR_WEBHOOK_SECRET` 未配时直接放行**（[webhook.middleware.ts:18-21](../src/signalr/webhook.middleware.ts#L18-L21)） | 即使挂了中间件，secret 未配也只 warn 不拒 | 改为生产环境强制要求 secret，缺失则拒绝 |
| 3 | **`handleDeviceConnect` 会 `upsert` device**（[eventHandler.ts:16-31](../src/signalr/eventHandler.ts#L16-L31)） | 任何能调 webhook 的人（参见 #1）传一个未知 deviceId，**直接创建一个虚假 device 记录**（`secretHash:'signalr-device'`）！ | 删掉 upsert 的 create 分支；只 update 已存在的 device |
| 4 | **`handleDeviceDisconnect` 会强制 RESOLVE case + 取消 feedback session**（[eventHandler.ts:65-105](../src/signalr/eventHandler.ts#L65-L105)） | 设备短暂断网（地铁/WiFi 抖动）即丢失 case；用户体验极差 | 加 grace period（断开 N 分钟后才清理）；或仅置 device offline 不清理资源 |
| 5 | **`handleDeviceDisconnect` 把 lock 标 `EXPIRED` 而不是 `COMPLETED`**（[eventHandler.ts:78-82](../src/signalr/eventHandler.ts#L78-L82)） | 用 EXPIRED 表示"非正常完成"，与正常 submit 时的 COMPLETED 区分 | 当前合理；要确保所有 lock 状态消费方都认 EXPIRED |
| 6 | **`handleDashboardConnect` 给新 dashboard 推送所有 device 状态**（[eventHandler.ts:151-175](../src/signalr/eventHandler.ts#L151-L175)） | 用 `signalRClient.notifyDashboard` 是**广播**给所有 dashboard，不是定向给新连的那一个 | 用 `sendToUser(connectionId)` 或 `sendToUser(userId)` 定向，避免每次新 dashboard 接入造成全网刷新 |
| 7 | **`handleDashboardConnect` 内 N+1 SignalR 查询**（[eventHandler.ts:161-174](../src/signalr/eventHandler.ts#L161-L174)） | N 个 device → N 次 `isDeviceConnected` 调用 + N 次 broadcast | 改为一次性查所有 device 状态 + 一次性 push |
| 8 | **`handleDeviceMessage` 不校验 webhook 是否真的来自 device**（[eventHandler.ts:198-230](../src/signalr/eventHandler.ts#L198-L230)） | webhook payload 里 `userId` 与 `userType` 都来自 header / query，未经签名校验时可伪造 | 同 #1 修了即可 |
| 9 | **`handleFeedbackCancelled` 强制 RESOLVE case**（[eventHandler.ts:344-350](../src/signalr/eventHandler.ts#L344-L350)） | 用户在 iPad 上点"取消评价"，case 直接置为 RESOLVED + resolvedAt=now | 业务上合理还是需要"取消但不结案"？ |
| 10 | **`signalr/auth.ts` 是历史遗留代码** | `signalRAuthMiddleware` / `generateSignalRToken` 用 `JWT_SECRET` 签自家 token，与 Azure SignalR 的 client token（用 AccessKey 签）完全不同 | `GET /device/connect` 还在用，但已被 `POST /negotiate`（统一 JWT） 取代；可考虑删除 |
| 11 | **`config.ts` 大量 `console.log` 调试输出 token 前 20 字节** | 生产日志里会落 token 片段；虽然只有前 20 字节，但仍是泄露 | 生产环境改为 LogLevel.Error 或彻底删 |
| 12 | **`buildClientToken` 内每次签发都 `jwt.verify` 一次自检**（[config.ts:144-151](../src/signalr/config.ts#L144-L151)） | 每次 negotiate 多一次 verify 开销 | 移除自检，或仅 dev 环境跑 |
| 13 | **`getConnectionInfo` 的 URL 拼接没归一化**（[config.ts:223](../src/signalr/config.ts#L223)）：`${this.endpoint}/client/?hub=${hubName}` | 如果 connection string 的 `Endpoint=` 末尾带 `/`，会出现 `//client`；当前依赖 connection string 不带斜杠 | 在 `parseConnectionString` 里做 `.replace(/\/+$/, '')` |
| 14 | **`POST /negotiate` 区分 device vs staff 靠 `req.device` 是否存在** | 顺序敏感：`requireJWTAuthUnified` 必须先按 `typ` 区分（已正确实现）；但响应字段名不一致：device 路径返 `user.type` = mode，staff 路径返 `userInfo.role` | 前端要写两套解析 |
| 15 | **`GET /device/connect` 路径与 negotiate 重复** | 两条路径都能拿连接信息，但鉴权不同（一个 self-signed JWT，一个 unified JWT） | iPad 应统一走 negotiate；删旧路径 |
| 16 | **`GET /dashboard/connect` 用 `verifyAzureJWT`**（直接验 Microsoft id_token，不走 App JWT） | 与 Portal 其它接口（用 App JWT）流程不一致；前端要分别管理 Microsoft token 和 App JWT | 改为统一 App JWT；这是大改动 |
| 17 | **abuse webhook 不做任何处理**（[webhook.controller.ts:142-157](../src/signalr/webhook.controller.ts#L142-L157)） | 仅 console.warn，没限流/封禁 | 是 by design（依赖 Azure SignalR 自身限流）；至少把 abuse 信息写日志/告警 |
| 18 | **`SignalRGateway.notifyDashboard` 全局广播**（[config.ts:243](../src/signalr/config.ts#L243)） | 任何 case/device 变化都会推给所有连接的 dashboard | 当前 dashboard 数量少时 OK；若扩展到几十个并发，需考虑按 group 推 |
| 19 | **`sendToUser` 失败会 throw**（[config.ts:358-372](../src/signalr/config.ts#L358-L372)），其它模块调用时**多数没 try/catch** | cases/feedback/device 大量 `await SignalRGateway.xxx()`，失败会让 HTTP 请求 500 | 在 gateway 层加可选 swallow（如 `notifyDashboardSafe`） |
| 20 | **webhook 处理函数都返回 200**（即使内部 catch 了 error）（[webhook.controller.ts:50-53,86-88,132-135](../src/signalr/webhook.controller.ts#L50-L53)） | Azure SignalR 不会重试；业务失败 = 静默丢失事件 | 关键路径（device disconnect 清理）失败时返回 5xx 让 Azure 重试 |
| 21 | **`handleDeviceMessage` 中的 `LEASE` 类型**（[eventHandler.ts:212-213](../src/signalr/eventHandler.ts#L212-L213)）只 log 不处理 | 客户端如果发 LEASE 消息，是死路径 | 删除或实现 |
| 22 | **`handleDeviceMessage.handleStatus` 调用 `signalRClient.assignLockToDevice`** | 该方法在当前代码里被使用，但 method 实现没在文件里看到（外部 client） | 确认 `signalRClient` 实现，必要时统一文档 |
| 23 | **`negotiate` 路径 `additionalInfo.mode` 默认 `'REGISTRATION'`**（[routes.ts:24,27](../src/signalr/routes.ts#L24)） | device 表里没 mode（不该出现）时默认值是 REGISTRATION | 改为返回 null 或拒绝 |
| 24 | **`HUB_NAME` 默认 `'realtimeticket'`**（[config.ts:31](../src/signalr/config.ts#L31)） | hub 名硬编码 fallback；若 Azure 端 hub 名不同会连不上 | 强制要求 `AZURE_SIGNALR_HUB_NAME` 环境变量 |
| 25 | **iPad 端 method 名 `deviceMessage` 写死在 backend**（[config.ts:324](../src/signalr/config.ts#L324)） | 改名要同步 iPad app 与 backend | 抽常量到共享配置 |
| 26 | **`overriddenCaseId` 等 payload 字段没文档化** | feedback override 时 dashboard 收到的 `device:updated` payload 是混合结构 | 维护"事件类型 → payload schema"表（见下） |

---

## 1. `POST /api/signalr/negotiate`

客户端拿 Azure SignalR 连接信息（统一入口，iPad / Portal 都走这里）。

源码：[routes.ts:12-59](../src/signalr/routes.ts#L12-L59)

### 入参
- Header：`Authorization: Bearer <device JWT 或 staff App JWT>`
- Body：无

### 鉴权（`requireJWTAuthUnified`）
[jwt-auth.middleware.ts:191](../src/middlewares/jwt-auth.middleware.ts#L191)
```
extract Bearer token → jwt.verify(JWT_SECRET) → 检查 typ:
  typ='device' → 查 KioskDevice，写 req.device
  typ='staff'  → 查 Staff，写 req.user
  其它          → 401
```

### 业务逻辑

```
1. requireJWTAuthUnified 已写入 req.device 或 req.user

2. 分支：
   req.device 存在（iPad）:
     userId = req.device.deviceId
     additionalInfo = {
       deviceId,
       mode: device.mode || 'REGISTRATION',
       user: { id:deviceId, type: mode }
     }

   req.user 存在（Portal staff）:
     userId = req.user.id
     additionalInfo = {
       userId,
       userInfo: { employeeNo, role }
     }

   都不存在：401 'Authentication required'

3. connectionInfo = signalRConfig.getConnectionInfo(userId)
   - audience = `${endpoint}/client/?hub=${hubName}`
   - sign client token with AccessKey (HS256, exp=1h)
   - 返回 { url, accessToken }

4. 200 { url, accessToken, ...additionalInfo }

5. 异常 → 500
```

### 分支汇总
| 场景 | 响应 |
|---|---|
| 无 / 错 Bearer | 401（中间件） |
| device 不在 DB | 404（中间件查 KioskDevice 失败） |
| staff 不在 DB | 404（中间件） |
| 成功（device） | `{ url, accessToken, deviceId, mode, user:{id,type} }` |
| 成功（staff） | `{ url, accessToken, userId, userInfo:{employeeNo,role} }` |
| SignalR config 异常 | 500 |

---

## 2. `GET /api/signalr/device/connect`（旧路径）

历史遗留。用 self-signed SignalR JWT 鉴权，返回 SignalR 连接信息。

源码：[routes.ts:62-65](../src/signalr/routes.ts#L62-L65) / [signalr/auth.ts:126-145](../src/signalr/auth.ts#L126-L145)

### 入参
- Header：`Authorization: Bearer <SignalR JWT>`（用 `JWT_SECRET` 自签，payload `{ deviceId, mode, type:'device' }`）

### 业务逻辑
```
1. signalRAuthMiddleware:
   verify token → req.device = { deviceId, mode }
2. getDeviceConnectionUrl:
   connectionInfo = signalRConfig.getConnectionInfo(deviceId)
   200 { url, accessToken, deviceId, mode }
```

### ⚠️
- iPad 现在应统一走 `POST /negotiate`，本路径建议废弃。
- self-signed token 与 device API key (`Device <id>:<secret>`) 不是同一回事，注意区分。

---

## 3. `GET /api/signalr/dashboard/connect`

Portal 用 Azure AD id_token 直接换 SignalR 连接信息（**不走 App JWT**）。

源码：[routes.ts:68-101](../src/signalr/routes.ts#L68-L101)

### 入参
- Header：`Authorization: Bearer <Azure AD id_token>`

### 鉴权
- `verifyAzureJWT` —— 验 Microsoft id_token 签名 + claims
- `requireScopes(['Api.Read'])` —— scope 检查

### 业务逻辑
```
1. !req.azureAuth → 401
2. userId = req.azureAuth.identityKey  // aad:{tid}:{oid}
3. connectionInfo = signalRConfig.getConnectionInfo(userId)
4. 200 { url, accessToken, userId, userInfo:{ name, email, tenantId } }
异常 → 500
```

### ⚠️
- 与 `/auth/me`、`/cases` 等用 App JWT 不一致；前端要分别管理两个 token。
- 建议改为统一 App JWT（大改动）。

---

## 4. `GET /api/signalr/health`

健康检查。无鉴权。

```
200 { status:'ok', service:'SignalR', timestamp:ISO }
```

---

## 5. Webhook 总览

Azure SignalR Service 在以下事件发生时调用本服务的 webhook：

| 事件 | endpoint | 头部 |
|---|---|---|
| 客户端连接成功 | `POST /api/signalr/webhook/connected` | `x-asrs-connection-id`, `x-asrs-user-id`, `x-asrs-signature`（HMAC） |
| 客户端断开 | `POST /api/signalr/webhook/disconnected` | 同上 |
| 客户端发上行消息 | `POST /api/signalr/webhook/message` | 同上 + body `{ Target, Arguments[] }` |
| 滥用检测 | `POST /api/signalr/webhook/abuse` | 同上 + body `{ Reason }` |

> ⚠️ 当前代码**没挂签名校验中间件**！见坑点 #1。

`userType` 判断逻辑（[webhook.controller.ts:35,74](../src/signalr/webhook.controller.ts#L35)）：
```
userType = query.userType || body.userType || 'dashboard'
device 路径要求 userType==='device'，且 mode 取自 query.mode || body.mode
```

### 5.1 `POST /webhook/connected`

源码：[webhook.controller.ts:21-54](../src/signalr/webhook.controller.ts#L21-L54)

```
1. 取 connectionId / userId
   缺一即 400

2. userType === 'device':
   handleDeviceConnect(userId, connectionId, mode):
     prisma.kioskDevice.upsert(...):
       update: { isConnected:true, lastSeenAt:now, mode }
       create: { id:userId, name:`Device ${userId}`, secretHash:'signalr-device', ... }
     notifyDashboard('device:connected', { deviceId, mode, isOnline:true })
   ⚠️ create 分支是大隐患——任何能调 webhook 的人都能造一台假 device！

3. 其它（默认 dashboard）:
   handleDashboardConnect(connectionId, userId):
     findMany 所有 KioskDevice
     for each device:
       isOnline = signalRClient.isDeviceConnected(id)  // N+1
       notifyDashboard('device:status', { deviceId, isOnline, isBusy, mode, lastSeen })
   ⚠️ 用 notifyDashboard（全广播），应该 sendToUser 定向

4. 异常 → 500
   成功 → 200 { success:true }
```

### 5.2 `POST /webhook/disconnected`

源码：[webhook.controller.ts:60-89](../src/signalr/webhook.controller.ts#L60-L89) / [eventHandler.ts:46-140](../src/signalr/eventHandler.ts#L46-L140)

```
1. 缺 connectionId/userId → 400

2. device 分支 → handleDeviceDisconnect(deviceId, connectionId):
   findUnique device + currentLock

   currentLock?.status === 'ACTIVE':
     $transaction([
       UPDATE case status=RESOLVED, resolvedAt=now (if not already RESOLVED)
       UPDATE lock status=EXPIRED
       UPDATE device currentLockId=null, isConnected=false, lastSeenAt=now
       UPDATE feedbackSession status=CANCELLED (where caseId+deviceId+status in CREATED/DELIVERED)
     ])
     notifyDashboard('case:updated', { id:caseId, status:'RESOLVED' })
     notifyDashboard('device:updated', { id:deviceId, isBusy:false, isOnline:false })

   else:
     UPDATE device { isConnected:false, lastSeenAt:now }

   notifyDashboard('device:disconnected', { deviceId, isOnline:false })

3. dashboard 分支 → handleDashboardDisconnect(connectionId): 仅 log

4. 异常 → 500（事件丢失）
   成功 → 200
```

### ⚠️ 关键风险
设备短暂掉线就 RESOLVE case + 取消评价。地铁、WiFi 抖动、iPad 进省电都会触发。**这是用户体验杀手**。建议加 grace period（断开 N 分钟后才清理资源）。

### 5.3 `POST /webhook/message`

源码：[webhook.controller.ts:95-136](../src/signalr/webhook.controller.ts#L95-L136) / [eventHandler.ts:198-379](../src/signalr/eventHandler.ts#L198-L379)

设备上行消息走这里。

```
1. 缺 userId → 400
2. body = { Target, Arguments } | { target, arguments }
   message = args[0] || body.message || body

3. !message.type → log warn，不处理
4. UPDATE device.lastSeenAt = now（无论 type）

5. switch (message.type):
   'DELIVERED'       → handleDelivered: UPDATE session status=DELIVERED, deliveredAt=now
   'LEASE'           → 仅 log（未实现）
   'STATUS'          → handleStatus: 查 device + lock + case，再 assignLockToDevice
   'FEEDBACK_UPDATE' → 仅 log（未实现）
   'FEEDBACK_CANCELLED' → handleFeedbackCancelled:
                          校验 session.deviceId === deviceId
                          仅在 status ∈ {CREATED, DELIVERED} 时执行：
                          $transaction([
                            session status=CANCELLED
                            lock status=COMPLETED, version+1
                            device.currentLockId=null
                            case status=RESOLVED, resolvedAt=now
                          ])
                          notifyDashboard 'case:updated' + 'device:updated'
   default           → log warn

6. 异常 → 500（事件丢失）
   成功 → 200
```

### 5.4 `POST /webhook/abuse`

```
1. userId = header
   reason = body.Reason || 'unknown'
2. console.warn
3. 200 { success:true }
```

不实质处理，靠 Azure SignalR 自身限流。

### 5.5 `GET /webhook/health`

健康检查，返回 200。

---

## SignalRGateway facade（其它模块的调用面）

`backend/src/signalr/index.ts` 导出 `SignalRGateway` 静态类，给业务模块调用。

| 方法 | 底层 | 用途 |
|---|---|---|
| `isDeviceOnline(deviceId)` | Azure SignalR REST | 判断设备是否有活跃连接 |
| `notifyDashboard({ type, payload })` | broadcast 到 hub | dashboard 全员广播 |
| `changeModeDevice(deviceId, mode)` | sendToUser → deviceMessage | 通知设备切模式 |
| `unpairDevice(deviceId)` | sendToUser → deviceMessage | 通知设备解绑 |
| `dismissDevice(deviceId)` | sendToUser → deviceMessage | 关闭设备界面（评价等） |
| `showFeedback(deviceId, payload)` | sendToUser → deviceMessage | 设备显示评价界面 |
| `handleDeviceConnect(deviceId, connectionId, mode)` | 业务（DB upsert + notify） | webhook 内部 |
| `broadcastToDevices(message, mode?)` | sendToUser 多次 | 按 mode 批量推 |

> 所有 `sendToUser` 都使用 method 名 `deviceMessage`，载荷统一为 `{ type, payload }` envelope。iPad 端只订阅一个方法名。

### 系统级 SignalR 事件目录（dashboard 广播）

| 事件 type | 触发来源 | payload |
|---|---|---|
| `device:paired` | `pair.service.completePairing` | `{ deviceId, deviceName, mode }` |
| `device:unpaired` | `device.service.unpair` | `{ deviceId }` |
| `device:mode_changed` | `device.service.changeMode` | `{ deviceId, mode }` |
| `DEVICE_NAME_UPDATED` | `device.service.updateDeviceName` | `{ deviceId, name, mode, lastSeenAt }` |
| `device:connected` | webhook connected | `{ deviceId, mode, isOnline:true }` |
| `device:disconnected` | webhook disconnected | `{ deviceId, isOnline:false }` |
| `device:status` | dashboard connect 初始化推送 | `{ deviceId, isOnline, isBusy, mode, lastSeen }` |
| `device:updated` | feedback/cases/disconnect 业务 | `{ id:deviceId, isBusy, isOnline, ...optional fields }` |
| `case:created` | `cases.service.postCase` | 完整 case |
| `case:updated` | take / resolve / submit / webhook disconnect | `{ id, status, staffId?, startedAt?, resolvedAt? }` |

iPad 点对点事件（method `deviceMessage`，envelope `{ type, payload }`）：
| envelope.type | payload | 含义 |
|---|---|---|
| `SHOW_FEEDBACK`（实际写法看 showFeedback 实现）| `{ sessionId, caseId, staff, expireAt }` | 弹评价界面 |
| `DISMISS` / `DISMISSED` | — | 关闭当前界面 |
| `CHANGE_MODE` | `{ mode }` | 切换设备模式 |
| `UNPAIRED` | — | 设备被 staff 解绑 |

（具体 type 字符串以 `signalRClient` 实现为准）

---

## 迁移 checklist

- [ ] **环境变量**：`AZURE_SIGNALR_CONNECTION_STRING`（必需）、`AZURE_SIGNALR_HUB_NAME`、`AZURE_SIGNALR_WEBHOOK_SECRET`、`JWT_SECRET`
- [ ] **Azure 端配置**：把生产 URL `https://api.<domain>/api/signalr/webhook/{connected,disconnected,message,abuse}` 配进 Azure SignalR Service 的 upstream settings
- [ ] **挂签名校验中间件**：在四个 webhook 路由上加 `verifySignalRWebhookSignature`（**优先级最高**）
- [ ] **关闭虚假 device 创建**：`handleDeviceConnect` 改 update-only
- [ ] **设备断线 grace period**：评估业务可接受度，加 N 分钟延迟清理
- [ ] **dashboard 推送改定向**：`handleDashboardConnect` 用 `sendToUser`
- [ ] **生产关闭调试日志**：把 `console.log` 改为带 level 的 logger
- [ ] **删除旧路径**：`GET /device/connect` 和 `signalr/auth.ts` 的 self-signed token 体系
- [ ] **统一 dashboard 鉴权**：`/dashboard/connect` 改用 App JWT
- [ ] **webhook 错误码**：关键路径（disconnect 清理）失败返 5xx 让 Azure 重试
- [ ] **SignalR 失败容错**：在其它模块（cases/feedback/device）调用 `SignalRGateway` 时统一包 try/catch（或在 gateway 层提供 `*Safe` 变体）
- [ ] **method 名常量化**：`deviceMessage` 抽出常量，与 iPad 共享
- [ ] **abuse 事件落日志/告警**：当前只 warn，建议接监控系统
