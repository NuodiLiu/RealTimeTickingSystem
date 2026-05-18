# AGENTS.md — C# 迁移指南

> 这份文档是 AI agent 做 **Node/TypeScript backend → .NET / C# 迁移** 的"宪法"。每次开新任务前先读本文件，再读对应 `backend/docs/api-*.md`。

---

## 0. Mission（一句话）

把 [backend/](backend/) 里的 Node/Express/Prisma 后端，**重新设计**为：
- **.NET 9 + C# 12** 后端
- **DDD + 经典分层架构**（Domain / Application / Infrastructure / WebApi）
- **显式状态机**取代散落的 if/CAS 逻辑（Case / FeedbackSession / KioskLock / Device 四个聚合）
- **TDD 严格执行**（红 → 绿 → 重构，先有失败的测试再写产品代码）
- **CloudServices 留到最后**（Azure AD / Azure SignalR / Azure SQL 等放到 Phase 5 才接，前面全部用 in-memory / fake）

迁移的目的 **不是 1:1 复制**，而是借迁移修掉 [backend/docs/](backend/docs/) 列出的 **130 条已知坑点**。

---

## 1. Source of Truth（必读顺序）

按以下顺序阅读，每份都是 SoT（Source of Truth）：

1. **本文件**（AGENTS.md）—— 总纲、状态机、TDD 规则、phase 顺序
2. **[backend/docs/api-auth.md](backend/docs/api-auth.md)** —— Auth 模块（10 坑）
3. **[backend/docs/api-pair.md](backend/docs/api-pair.md)** —— Pair 模块（12 坑）
4. **[backend/docs/api-device.md](backend/docs/api-device.md)** —— Device 模块（15 坑）
5. **[backend/docs/api-cases.md](backend/docs/api-cases.md)** —— Cases 模块（20 坑）
6. **[backend/docs/api-feedback.md](backend/docs/api-feedback.md)** —— Feedback 模块（25 坑）
7. **[backend/docs/api-signalr.md](backend/docs/api-signalr.md)** —— SignalR 模块（26 坑）
8. **[backend/docs/api-excel.md](backend/docs/api-excel.md)** —— Excel 模块（22 坑）
9. **[backend/prisma/schema.prisma](backend/prisma/schema.prisma)** —— 现有 DB schema（仅作为业务字段参考；迁移时按 DDD 重新建模）

> ❗ Node 源码（`backend/src/**`）**只用作业务逻辑参考**，不照抄结构。

---

## 2. Tech Stack（固定，不要换）

| 项 | 选型 | 备注 |
|---|---|---|
| Runtime | .NET 10（向后兼容 .NET 9 包） | 不接受 .NET Framework / .NET Standard |
| 语言 | C# 12 (file-scoped namespace, primary ctor, required modifier, collection expressions) | 不用过时语法 |
| Web | ASP.NET Core Minimal API | 控制器只在确实需要时引入；优先 endpoint routing |
| ORM | EF Core 9 + PostgreSQL (Npgsql) | 与现有 DB 保持 Postgres |
| 测试 | xUnit + FluentAssertions + NSubstitute | **不要** Moq（NSubstitute 语法更顺手） |
| 验证 | FluentValidation | 在 Application 层 |
| 序列化 | System.Text.Json | snake_case 兼容前端时显式配 `JsonNamingPolicy.SnakeCaseLower` |
| 状态机 | **手写**（不依赖 Stateless 等库） | 状态转换是领域逻辑，必须在聚合里 |
| 日志 | Serilog + structured logging | 不用 `Console.WriteLine` |
| Mediator | **不引入** MediatR | Application 服务用普通类，依赖注入即可 |
| 实时通信 | Azure SignalR Service（Phase 5） | 前面 phase 用接口 + Fake |
| 身份 | Microsoft.Identity.Web（Phase 5） | 前面 phase 用 Fake JWT bearer |

---

## 3. Solution 结构（一次建好，不再动）

