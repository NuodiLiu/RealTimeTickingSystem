# backend-csharp

C# / .NET 9 重写版后端。

> 这份目录是 [AGENTS.md](../AGENTS.md) 指定的迁移目标。任何改动前请先读 AGENTS.md 与 [backend/docs/](../backend/docs/) 下对应模块的 `api-*.md`。

## 当前进度

- ✅ **Phase 0** — Skeleton + smoke test
- ✅ **Phase 1** — Domain 聚合（全部完成）
  - ✅ Staff
  - ✅ KioskDevice（含 KioskLock 内部实体，双状态机：Pairing + Lock）
  - ✅ Case（主流程状态机：Queued → InProgress → PendingFeedback → Resolved）
  - ✅ FeedbackSession（Created → Delivered → Submitted/Cancelled/Overridden/Expired）
- ⬜ Phase 2 — Application
- ⬜ Phase 3 — Infrastructure
- ⬜ Phase 4 — WebApi
- ⬜ Phase 5 — Cloud Services

## 一次性环境安装

需要 **.NET 9 SDK**（不是 Runtime）。

```bash
# macOS — 推荐
brew install --cask dotnet-sdk

# 验证
dotnet --version           # 期望: 9.0.x
dotnet --list-sdks
```

> 如果 brew 装的版本低于 9.0.100，编辑 [global.json](global.json) 把 `version` 改为你实际安装的版本，或访问 https://dot.net/download 拿 .NET 9 SDK 安装包。

## 验证 Phase 0 / Phase 1

```bash
cd backend-csharp

# 还原 NuGet 包（首次必须）
dotnet restore

# 编译 — 应该全绿
dotnet build --no-restore

# 跑全部测试 — 应该 0 failed
dotnet test --no-build
```

预期输出（Phase 1 完成后）：
```
Test run for ...Tickets.Domain.Tests.dll (.NET 9.0)
Passed!  - Failed: 0, Passed: 30+, Skipped: 0
```

> 测试零失败之前**禁止**开始 Phase 2。

## 跑 WebApi（仅 health check）

```bash
dotnet run --project src/Tickets.WebApi
# 然后另开终端
curl http://localhost:5080/health
# {"status":"ok"}
```

## 项目结构

参见 [AGENTS.md §3](../AGENTS.md)。简而言之：

```
src/
  Tickets.Domain/         ← 零依赖，聚合 + 状态机
  Tickets.Application/    ← 用例编排
  Tickets.Infrastructure/ ← EF Core / Azure SDK 实现
  Tickets.WebApi/         ← Minimal API endpoints
tests/
  *.Tests/                ← 对应每个 src 项目
```

## TDD 工作流

每次给聚合加新方法：

```bash
# 1. 在 tests/Tickets.Domain.Tests/<Aggregate>/ 下写失败测试
dotnet test --filter "FullyQualifiedName~<TestClass>"     # 🔴 红

# 2. 在 src/Tickets.Domain/<Aggregate>/ 下加最少代码
dotnet test --filter "FullyQualifiedName~<TestClass>"     # 🟢 绿

# 3. 重构
dotnet test                                               # 🔵 全套
```

提交规范见 [AGENTS.md §10](../AGENTS.md)。

## 常见问题

**Q: NU1100 / 找不到包？**
A: `dotnet restore` 没跑。或检查网络代理。

**Q: NETSDK1045 — 不支持 net9.0？**
A: 装的是 SDK 8 或更老。`dotnet --list-sdks` 应有 9.0.x。

**Q: 在 Domain 里能不能 `using Microsoft.EntityFrameworkCore`？**
A: 不能。`Tickets.Domain.csproj` 没引用任何包，编译就会失败。这是 [AGENTS.md §7 #1](../AGENTS.md) 的硬约束。

**Q: 测试里能不能 `DateTime.UtcNow`？**
A: 不能。用 `FakeClock`。产品代码也禁用，全部走 `IClock`。

## 接下来

Phase 1 还需完成 3 个聚合：
1. `KioskDevice` — 双状态机（Pairing + Lock），含内部 `KioskLock` 实体
2. `Case` — 主流程状态机（Queued → InProgress → PendingFeedback → Resolved）
3. `FeedbackSession` — Created → Delivered → Submitted/Cancelled/Overridden/Expired

每个聚合走同样的 TDD 流程：先写测试，再写实现，最后跑 `dotnet test` 全绿。
