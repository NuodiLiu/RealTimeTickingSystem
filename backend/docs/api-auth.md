# Auth API 详细文档

迁移参考：本文档按"入参 → 鉴权 → 业务分支 → DB/外部调用 → 返回值"的顺序拆解每一个 endpoint。所有源代码引用都附 `file:line`，方便对照。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:201](../src/expressApp.ts#L201) → `app.use("/auth", authRouter)`
- 路由文件：[backend/src/routers/auth.router.ts](../src/routers/auth.router.ts)
- 鉴权策略：Azure AD（OAuth 2.0 Authorization Code Flow，MSAL Confidential Client）+ 短期 App JWT（2h）+ HttpOnly Cookie refresh handle（14d）
- 关键依赖：
  - MSAL 客户端：[backend/src/auth/azure.ts:41](../src/auth/azure.ts#L41)
  - Staff 服务（idempotent 创建/查询）：[backend/src/services/staff.service.ts](../src/services/staff.service.ts)
  - Refresh handle 存储（内存版，生产建议替换 Redis）：[backend/src/lib/refresh-store.ts](../src/lib/refresh-store.ts)
  - JWT 签发/校验：[backend/src/lib/utils/auth.ts:49](../src/lib/utils/auth.ts#L49)
  - 错误响应（OAuth 2.0 RFC 6749 风格）：[backend/src/lib/auth-errors.ts](../src/lib/auth-errors.ts)

### Token 体系
| Token | 载体 | 有效期 | 用途 | 签发处 |
|---|---|---|---|---|
| Azure AD `id_token` / `access_token` | OAuth 回调中 | 由 Azure 决定 | 取 claims 校验身份 | Microsoft 端 |
| App JWT（staff token）| Authorization: Bearer | 2 小时 | 调业务 API | `signStaffToken` [auth.ts:49](../src/lib/utils/auth.ts#L49) |
| Refresh handle | HttpOnly Cookie `__Host-app_rf` | 14 天 | 换新 App JWT | `refreshStore.generateHandle` [refresh-store.ts:27](../src/lib/refresh-store.ts#L27) |
| MSAL account 信息 | 服务端 refreshStore | 14 天 | MSAL 静默续期 Microsoft token | `refreshStore.set` [refresh-store.ts:34](../src/lib/refresh-store.ts#L34) |

### Cookie 规范
[backend/src/lib/refresh-store.ts:88](../src/lib/refresh-store.ts#L88)
- `name`：`__Host-app_rf`（`__Host-` 前缀强制 HTTPS + path=/ + 无 Domain）
- `httpOnly: true`、`secure: NODE_ENV==='production'`、`sameSite: 'none'`
- `path: '/auth/refresh'`（仅在 refresh 端点回传，降低 CSRF 与泄露面）
- `maxAge: 14 天`

---

## ⚠️ 已知坑点（迁移前必读）

> 这一段把所有"实现与最佳实践的偏差"集中列出，方便迁移时做决策。每条都对应正文里 `⚠️` 标记的细节。

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **`/auth/login` 的 `state` 未持久化，`/auth/redirect` 未校验** | CSRF 防护不完整：攻击者可以构造一个回调诱导用户登录到自己的账号 | 把 `state` 写入短期 cookie / session store，回调时比对；若用了云防火墙级别的防护可暂缓 |
| 2 | **`refreshStore` 是进程内 `Map`（[refresh-store.ts:21](../src/lib/refresh-store.ts#L21)）** | 进程重启即丢；多实例/serverless 不共享 → 用户被强制重登 | 替换为 Redis / Azure Cache for Redis，保留 `get / set(ttl) / delete / rotateHandle` 接口签名 |
| 3 | **MSAL silent refresh 失败被静默吞掉**（[auth.router.ts:294-297](../src/routers/auth.router.ts#L294-L297)） | Microsoft 端 session 已失效，本系统仍能续 14 天 | 决策："Microsoft 失败是否强制重登"。当前选了宽松路径，是策略选择 |
| 4 | **`/auth/logout` 不吊销 App JWT 本身** | 已签发的 App JWT 最长仍可调 API 2 小时 | 引入 token 黑名单或缩短 App JWT TTL；当前依赖客户端主动丢弃 |
| 5 | **新用户首登默认 `role = STAFF`**（[staff.service.ts:79-83](../src/services/staff.service.ts#L79-L83)） | 第一个 `ADMIN` 必须 DB 手动 UPDATE | 部署时手工提升第一个管理员账号，或加引导脚本 |
| 6 | **`/auth/me` 字段叫 `id` 不是 `staffId`** | 改字段名会破坏前端 | 保留命名，前端契约文档化 |
| 7 | **`expiresIn: 7200` 硬编码** | 必须和 `signStaffToken` 的 `'2h'` 同步 | 抽常量 `STAFF_JWT_TTL_SEC` 共享 |
| 8 | **handle rotation 后旧 handle 立即失效** | 客户端 race（并发 refresh）→ 第二次 401 → 强制重登 | 前端做请求去重 / 串行化 |
| 9 | **`/auth/redirect` 失败统一 302 到登录页**（含 oauth_error / missing_code / invalid_token / invalid_claims / tenant_not_authorized / auth_failed） | 前端要在 `/login?error=...` 处把 error code 解码成用户可读文案 | 前端补全 error code → 中文文案的映射表 |
| 10 | **Staff 表 `password` 字段固定空串**（[staff.service.ts:304](../src/services/staff.service.ts#L304)） | 历史遗留字段；不会被 Azure AD 路径使用 | 后续可改为 nullable / 删除，但需确认有无残留 dev-login 代码读它 |

---

## 1. `GET /auth/login`

发起 Azure AD OAuth 登录跳转。

源码：[backend/src/routers/auth.router.ts:28-66](../src/routers/auth.router.ts#L28-L66)

### 入参
无（浏览器 GET 跳转即可）。

### 鉴权
无（这是入口）。

### 业务逻辑（顺序 + 分支）
1. 打印调试信息（clientId 前 8 位、tenantId、redirectUri、scopes）。
2. 生成 `state`：`crypto.randomBytes(16).toString('hex')` —— CSRF 防护，Azure 在回调时原样返回。
3. 生成 `nonce`：同 16 字节随机 hex —— OpenID Connect ID token 防重放。
4. 调用 `msalClient.getAuthCodeUrl({ scopes, redirectUri, state, nonce, responseMode: 'query' })`。
   - `scopes`：默认 `['openid','profile','email']`；若设置 `MSAL_SCOPES` 或 `AZURE_AD_API_CLIENT_ID` 会追加（[backend/src/auth/azure.ts:61-76](../src/auth/azure.ts#L61-L76)）。
   - `redirectUri`：`${baseUrl}/auth/redirect`，`baseUrl` 由 `NODE_ENV` 决定（生产 `BASE_URL`，本地 `API_BASE_URL`）。
5. `302` 重定向到 Microsoft 登录页。

### 分支汇总
| 分支 | 触发条件 | 行为 |
|---|---|---|
| 成功 | MSAL 生成 URL 成功 | `302 → Microsoft login` |
| 异常 | MSAL 配置缺失/网络异常 | `500 { error: 'login_failed', error_description, details? }`；`details` 仅在 development 暴露 |

### ⚠️ 当前实现的注意点
- `state`/`nonce` **未持久化**，回调时也没校验 `state`。如果要严格符合 CSRF 防护规范，应把 `state` 写到一份 session/cookie 里，回调时比对。迁移时建议加上。

---

## 2. `GET /auth/redirect`

Azure AD 回调入口：用 code 换 token、确保 Staff 记录存在、签发 App JWT、写 refresh cookie、跳前端。

源码：[backend/src/routers/auth.router.ts:72-165](../src/routers/auth.router.ts#L72-L165)

### 入参（query string）
| 字段 | 说明 |
|---|---|
| `code` | Microsoft 返回的 authorization code |
| `state` | 见 §1（**当前实现未做服务端校验**） |
| `error` / `error_description` | 失败时由 Microsoft 写入 |

### 鉴权
无中间件；信任来源是 Microsoft 的 callback。

### 业务逻辑（顺序 + 分支）

```
Step 1: 解析 query
  ├─ error 存在        → log + 302 ${FRONTEND}/login?error=oauth_error
  ├─ code 为空         → 302 ${FRONTEND}/login?error=missing_code
  └─ 正常              → Step 2

Step 2: msalClient.acquireTokenByCode({ code, scopes, redirectUri })
  └─ 抛异常            → 进入 catch（见 Step 6）

Step 3: validateAzureAdClaims(tokenResponse.idTokenClaims)
        必填: iss, sub, tid, oid                       [auth-errors.ts:123]
  └─ 抛 AuthError      → log + 302 ${FRONTEND}/login?error=invalid_token

Step 4: staffService.getOrCreateStaff(claims)          [staff.service.ts:102]
  identityKey = `aad:${tid}:${oid}`                    [staff.service.ts:55]
  email       = normalizeEmail(upn ?? preferred_username ?? email)

  4a. findStaffByIdentityKey(identityKey)
        ├─ 命中 → updateStaffProfile（仅当 email/name 实际变化才 UPDATE） → return
        └─ 未命中 → 4b

  4b. (enableMigration=true 且 email 存在) findStaffByEmail(email)
        ├─ 命中 → migrateStaffIdentity（更新 identityKey + name）→ return
        │         用途：同一用户从旧 IdP/旧租户切到新 Azure AD 时无缝迁移
        └─ 未命中 → 4c

  4c. email 缺失 → throw AuthError(400, 'Email is required for new staff creation')
      email 存在 → createNewStaff:
        employeeNo = `aad-${tid}-${oid前8位}`
        role       = STAFF（默认）
        password   = ''（Azure AD 账号不使用密码）

  4d. 并发冲突保护：Prisma P2002（unique violation）→ 重新执行 findStaffByIdentityKey
                    再命中 → 返回；未命中 → 抛 AuthError(500)

Step 5: 签发 + 持久化
  appJwt        = signStaffToken({ id, role, employeeNo, identityKey, name?, email? })
                  payload: { typ:'staff', sub:id, role, employeeNo, identityKey, name?, email? }, exp=2h
  refreshHandle = refreshStore.generateHandle()   // 32 bytes base64url
  refreshStore.set(refreshHandle, {
    msalAccount,          // 用于后续 MSAL silent refresh
    providerRefresh:'',   // MSAL Node 自己管 refresh token，这里留空
    staffId, identityKey,
    tokenVersion:1,
    exp: now + 14d
  }, ttl=14d)
  res.cookie('__Host-app_rf', refreshHandle, REFRESH_COOKIE_OPTIONS)
  302 → ${FRONTEND}/auth/callback?token=<urlencoded appJwt>

Step 6: catch
  ├─ err.message 含 'claims'  → 302 /login?error=invalid_claims
  ├─ err.message 含 'tenant'  → 302 /login?error=tenant_not_authorized
  └─ 其它                     → 302 /login?error=auth_failed
```

### 分支汇总表
| 分支 | 触发 | 输出 |
|---|---|---|
| OAuth provider 错误 | `req.query.error` 有值 | `302 /login?error=oauth_error` |
| code 缺失 | 没 query.code | `302 /login?error=missing_code` |
| claims 缺失 | `iss/sub/tid/oid` 任一空 | `302 /login?error=invalid_token` |
| Staff 命中 identityKey | 老用户 | 可能 UPDATE 邮箱/姓名，返回现有 staff |
| Staff 命中 email | identityKey 变更（IdP 迁移） | UPDATE identityKey → 返回 |
| Staff 不存在但有 email | 新用户首登 | INSERT staff，role=STAFF |
| 新用户无 email | claims 没有任何 email 字段 | `302 /login?error=invalid_claims` |
| 并发首登 | 两次回调几乎同时 | P2002 → 重查 identityKey 拿现有记录 |
| MSAL/网络异常 | token 换取失败 | `302 /login?error=auth_failed` |
| tenant 异常 | 错误信息含 'tenant' | `302 /login?error=tenant_not_authorized` |
| 成功 | 全部通过 | `Set-Cookie __Host-app_rf=...; 302 /auth/callback?token=<jwt>` |

### Staff 表必读字段
[backend/src/services/staff.service.ts:297-318](../src/services/staff.service.ts#L297-L318)
- `identityKey`：unique，`aad:{tid}:{oid}`
- `email`：unique（normalize 小写），允许 NULL
- `employeeNo`：`aad-{tid}-{oid前8位}`
- `role`：`STAFF | ADMIN`，新用户默认 STAFF（要 ADMIN 必须 DB 手动改）
- `password`：固定空串（不参与 Azure AD 登录）

### ⚠️ 迁移时要注意
1. `state` 没校验：现版本允许任意 state 通过。生产化时应把 §1 的 state 落 cookie，本路由比对。
2. `MSAL_SCOPES` 改变会影响刷新逻辑——只能改追加项，`openid profile email` 必须保留。
3. `enableMigration: true` 是 staff.service 默认值（[staff.service.ts:79-83](../src/services/staff.service.ts#L79-L83)）。如果新环境想关闭"按 email 迁移"，需要传配置覆盖。

---

## 3. `GET /auth/me`

返回当前 staff 信息（前端登录态自检 / 拉取 profile）。

源码：[backend/src/routers/auth.router.ts:171-237](../src/routers/auth.router.ts#L171-L237)

### 入参
- Header：`Authorization: Bearer <App JWT>`

### 鉴权
路由内手动校验（**未挂中间件**）：先看 header 格式，再 `jwt.verify` + 校验 `typ==='staff'`，最后查 DB 拿最新 staff。

### 业务逻辑（顺序 + 分支）

```
1. 检查 Authorization header
   缺失 / 非 'Bearer ' 前缀
     → 401 { error:'invalid_request', error_description:'Missing or invalid Authorization header' }
        Header: WWW-Authenticate: Bearer realm="api", error="invalid_request"

2. token = header.slice(7)
   jwt.verify(token, JWT_SECRET)
     抛错（过期/签名错误）
     → 401 { error:'invalid_token', ... }

3. payload.typ !== 'staff'
   （比如错把 device token 当 staff token 传上来）
   → 401 { error:'invalid_token', error_description:'Token is not a staff token' }

4. staffService.findStaffById(payload.sub)   [staff.service.ts:344]
   返回 null
   → 404 { error:'staff_not_found', error_description:'Staff record not found' }

5. 200 OK
   { ok:true, user:{ id, role, employeeNo, name, email, identityKey } }
```

### 分支汇总
| 状态码 | 触发 | error code |
|---|---|---|
| 401 | header 缺失/格式错 | `invalid_request` |
| 401 | JWT 过期/签名失败 | `invalid_token` |
| 401 | 非 staff token | `invalid_token` |
| 404 | DB 中 staff 不存在（被删/库被切） | `staff_not_found` |
| 500 | 其它异常（DB 挂） | `internal_error`，走 `handleAuthError` 兜底 |
| 200 | 正常 | `{ ok:true, user }` |

### ⚠️ 注意
- 字段叫 `id` 不是 `staffId` —— 注释里写明是为了对齐前端预期。改字段会破坏 frontend。
- `name` / `email` 可能为 null（Staff 表允许 NULL），前端要兼容。
- 这里**不会刷新** App JWT，过期就返回 401，由前端自己去 `POST /auth/refresh`。

---

## 4. `POST /auth/refresh`

用 cookie 里的 refresh handle 换新的 App JWT（同时尝试静默续期 Microsoft token）。

源码：[backend/src/routers/auth.router.ts:243-329](../src/routers/auth.router.ts#L243-L329)

### 入参
- Cookie：`__Host-app_rf=<handle>`（HttpOnly，由浏览器自动带上）
- Body：无

### 鉴权
不依赖 Authorization header；依赖 refresh handle 存在并能在 `refreshStore` 中查到。

### 业务逻辑（顺序 + 分支）

```
1. cookies = req.cookies ?? parseCookies(req.headers.cookie)
   parseCookies 是手写实现，兼容 serverless 环境 cookieParser 未生效的情况
                                                       [auth.router.ts:332-345]
   refreshHandle 缺失
     → 401 invalid_request 'No refresh handle found'

2. refreshStore.get(refreshHandle)                     [refresh-store.ts:50]
   返回 null（不存在 / 过期 / setTimeout 已清）
     → 401 invalid_token 'Refresh handle invalid or expired'

3. staffService.findStaffById(refreshData.staffId)
   返回 null（staff 被删了）
     → refreshStore.delete(handle)  // 同时清掉孤立的 handle
     → 404 staff_not_found

4. （best-effort，不影响主流程）尝试 MSAL silent refresh
   if (refreshData.msalAccount):
     msalClient.acquireTokenSilent({ account, scopes })
   失败 → console.warn，继续走流程

5. 签新 App JWT
   newAppJwt = signStaffToken({ id, role, employeeNo, identityKey, name?, email? })

6. handle rotation（refresh token rotation 最佳实践）
   newHandle = refreshStore.rotateHandle(oldHandle, {
     ...refreshData,
     tokenVersion: old + 1,
     exp: now + 14d
   })
   内部：generateHandle → set(new) → delete(old)        [refresh-store.ts:74-79]

7. Set-Cookie '__Host-app_rf' = newHandle (14d)
   200 { accessToken: newAppJwt, tokenType: 'Bearer', expiresIn: 7200 }
```

### 分支汇总
| 状态码 | 触发 | error code |
|---|---|---|
| 401 | 没 cookie | `invalid_request` |
| 401 | handle 在 store 里查不到 | `invalid_token` |
| 404 | staff 已删 | `staff_not_found`（同时清除 orphan handle） |
| 200 | 正常 | `{ accessToken, tokenType:'Bearer', expiresIn:7200 }` + 新 cookie |
| 500 | 其它异常 | `handleAuthError` 兜底 |

### ⚠️ 迁移时必看
1. **refreshStore 当前是内存版**（`Map`，进程重启即丢；多实例不同步）。生产/多实例部署必须替换为 Redis 或 Azure Cache。接口签名一致即可：`get / set(ttl) / delete / rotateHandle`。
2. **MSAL silent refresh 失败被吞掉**：会继续签发 App JWT。也就是即使 Microsoft 那侧 session 已失效，本系统的会话仍然可以续 14 天。是否要"Microsoft 失败就强制重新登录"是策略决策，目前选了宽松路径。
3. handle rotation 之后，旧 handle 立即失效——如果客户端 race（同一 handle 同时发了两次 refresh），第二次会 401。前端要做请求去重/串行化。
4. `expiresIn` 硬编码 `7200`，必须和 `signStaffToken` 的 `expiresIn: '2h'` 保持同步。

---

## 5. `POST /auth/logout`

撤销 refresh handle、清 cookie。

源码：[backend/src/routers/auth.router.ts:348-371](../src/routers/auth.router.ts#L348-L371)

### 入参
- Cookie：`__Host-app_rf`（可有可无）
- Body：无

### 鉴权
无（即使 cookie 没了也返回成功，保证幂等）。

### 业务逻辑

```
1. 解析 cookie（同 §4 step 1）
2. refreshHandle 存在 → refreshStore.delete(refreshHandle)
3. res.clearCookie('__Host-app_rf', { path, secure, httpOnly, sameSite })
4. 200 { success: true }

异常分支 → 500 { error: 'logout_failed' }
```

### ⚠️
- **不会撤销 App JWT 本身**。App JWT 直到自身 `exp`（最多 2 小时）前仍可调 API。需要立即吊销的话，得引入 token 黑名单或缩短有效期。
- 客户端要主动丢弃本地缓存的 App JWT。

---

## 6. 已废弃的 dev 登录

`POST /auth/dev-login`、`POST /auth/dev-login-staff`

源码：[backend/src/routers/auth.router.ts:374-386](../src/routers/auth.router.ts#L374-L386)

返回 `410 Gone`：
```json
{ "ok": false, "message": "Dev login has been retired. Please authenticate via Microsoft SSO." }
```

迁移注意：路径保留只是为了让旧客户端拿到明确的 410，便于排查。新代码不要再加 dev-login，统一走 Azure AD。

---

## 错误响应统一格式（OAuth 2.0 风格）

所有 4xx/5xx 都遵循：
```json
{ "error": "<error_code>", "error_description": "<human readable>" }
```
401 响应附加 header：`WWW-Authenticate: Bearer realm="api", error="<error_code>"`

`error_code` 枚举见 [backend/src/lib/auth-errors.ts:12](../src/lib/auth-errors.ts#L12)：
`invalid_request | invalid_token | insufficient_scope | invalid_client | staff_not_found | authentication_failed | tenant_not_authorized | missing_claims | internal_error | service_unavailable`

`AuthError.statusCode` 与 OAuth error_code 的映射在 [auth-errors.ts:70-83](../src/lib/auth-errors.ts#L70-L83)：
| HTTP | error code |
|---|---|
| 400 | `invalid_request` |
| 401 | `invalid_token` |
| 403 | `insufficient_scope` |
| 404 | `staff_not_found` |
| 其它 | `internal_error` |

Prisma 错误：
| Prisma code | 含义 | 响应 |
|---|---|---|
| `P2002` | unique 冲突 | 409 `authentication_failed` |
| `P2025` | 记录不存在 | 404 `staff_not_found` |

---

## 端到端时序（成功路径）

```
浏览器                  Backend                 Microsoft         DB
  │  GET /auth/login      │                       │              │
  │ ───────────────────►  │                       │              │
  │                       │ msal.getAuthCodeUrl   │              │
  │                       │ ────────────────────► │              │
  │ ◄─── 302 to MS ─────  │                       │              │
  │  GET MS login           ───────────────────► │              │
  │  ◄─── 302 /auth/redirect?code=...&state=...                   │
  │                                                                │
  │  GET /auth/redirect   │                       │              │
  │ ───────────────────►  │ acquireTokenByCode    │              │
  │                       │ ────────────────────► │              │
  │                       │ ◄─── id_token+claims  │              │
  │                       │ validateAzureAdClaims │              │
  │                       │ staffService.getOrCreateStaff         │
  │                       │       ─────────────────────────────► │
  │                       │       ◄──── staff record ─────────── │
  │                       │ signStaffToken                       │
  │                       │ refreshStore.set(handle, …)          │
  │ ◄─ 302 /auth/callback?token=<jwt>                            │
  │    Set-Cookie __Host-app_rf=<handle>                          │
  │                                                                │
  │  GET /auth/me  Bearer <jwt>                                    │
  │ ───────────────────►  jwt.verify → staffService.findStaffById │
  │ ◄─── 200 { user }                                              │
  │                                                                │
  │  (2h 后 jwt 过期)                                              │
  │  POST /auth/refresh  Cookie:__Host-app_rf                      │
  │ ───────────────────►  refreshStore.get → silentRefresh(best-effort)
  │                       signStaffToken → rotateHandle           │
  │ ◄─── 200 { accessToken }   Set-Cookie 新 handle                │
  │                                                                │
  │  POST /auth/logout    │                                        │
  │ ───────────────────►  refreshStore.delete + clearCookie       │
  │ ◄─── 200 { success:true }                                      │
```

---

## 迁移 checklist

迁移到新环境/新实例时按这张表逐项核对：

- [ ] **环境变量**：`AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID`（或 `AZURE_AD_ALLOW_ANY_TENANT=true`）、`JWT_SECRET`、`BASE_URL` / `API_BASE_URL`、`FRONTEND_URL`、`NODE_ENV`、可选 `MSAL_SCOPES` / `AZURE_AD_API_CLIENT_ID` / `ALLOWED_ORIGINS`
- [ ] **Azure AD 应用注册**：在 Azure 门户里把 `${BASE_URL}/auth/redirect` 加进 Redirect URIs（Web 平台）
- [ ] **DB 迁移**：`Staff` 表 `identityKey` / `email` 的 unique 约束必须存在
- [ ] **Refresh store**：进入多实例/serverless 必须换成 Redis 等共享存储；保留 `get/set(ttl)/delete/rotateHandle` 接口
- [ ] **CORS**：把前端域名加进 `expressApp.ts` 的 `allowedOrigins` 或 `ALLOWED_ORIGINS`
- [ ] **Cookie 跨域**：`sameSite:'none'` + `secure:true` 在生产是必须的，前端必须用 HTTPS
- [ ] **前端 callback 路由**：`${FRONTEND_URL}/auth/callback?token=...` 要存在
- [ ] **登出策略**：是否需要主动吊销 App JWT（默认不吊销）
- [ ] **state 校验**：考虑增加 cookie-bound state，提升 CSRF 防护
- [ ] **管理员账号**：新用户默认 `STAFF`，第一位 ADMIN 需要 DB 手动 UPDATE