```
RealTimeTickingSystem.sln
├─ src/
│  ├─ Tickets.Domain/                  ← 纯 C#，零外部依赖（除 BCL）
│  │  ├─ Cases/
│  │  │  ├─ Case.cs                    (Aggregate Root)
│  │  │  ├─ CaseStatus.cs              (enum)
│  │  │  ├─ Events/                    (CaseQueued, CaseTaken, …)
│  │  │  └─ Errors/                    (CaseAlreadyTakenError, …)
│  │  ├─ FeedbackSessions/
│  │  │  ├─ FeedbackSession.cs         (Aggregate Root)
│  │  │  ├─ FeedbackSessionStatus.cs
│  │  │  └─ Events/
│  │  ├─ Devices/
│  │  │  ├─ KioskDevice.cs             (Aggregate Root — 含 KioskLock 作为内部实体)
│  │  │  ├─ KioskLock.cs               (内部 Entity，不暴露)
│  │  │  ├─ DeviceMode.cs
│  │  │  ├─ Events/
│  │  │  └─ Errors/
│  │  ├─ Staff/
│  │  │  └─ Staff.cs                   (Aggregate Root)
│  │  ├─ Shared/
│  │  │  ├─ ValueObjects/              (IdentityKey, EmployeeNo, EmailAddress, …)
│  │  │  ├─ Errors/                    (DomainError base, ConcurrencyError, …)
│  │  │  └─ Time/                      (IClock 抽象)
│  │  └─ Abstractions/                 (IRepository<T>, IUnitOfWork)
│  │
│  ├─ Tickets.Application/             ← 用例编排，依赖 Domain
│  │  ├─ Cases/
│  │  │  ├─ Commands/                  (PostCaseCommand, TakeCaseCommand, …)
│  │  │  ├─ Queries/
│  │  │  └─ Handlers/                  (PostCaseHandler, …)
│  │  ├─ Pairing/
│  │  ├─ Devices/
│  │  ├─ Feedback/
│  │  ├─ Auth/
│  │  ├─ Reporting/                    (Excel/JSON 导出)
│  │  ├─ Abstractions/                 (INotificationGateway, IPairingTokenGenerator, …)
│  │  └─ ApplicationException.cs
│  │
│  ├─ Tickets.Infrastructure/          ← 实现 Application 的抽象
│  │  ├─ Persistence/
│  │  │  ├─ TicketsDbContext.cs        (EF Core)
│  │  │  ├─ Configurations/            (IEntityTypeConfiguration<T>)
│  │  │  └─ Repositories/
│  │  ├─ Time/SystemClock.cs
│  │  ├─ Notifications/                (Phase 5 才接 Azure SignalR)
│  │  │  ├─ FakeNotificationGateway.cs (Phase 2-4 用)
│  │  │  └─ AzureSignalRGateway.cs     (Phase 5)
│  │  ├─ Identity/                     (Phase 5 才接 Azure AD)
│  │  └─ Reporting/Xlsx/               (ClosedXML 实现导出)
│  │
│  └─ Tickets.WebApi/                  ← Minimal API endpoints
│     ├─ Program.cs
│     ├─ Endpoints/
│     │  ├─ AuthEndpoints.cs
│     │  ├─ PairEndpoints.cs
│     │  ├─ DeviceEndpoints.cs
│     │  ├─ CaseEndpoints.cs
│     │  ├─ FeedbackEndpoints.cs
│     │  ├─ SignalREndpoints.cs        (含 webhook)
│     │  └─ ExcelEndpoints.cs
│     ├─ Middleware/                   (ErrorHandling, RequestLogging)
│     └─ appsettings.json
│
└─ tests/
   ├─ Tickets.Domain.Tests/            ← 纯单元测试，全部 in-memory，毫秒级
   ├─ Tickets.Application.Tests/       ← Handler + Fake 基础设施
   ├─ Tickets.Infrastructure.Tests/    ← EF Core 用 Testcontainers Postgres（Phase 3 才需要）
   └─ Tickets.WebApi.Tests/            ← WebApplicationFactory 集成测试
```

### 依赖方向（不能反过来）
```
WebApi      ──► Application ──► Domain
   └────────────────┐              ▲
                    ▼              │
              Infrastructure ──────┘
```
**Domain 不依赖任何项目**。Infrastructure / WebApi 都依赖 Application，Application 依赖 Domain。

### 命名空间
- 根命名空间：`RealTimeTickingSystem`（或简写 `RTT`，统一即可）
- 项目命名空间对齐项目名（`Tickets.Domain.Cases` 等）

---

## 4. 状态机重新设计（**核心** — 这是迁移的灵魂）

老系统的状态散落在 service 各处，靠 `updateMany` + 条件 where 实现 CAS；新系统**所有状态转换都封装在聚合根的方法里**，方法只接受合法转换，否则抛 `DomainError`。

### 4.1 `Case` 聚合（StudentCase）

```
                        ┌──────────┐
                        │  Queued  │ ◄────────────── new Case (POST /cases)
                        └────┬─────┘
                             │ Take(staffId, clock)
                             ▼
                       ┌─────────────┐
                       │ InProgress  │
                       └──┬──────┬───┘
       RequestFeedback ◄──┘      └──► ResolveDirectly  ─┐
       (deviceId, lockId,             (no feedback flow) │
        sessionId, clock)                                │
                ▼                                        ▼
       ┌──────────────────┐                       ┌──────────┐
       │ PendingFeedback  │ ───────────────────►  │ Resolved │ (terminal)
       └────┬─────┬───────┘  SubmitFeedback /     └──────────┘
            │     │          ForceResolve /
            │     │          FeedbackOverridden /
            │     │          FeedbackExpired
            │     │
            │     └──► AbandonFeedbackSession (回到 InProgress，可选)
            ▼
        Escalation（正交属性，不改主状态；仅在 InProgress / PendingFeedback 允许）
```

**新增 vs 老系统：**
- 老系统：`escalateCase` 不改 status，且 `RESOLVED_PENDING_FEEDBACK` 没强约束。
- 新系统：`Escalate(...)` 是 InProgress / PendingFeedback 状态下的方法，不创建新状态，但发 `CaseEscalated` 事件并写 `EscalatedAt`、`EscalatedTo`、`ResolvedOnSite`。若 `resolvedOnSite=true`，**强制**调用方在同事务里再 `ResolveDirectly()`（不自动）。

**禁止的非法转换（必须抛 `InvalidStateTransitionError`）**：
- `Resolved.Take()` / `Resolved.Resolve()`（老系统 [api-cases.md 坑 5](backend/docs/api-cases.md)：会覆盖 `resolvedAt`）
- `PendingFeedback.Take()`
- `Queued.Resolve()`（必须先 Take）

**聚合方法签名（示例）**：

```csharp
public sealed class Case
{
    public CaseId Id { get; }
    public CaseStatus Status { get; private set; }
    public StaffId? AssignedStaffId { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }
    public string? EscalatedTo { get; private set; }
    public bool? ResolvedOnSite { get; private set; }
    public uint Version { get; private set; }   // 乐观锁

    private readonly List<DomainEvent> _events = [];
    public IReadOnlyList<DomainEvent> DomainEvents => _events;

    public static Case Queue(StudentName name, Category cat, ZId? zid, IClock clock) { … }
    public void Take(StaffId staff, IClock clock) { … }
    public void RequestFeedback(DeviceId d, KioskLockId lockId, FeedbackSessionId s, IClock clock) { … }
    public void ResolveDirectly(IClock clock) { … }
    public void SubmitFeedback(IClock clock) { … }
    public void ForceResolve(IClock clock) { … }
    public void Escalate(string department, bool? resolvedOnSite, IClock clock) { … }
    public void AbandonFeedbackSession(IClock clock) { … }   // PendingFeedback → InProgress
}
```

每个方法的契约（要写到 XML doc）：
1. 校验当前状态允许该转换 → 否则抛 `InvalidStateTransitionError`
2. 修改状态 + 时间戳 + version+=1
3. 添加领域事件到 `_events`
4. **不直接调外部**（不调 Repository / SignalR / DB），全部由 Application 层在 commit 后做

### 4.2 `FeedbackSession` 聚合

```
                  ┌─────────┐
                  │ Created │ ◄── new (由 Case.RequestFeedback 触发)
                  └────┬────┘
                       │ MarkDelivered（SignalR ACK）
                       ▼
                  ┌──────────┐
                  │Delivered │
                  └────┬─────┘
                       │
        ┌──────────────┼──────────────┐
   Submit         Override         Cancel
   (rating,                          (Case.ForceResolve)
    comment)
        │              │                │
        ▼              ▼                ▼
   ┌──────────┐  ┌────────────┐   ┌───────────┐
   │Submitted │  │ Overridden │   │ Cancelled │
   └──────────┘  └────────────┘   └───────────┘   ─┐
                                                    │
   Expire（定时任务） ──────────► ┌─────────┐      │
   （Created / Delivered → ）     │ Expired │ ◄────┘
                                  └─────────┘
   Submitted / Overridden / Cancelled / Expired 均为终态
```

**强约束**：
- `Created/Delivered` 才可 `Submit / Cancel / Override / Expire`
- `Submit(rating, comment, clock)`：rating ∈ [1,5] integer，comment ≤ 1000 chars
- **不允许跳过 Delivered 直接 Submit**（这是与老系统的差异，但实际 ACK 收不到时应有兜底 → 由 Application 层提供 `ConfirmDelivery + Submit` 的复合用例）

> 老系统坑 [api-feedback.md 坑 16](backend/docs/api-feedback.md)：submit 没校验 deviceId === session.deviceId。新系统在 Application 层强制校验。

### 4.3 `KioskDevice` 聚合（含 `KioskLock` 内部实体）

`KioskLock` **不暴露为独立聚合**，而是 `KioskDevice` 的内部实体。理由：lock 的生命周期完全跟 device 绑定，单独存在没意义，且老系统的 `device.currentLockId` 唯一索引正说明这点。

**Pairing 状态**：
```
┌──────────┐    Pair(secret)    ┌────────┐    Unpair (must be Idle)    ┌──────────┐
│Unpaired  │  ────────────────► │ Paired │ ──────────────────────────► │Unpaired  │
└──────────┘                    └────────┘                              └──────────┘
                                     ▲
                                     │ Pair（重配，可携带 deviceId 或同名复用）
                                     │
                            （事务内 secretHash 重生成）
```

**Lock 状态（Paired device 内部）**：
```
                  ┌──────┐
                  │ Idle │
                  └──┬───┘
                     │ AcquireLock(staffId, caseId, lease, clock)
                     ▼
                  ┌──────┐
                  │ Busy │  (currentLockId, lockVersion)
                  └──┬───┘
                     │  CompleteLock(clock)        → Idle
                     │  OverrideLock(staffId, …)   → Idle (旧 lock=Overridden, 新建 lock 在同一事务)
                     │  ExpireLock(clock)          → Idle (lease 过期由 background job 触发)
                     ▼
                  ┌──────┐
                  │ Idle │
                  └──────┘
```

**Connectivity 与 Lock 解耦**（与老系统不同）：
- `IsConnected` / `LastSeenAt` 仍然是 device 字段，但**不再触发 lock cleanup**
- 老系统坑 [api-signalr.md 坑 4](backend/docs/api-signalr.md)：disconnect 立刻 RESOLVE case，被新系统**禁止**
- 改为 background job：device offline 超过 N 分钟（默认 5 分钟，可配）才调 `ExpireLock` + 通知 Case 走 `FeedbackExpired` 路径

**Mode 切换约束**：仅 `Idle` 状态可 `ChangeMode`（与老系统一致）。

### 4.4 老→新 状态映射表

| 老系统状态 | 新系统聚合.状态 |
|---|---|
| `StudentCase.QUEUED` | `Case.Status = Queued` |
| `StudentCase.IN_PROGRESS` | `Case.Status = InProgress` |
| `StudentCase.RESOLVED_PENDING_FEEDBACK` | `Case.Status = PendingFeedback` |
| `StudentCase.RESOLVED` | `Case.Status = Resolved` |
| `KioskDevice.deletedAt != null` | `KioskDevice.PairingStatus = Unpaired` |
| `KioskDevice.currentLockId != null` | `KioskDevice.LockState = Busy` |
| `KioskLock.ACTIVE` | `KioskDevice.CurrentLock.Status = Active` |
| `KioskLock.COMPLETED/OVERRIDDEN/EXPIRED` | （历史 lock，新系统按需要存历史表或只保留 Active）|
| `FeedbackSession.CREATED/DELIVERED/SUBMITTED/OVERRIDDEN/CANCELLED/EXPIRED` | 一一对应 |

---

## 5. TDD 工作流（**严格**执行）

### 5.1 红→绿→重构

每一个公开行为（domain method / application handler / endpoint）按以下三步：

1. **🔴 红**：先写测试，运行，确认失败（"failing for the right reason"）。
   - Domain 测试：`[Fact] public void Case_Take_FromQueued_ShouldTransitionToInProgress() { … }`
   - Application 测试：用 NSubstitute 装 `IRepository`、`IClock`、`INotificationGateway`
   - WebApi 测试：用 `WebApplicationFactory<Program>` + `InMemory` 或 Testcontainers
2. **🟢 绿**：写**最少**的产品代码让测试通过。**禁止**写"未来可能要用"的代码。
3. **🔵 重构**：测试还在跑，重构代码消除重复 / 改名 / 抽方法。每次重构后跑全套测试。

### 5.2 命名约定

测试方法名：`<被测对象>_<场景>_<期望>`
- `Case_Take_FromQueued_ShouldTransitionToInProgress`
- `Case_Take_FromInProgress_ShouldThrowInvalidStateTransitionError`
- `Case_Take_FromResolved_ShouldThrowInvalidStateTransitionError`

每个状态转换都要至少 **3 个测试**：
1. happy path（合法转换）
2. illegal source state（每个非法起点 1 个）
3. invariant violation（参数非法 / 时间戳异常 / 并发冲突等）

### 5.3 测试金字塔

```
        ▲     /────────\
        │    /  E2E      \   (Tickets.WebApi.Tests, 用 WebApplicationFactory + Testcontainers)
        │   /─────────────\   ≤ 20 个，最关键路径
        │  /  Integration  \  (Tickets.Infrastructure.Tests, EF Core + 真 Postgres)
        │ /─────────────────\  ≤ 50 个，仓储 / EF mapping
        │/      Unit          \ (Tickets.Domain.Tests + Tickets.Application.Tests)
        ─────────────────────  数百个，毫秒级
```

**Domain 测试不允许触碰** EF Core、HTTP、SignalR、文件系统。

### 5.4 Coverage Gate（CI 强制）

| 项目 | 行覆盖率 | 分支覆盖率 |
|---|---|---|
| Tickets.Domain | ≥ 95% | ≥ 90% |
| Tickets.Application | ≥ 85% | ≥ 80% |
| Tickets.Infrastructure | ≥ 70% | ≥ 60% |
| Tickets.WebApi | ≥ 60% | — |

低于阈值 CI 失败。

### 5.5 测试数据

- 不要在测试里 `new Case(...)`；用 **Object Mother / Test Data Builder**：
  ```csharp
  public static class CaseBuilder
  {
      public static Case Queued(IClock? clock = null) =>
          Case.Queue(new("Liam"), new("technical"), null, clock ?? new FakeClock());
      public static Case InProgress(StaffId? staff = null, IClock? clock = null) { … }
      public static Case PendingFeedback(…) { … }
  }
  ```
- `IClock` 必须用 `FakeClock`（手动推进时间），**禁止** `DateTime.UtcNow`/`DateTimeOffset.UtcNow` 出现在产品代码里。

---

## 6. 实施 Phase（**严格按顺序**）

> **每个 phase 必须有 PR 级别的 commit boundary，跑完所有测试再开下一个 phase。**

### Phase 0 — Skeleton（半天）
- 建 sln + 4 个 src 项目 + 4 个 test 项目
- 配置 EditorConfig + .gitignore + Directory.Packages.props（中央包管理）
- 配 CI（GitHub Actions / Azure Pipelines）：build + test + coverage 上报
- 在 `Tickets.Domain.Tests` 写 1 个空 `[Fact] public void Smoke() => true.Should().BeTrue();` 验证 pipeline
- **不允许引入任何业务代码**

### Phase 1 — Domain（按聚合一个一个来）
顺序：`Staff → KioskDevice → Case → FeedbackSession`

每个聚合：
1. 定义 ValueObjects（Id 类型用 `record struct`，业务字段做强类型）
2. 写状态机骨架（私有 ctor + 静态工厂方法 + 状态转换方法）
3. **TDD**：每个状态转换的 3 个测试 → 实现 → 重构
4. 定义 DomainEvents（`abstract record DomainEvent(DateTimeOffset OccurredAt);` 派生）
5. **不写**仓储实现，只写 `IXxxRepository` 接口（放在 `Tickets.Domain.Abstractions`）

完成 Phase 1 = 所有领域规则 100% in-memory 可测。

### Phase 2 — Application（用例编排）
- 每个 endpoint 对应一个 `Command` / `Query` + `Handler`
- Handler 依赖：`IXxxRepository`、`IClock`、`IUnitOfWork`、`INotificationGateway`（接口）
- 用 `Tickets.Application.Tests` 跑 handler，所有外部依赖都 Substitute
- 引入 `FluentValidation`，每个 Command 有 Validator
- 在 Application 层定义 `Result<T>` / `Error` 类型（不抛异常做业务流；异常仅用于真正异常）

### Phase 3 — Infrastructure（EF Core + 真 DB）
- 建 `TicketsDbContext`
- `IEntityTypeConfiguration<T>` 每聚合一个：值对象用 `ComplexProperty` 或 `OwnsOne`，状态用 `HasConversion<string>()`
- 仓储实现：注意 `Include` 边界（聚合根加载时只 include 同聚合内的实体）
- **乐观锁**：`Version` 字段配 `IsConcurrencyToken()`；EF 会自动生成 `WHERE version=?` 并抛 `DbUpdateConcurrencyException`，仓储层把它转成 `ConcurrencyError`
- 仓储测试：用 [Testcontainers Postgres](https://testcontainers.com/modules/postgresql/)，**不用 InMemory provider**（会掩盖 SQL 行为）
- 写 EF 数据迁移脚本，与现有 Prisma schema 兼容（不要破坏现有数据）

### Phase 4 — WebApi（Endpoints + Fake Cloud）
- Minimal API endpoints，每个 endpoint ≤ 10 行（把工作丢给 Application）
- 全局错误处理中间件：`InvalidStateTransitionError → 409`、`ConcurrencyError → 409 with retry-after`、`ValidationException → 400`、`NotFoundError → 404`
- `INotificationGateway` 用 `FakeNotificationGateway`（写到内存队列，测试可观察）
- 身份用 `JwtBearer` + 测试用 fake issuer
- `WebApplicationFactory<Program>` 集成测试覆盖每个 endpoint 的 happy path + 关键失败 path

### Phase 5 — Cloud Services（**最后**才接，单独的 PR）
按顺序，每个上一个 commit：
1. **Postgres**（Azure Database for PostgreSQL）— 已在 Phase 3 用 Testcontainers 验证
2. **Microsoft.Identity.Web** → 替换 fake JWT
3. **Azure SignalR Service** → 实现 `AzureSignalRGateway : INotificationGateway`；挂 webhook（**必须**带签名校验，参见 [api-signalr.md 坑 1](backend/docs/api-signalr.md)）
4. **Azure Storage / Blob**（如果导出大文件）—— 不在 Phase 5 必需
5. **Application Insights / Log Analytics**

每接一个 cloud service：先写 integration 测试（用真 Azure 资源 / Azurite / Emulator），再切产品代码。Phase 4 的测试**不能因为接 cloud 而失败**——所有 Fake 必须能与真实现并存。

---

## 7. Non-negotiables（违反 = PR reject）

1. **Domain 零依赖**：`Tickets.Domain.csproj` 的 `<ItemGroup>` 不能有任何 PackageReference / ProjectReference（除了 BCL）。
2. **状态转换只在聚合方法里**：Application / WebApi 不允许直接改 `Case.Status` 等字段（用 `private set`）。
3. **TDD 先红后绿**：commit message 里要能看出红 → 绿的两步。**禁止**在没有失败测试的情况下加产品代码。
4. **`DateTimeOffset.UtcNow` 黑名单**：产品代码全部走 `IClock.UtcNow`。CI 用 `grep` 检查。
5. **不抛 raw `Exception`**：业务流程错误用 `DomainError` / `Result<T>`，只有真异常（DB 挂、网络挂）才抛。
6. **SignalR 调用不阻塞业务**：`INotificationGateway` 实现失败必须 swallow + log（不让 HTTP 500），参见 [api-cases.md 坑 4](backend/docs/api-cases.md) / [api-feedback.md 坑 9](backend/docs/api-feedback.md)。
7. **没有 cloud SDK 在 Phase 1-4**：`Tickets.Application` / `Tickets.Domain` 不能引用 `Microsoft.Azure.*` 或 `Microsoft.Identity.*`。
8. **不要 ORM 自动迁移生产**：所有 schema 改动都生成 EF Core Migration 文件，提交评审。
9. **不要 `dynamic` / `object` 当业务类型**：参数用强类型 ValueObject。
10. **不要在测试里 `Thread.Sleep`**：用 `FakeClock.Advance(TimeSpan)`。
11. **不要在 endpoint 里写业务**：endpoint 仅做 `request → command → handler → response`；任何 if 都应放进 handler 或 domain。
12. **错误响应 schema 固定**：`{ error: "<code>", error_description: "<msg>", trace_id?: "<id>" }`，沿用现有 [api-auth.md OAuth-2.0 风格](backend/docs/api-auth.md)。

---

## 8. 现有 API 行为契约（迁移边界）

迁移**保持 HTTP 契约不变**（路径、方法、请求/响应 schema），让前端 / iPad 不用改：

- 所有 endpoint 列表与 schema 见各 `api-*.md`
- 老系统返回的字段名（如 `appJwt`、`deviceToken`）**保留**，即使新系统命名更合理也用 Adapter 转
- 错误 code 字符串（`busy`、`offline`、`precondition_failed`、`session_inactive` 等）一字不差保留
- 但**修复老系统已知行为缺陷**（如下方"必修坑点"）

### 8.1 必修坑点（迁移时**强制**修复，不留作 TODO）

| 来源 | 坑点 | 新系统行为 |
|---|---|---|
| api-cases.md 坑 5 | `resolveCase` 覆盖已 RESOLVED 的 case | `Case.ResolveDirectly()` 在 Resolved 状态抛 `InvalidStateTransitionError` |
| api-cases.md 坑 4 | SignalR 在事务外失败 = 500 | `INotificationGateway` 失败 log + swallow |
| api-feedback.md 坑 16 | submit 不校验 device 归属 | Application 层强制校验 `req.device.deviceId == session.deviceId` |
| api-feedback.md 坑 17 | lock 完成 CAS 无 count 检查 | EF Core 乐观锁 + version 自动校验 |
| api-signalr.md 坑 1 | webhook 签名未校验 | 强制接入 `AZURE_SIGNALR_WEBHOOK_SECRET`，缺则 503 |
| api-signalr.md 坑 3 | webhook upsert 自动建假设备 | `HandleDeviceConnect` 仅 update 已存在 device |
| api-signalr.md 坑 4 | disconnect 立即 RESOLVE case | 改为 background job + grace period（默认 5min） |
| api-device.md 坑 1 | 在线判定双轨制 | 统一用一种判定（推荐：SignalR connection + lastSeen 双因子） |
| api-pair.md 坑 1 | completePairing 无事务 | 整个流程 `await using var uow = …; await uow.SaveChangesAsync();` |
| api-pair.md 坑 2 | pairingToken 非真一次性 | CAS：`UPDATE pairing_sessions SET status='COMPLETED' WHERE token=? AND status='PENDING'`，count=0 即视为已被消费 |
| api-excel.md 坑 1 | XLSX 无行数上限 | Application 层强制 `MAX_EXPORT_ROWS=10000`，超出返 413 |
| api-excel.md 坑 7 | 三接口空数据行为不一致 | 全部返 200 |
| api-auth.md 坑 1 | OAuth state 未校验 | Phase 5 实现 cookie-bound state |
| api-auth.md 坑 2 | refreshStore 内存版 | Phase 3 用 EF Core 持久化 / Phase 5 用 Redis |

剩余 ~100 条坑点是改进项，建议每个 Phase 完成后做一轮"坑点清理 PR"。

### 8.2 不修但要文档化的"老系统怪行为"
- `/auth/redirect` 失败统一 302 重定向到 `/login?error=...`（保持，前端依赖）
- `wsEndpoint` 字段在 `/pair/complete` 响应里返 `/ws` 旧路径（保持兼容，但加 `Deprecation` header）
- dev test token `'test-token-123'` 仅在 `ASPNETCORE_ENVIRONMENT=Development` 启用

---

## 9. 重要技术决策

### 9.1 强类型 ID
所有聚合根 ID 用 `record struct`：
```csharp
public readonly record struct CaseId(Guid Value)
{
    public static CaseId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
```
EF Core 用 `HasConversion<Guid>()`。**禁止**用裸 `string` / `Guid` 当 ID 类型在方法签名里。

### 9.2 乐观锁
聚合根的 `Version` 字段：
```csharp
public uint Version { get; private set; }
```
EF Core configuration：
```csharp
builder.Property(x => x.Version).IsConcurrencyToken();
```
仓储 `Update` 时 EF 自动加 `WHERE version=?`，失败抛 `DbUpdateConcurrencyException` → 仓储捕获并 throw `ConcurrencyError`。

### 9.3 领域事件分发
聚合在状态转换时 `_events.Add(...)`，**不直接分发**。Application 层：
```csharp
await _repo.SaveAsync(aggregate);   // EF SaveChanges 后清空 _events
await _uow.CommitAsync();
foreach (var evt in aggregate.DomainEvents)
    await _eventDispatcher.DispatchAsync(evt);   // SignalR / Email / 其它 side effect
```
**不要**在 `SaveChanges` 之前分发（DB 失败时事件已外发，麻烦）。

### 9.4 状态机表示
**不引入** Stateless 等库。状态机就是聚合方法 + switch / pattern match：
```csharp
public void Take(StaffId staff, IClock clock)
{
    if (Status is not CaseStatus.Queued)
        throw new InvalidStateTransitionError(nameof(Case), Status, nameof(Take));

    Status = CaseStatus.InProgress;
    AssignedStaffId = staff;
    StartedAt = clock.UtcNow;
    Version++;
    _events.Add(new CaseTaken(Id, staff, StartedAt.Value));
}
```
状态机图请放在每个聚合文件顶部的 XML doc 注释里。

### 9.5 并发与重试
- HTTP 层不重试（让客户端拿到 409 自己决定）
- 老系统 `takeNextCase` 重试 3 次的逻辑迁移到 **Application Service**，用 `Polly` 配条件 retry，**仅对 `ConcurrencyError` 重试**

### 9.6 时间
```csharp
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
public sealed class SystemClock : IClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }
public sealed class FakeClock(DateTimeOffset start) : IClock
{
    public DateTimeOffset UtcNow { get; private set; } = start;
    public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
}
```

---

## 10. AI Agent 工作守则

每次开任务前，**必须**做以下检查：

```
☐ 1. 我读了 AGENTS.md 当前 phase 的部分了吗？
☐ 2. 我读了对应 backend/docs/api-<module>.md 了吗？
☐ 3. 这个任务有现成的 failing test 吗？没有 → 先写测试再继续。
☐ 4. 我要修的代码是 Domain / Application / Infrastructure / WebApi 哪一层？是否符合依赖方向？
☐ 5. 状态转换是否封装在聚合里？还是泄漏到了 Application / WebApi？
☐ 6. 有没有引入 cloud SDK 到 Domain / Application？（当前 phase < 5 → 禁止）
☐ 7. `DateTimeOffset.UtcNow` 出现在产品代码里了吗？（应全部走 IClock）
☐ 8. 测试是否独立（无 Thread.Sleep / Console / 文件 IO）？
☐ 9. PR 是否包含 测试 + 代码 + （必要时）EF Migration？
☐ 10. 我修了 backend/docs/api-*.md 里哪条坑？在 PR 描述里引用。
```

**每个 commit 的 message 模板**：
```
<phase>/<module>: <imperative summary>

- TDD: red → green for <test name>
- Closes pitfall #N from backend/docs/api-<module>.md
- Touches: <files>
```

---

## 11. 文档自维护

随着迁移推进，本文件需要同步更新：
- 状态机有调整 → 更新第 4 节
- 引入新依赖 → 更新第 2 节
- 发现新坑 → 同步到对应 `api-*.md` 的"已知坑点"区
- Phase 完成 → 在第 6 节对应小节加 ✅ 标记并写完成日期

**不要**把这份文档变成只读化石；它是活的迁移宪法。

---

## 12. Glossary（关键术语对齐）

| Node 老系统术语 | DDD 新系统术语 |
|---|---|
| service（如 `cases.service.ts`） | Application Service / Handler |
| controller | Endpoint（Minimal API） |
| middleware (auth) | Authentication / Authorization middleware（仍在 WebApi 层） |
| prisma model | EF Core Entity + Aggregate Root |
| `await prisma.$transaction([...])` | `IUnitOfWork.CommitAsync()` |
| CAS via `updateMany where ...` | EF Core `IsConcurrencyToken` + `Version` |
| `signalR.notifyDashboard(...)` | `INotificationGateway.NotifyDashboardAsync(...)` |
| `error.code === 'busy'` | `DomainError`（如 `DeviceBusyError : DomainError`） |
| `req.user`、`req.device` | `ICurrentUser` / `ICurrentDevice`（接口注入） |

---

**最后**：迁移成败的关键不是"语言切换"，而是把老系统散落的状态逻辑收敛到聚合里。每写一行 C# 之前问自己：**"这行代码所在的层，是否被允许做这件事？"** 如果答案模糊，回到第 3 / 4 / 7 节重读。
