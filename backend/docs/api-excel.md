# Excel API 详细文档

Admin 数据导出。三个 endpoint 共享一套查询/聚合逻辑（`ExcelService.getCasesForExport`），输出格式不同（XLSX / JSON / 预览统计）。

## 模块总览

- 路由挂载：[backend/src/expressApp.ts:206](../src/expressApp.ts#L206) → `app.use("/excel", excelRouter)`
- 路由：[backend/src/routers/excel.router.ts](../src/routers/excel.router.ts)
- 控制器：[backend/src/controllers/excel.controller.ts](../src/controllers/excel.controller.ts)
- 服务：[backend/src/services/excel.service.ts](../src/services/excel.service.ts)
- XLSX 库：`xlsx`（SheetJS）

### 鉴权矩阵
| Endpoint | 中间件 |
|---|---|
| `GET /excel/preview` | `requireJWTAuth + requireAdmin` |
| `GET /excel/cases/json` | `requireJWTAuth + requireAdmin` |
| `GET /excel/cases/xlsx` | `requireJWTAuth + requireAdmin` |
| `GET /excel/cases` | `requireJWTAuth + requireAdmin`（等价于 xlsx）|

> 全模块要求 `role === 'ADMIN'`（[auth.middleware.ts:44](../src/middlewares/auth.middleware.ts#L44)）。

### 共享 Query 参数

`ExcelController.parseFilters`（[excel.controller.ts:95-133](../src/controllers/excel.controller.ts#L95-L133)）

| 参数 | 类型 | 处理 |
|---|---|---|
| `status` | string 或 string[] | 全部转大写后 `WHERE status IN (...)` |
| `startDate` | ISO date string | `new Date()`，无效 → 400 'Invalid startDate format' |
| `endDate` | ISO date string | 同上，**自动设到当天 23:59:59.999** |
| `staffId` | string | `WHERE staffId = ?` |
| `category` | string | `WHERE category = ?`（精确匹配，大小写敏感） |
| `hasFeedback` | `'yes' \| 'no'` | 内存中过滤（DB 查询后 `cases.filter`） |

### 输出对比

| Endpoint | Content-Type | 是否聚合 | 文件大小 |
|---|---|---|---|
| `/excel/preview` | `application/json` | 仅汇总统计 | 小 |
| `/excel/cases/json` | `application/json` | 每行明细 | 中（无 sheets） |
| `/excel/cases/xlsx` `/excel/cases` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 主表 + 6 个统计 sheet | 大 |

---

## ⚠️ 已知坑点（迁移前必读）

| # | 坑点 | 影响 | 决策建议 |
|---|---|---|---|
| 1 | **无分页 / 无最大行数限制** | 查全表生成 XLSX 时内存占用极高（`xlsx` 把整本 workbook 加载到内存）；几万行可能 OOM | 加 `take` 上限 / 分批导出 / 流式导出 |
| 2 | **`xlsx` 库（SheetJS）的安全公告** | 历史上有原型污染等漏洞；该库的免费 community 版已停止维护 | 评估迁移到 `exceljs` 或 `xlsx-js-style` |
| 3 | **`hasFeedback` 过滤在内存里做** | DB 已经查回所有 case + feedback，再 JS 过滤；浪费带宽 | 改为 SQL 层 `where { feedback: filters.hasFeedback ? { isNot:null } : { is:null } }` |
| 4 | **`endDate` 自动延伸到当天 23:59:59.999** | 看似贴心，但用户传 `2024-01-15T10:00:00Z` 想精确到那一刻时会被强制改成 23:59:59 | 仅当传 `YYYY-MM-DD` 纯日期才延伸；ISO 完整时间戳保持原值 |
| 5 | **`category` 精确匹配（大小写敏感）** | 但 `status` 自动 toUpperCase；行为不一致 | 决策统一：要么都精确，要么都归一化 |
| 6 | **`/excel/cases/json` 不返回 `status` 字段**（[excel.controller.ts:14-27](../src/controllers/excel.controller.ts#L14-L27)） | 调用方拿到 JSON 看不出 case 状态 | 加进 map 字段 |
| 7 | **`/excel/cases/xlsx` 空结果返 404**（[excel.controller.ts:43-47](../src/controllers/excel.controller.ts#L43-L47)） | 但 `/excel/cases/json` 空结果返 `200 []`；`/excel/preview` 空结果返 `200 { totalCases:0,... }` | 三个接口空数据行为不一致；建议都返 200 |
| 8 | **`avgWaitingTime ? formatDuration : 'N/A'`** 等多处把 `0` 当 falsy（[excel.service.ts:281-283](../src/services/excel.service.ts#L281-L283)） | 平均等待时间 = 0 秒时显示 N/A（数据语义错误）| 改为 `=== null` 判断 |
| 9 | **`feedbackRating || null`** 同样有 falsy 坑（[excel.service.ts:174](../src/services/excel.service.ts#L174)） | 如果 rating === 0（虽然校验是 [1,5]，但数据脏的话）会被当 null | rating 已被 service 层强制 [1,5]，问题小；但仍建议显式 null 判断 |
| 10 | **`workbookToBuffer` 同步阻塞** ([excel.service.ts:536-542](../src/services/excel.service.ts#L536-L542)） | XLSX.write buffer 大时阻塞 event loop | 大文件用流式 API；或放到 worker thread |
| 11 | **`generateFileName` 时间精度只到日**（[excel.service.ts:544-548](../src/services/excel.service.ts#L544-L548)） | 同一天多次导出文件名相同 → 浏览器可能直接覆盖下载 | 加 timestamp 或 hash |
| 12 | **`getStatusBreakdown` / `getCategoryBreakdown` 在 controller** ([excel.controller.ts:136-162](../src/controllers/excel.controller.ts#L136-L162))，**`generateSummaryStats` 等在 service** | 聚合逻辑分散在两层 | 统一放到 service |
| 13 | **`estimatedFileSize` 写死 `0.5KB / case`**（[excel.controller.ts:83](../src/controllers/excel.controller.ts#L83)） | 实际文件大小取决于 comment 长度；估算无意义 | 删或改为真实样本估算 |
| 14 | **`/excel/cases` 和 `/excel/cases/xlsx` 完全相同** | 两条路径维护一份代码可接受，但语义不一致（cases 听起来是 JSON）| 删一个或加 deprecation header |
| 15 | **`staffEmail` 暴露在导出文件里** | 报表通常会被分享 / 邮件转发；员工邮箱可能不该外泄 | 决策：是否要脱敏 |
| 16 | **`/excel/preview` 也会拉全表**（[excel.controller.ts:71](../src/controllers/excel.controller.ts#L71)） | 名为 preview 实际仍跑 `getCasesForExport`，只是少了 XLSX 生成 | 改为 SQL 直接 count + groupBy |
| 17 | **`startDate > endDate` 不做校验** | 返空结果但不报错 | 加 `if (startDate > endDate) throw BadRequestError` |
| 18 | **`status` 转大写后没做枚举校验** | 传 `?status=foo` 会得到 `'FOO'`，DB 查询无匹配 → 返空 | 加白名单 `['QUEUED','IN_PROGRESS','RESOLVED_PENDING_FEEDBACK','RESOLVED']` |
| 19 | **`generateExcelWorkbook` 7 张 sheet 全在内存** | 同 #1，大数据时 OOM | 同 #1，加上限或换库 |
| 20 | **没记录"谁导出了什么"** | 数据合规上需要 audit | 加 audit log（caller staffId、filters、行数、时间） |
| 21 | **`waitingTimeSeconds: number | null`，0 视为合法值** | `formatted` 计算用 `waitingTimeSeconds ? ... : null` 仍有 0/null 混淆 | 统一显式 `=== null` 判断 |
| 22 | **`generateExcelWorkbook` async 但内部全是同步** | 函数签名 misleading | 改 sync 或真异步 |

---

## 1. `GET /excel/preview`

返回导出预览（不生成文件，仅汇总统计）。

源码：[excel.controller.ts:67-92](../src/controllers/excel.controller.ts#L67-L92)

### 入参
- Header：`Authorization: Bearer <Staff App JWT>`，role=ADMIN
- Query：同共享参数表

### 业务逻辑
```
1. requireJWTAuth + requireAdmin
2. filters = parseFilters(req.query)
3. data = ExcelService.getCasesForExport(filters)  // 查 DB + 计算 metrics + filter hasFeedback
4. preview = {
     totalCases: data.length,
     dateRange: {
       earliest: Math.min(...createdAt) || null,
       latest:   Math.max(...createdAt) || null
     },
     statusBreakdown:   { [status]: count },
     categoryBreakdown: { [category]: count },
     staffBreakdown:    { [staffName]: count },  // 跳过 null staffName
     filters,
     estimatedFileSize: `${Math.round(length * 0.5)}KB`
   }
5. 200 preview
```

### 分支
| 场景 | 响应 |
|---|---|
| 非 ADMIN | 403 ForbiddenRoleError |
| `startDate` / `endDate` 非法 | 400 |
| 0 行数据 | 200，但 dateRange.earliest/latest=null |
| 成功 | 200 preview |

### ⚠️
- 拉了全表，只是没生成 XLSX。预览不便宜。
- `statusBreakdown` 等用 `data.forEach`，仅看返回行的 status，过滤后的视图。

---

## 2. `GET /excel/cases/json`

返回精简 JSON 数组（不含汇总 sheet）。

源码：[excel.controller.ts:8-34](../src/controllers/excel.controller.ts#L8-L34)

### 入参
同 preview。

### 业务逻辑
```
1. requireJWTAuth + requireAdmin
2. filters = parseFilters(req.query)
3. data = ExcelService.getCasesForExport(filters)
4. result = data.map(row => ({
     zID, studentName, category,
     createTime: row.createdAt,
     takeTime:   row.startedAt,
     resolveTime:row.resolvedAt,
     processingTime: row.processingTimeSeconds,
     waitingTime:    row.waitingTimeSeconds,
     staffName, escalatedTo,
     feedbackRating, feedbackComment
   }))
5. 200 result
```

### 字段差异（vs `CaseExportData`）
| `CaseExportData` 含 | `/cases/json` 含 |
|---|---|
| 全部 30+ 字段 | 11 字段 |
| `status`、`staffEmail/Role`、`totalTimeSeconds`、`*Formatted`、`hasEscalation/hasFeedback/isComplete`、`feedbackCreatedAt` | 都不含（**包括 `status`** —— 坑点 #6） |

### 分支
| 场景 | 响应 |
|---|---|
| 非 ADMIN | 403 |
| 参数非法 | 400 |
| 0 行 | 200 `[]`（不同于 xlsx 的 404） |
| 成功 | 200 数组 |

---

## 3. `GET /excel/cases/xlsx`（与 `/excel/cases` 等价）

生成完整 XLSX 文件下载。

源码：[excel.controller.ts:37-64](../src/controllers/excel.controller.ts#L37-L64) / [excel.service.ts:193-257](../src/services/excel.service.ts#L193-L257)

### 入参
同 preview。

### 业务逻辑
```
1. requireJWTAuth + requireAdmin
2. filters = parseFilters(req.query)
3. data = ExcelService.getCasesForExport(filters)
4. data.length === 0 → 404 'No cases found matching the specified criteria'
5. workbook = ExcelService.generateExcelWorkbook(data):
   - Sheet 'All Cases'         （主明细，22 列）
   - Sheet 'Summary'           （12 行汇总指标）
   - Sheet 'By Category'       （每分类聚合）
   - Sheet 'By Staff'          （每员工聚合）
   - Sheet 'Time Analysis'     （等待/处理时长分桶）
   - Sheet 'Feedback Quality'  （评分分布 + 分类均分）
   - Sheet 'Date Trends'       （按天聚合）
6. buffer = XLSX.write(workbook, { type:'buffer', bookType:'xlsx', compression:true })
7. fileName = `cases_detailed_export_${YYYY-MM-DD}.xlsx`
8. Response headers:
     Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
     Content-Disposition: attachment; filename="..."
     Content-Length: buffer.length
9. res.send(buffer)
```

### 分支
| 场景 | 响应 |
|---|---|
| 非 ADMIN | 403 |
| 参数非法 | 400 |
| 0 行 | **404**（与 json/preview 不一致） |
| 成功 | 200，XLSX 二进制 |
| XLSX 生成异常 / OOM | 冒泡 → 500 |

### Sheet 详解

**Sheet 1: All Cases**（主明细）

22 列：Case ID（= zID）/ Student Name / Category / Status / Created At / Started At / Resolved At / Staff Name / Staff Email / Staff Role / Escalated To / Feedback Rating / Feedback Comment / Feedback Date / Waiting Time (seconds) / Processing Time (seconds) / Total Time (seconds) / Waiting Time / Processing Time / Total Time / Has Escalation / Has Feedback / Is Complete

**Sheet 2: Summary**
```
Total Cases, Resolved Cases, Resolution Rate, Cases with Feedback, Feedback Rate,
Escalated Cases, Escalation Rate, Complete Cases,
Avg Waiting Time, Avg Processing Time, Avg Total Time, Avg Rating
```

**Sheet 3: By Category** —— 每个 category 一行，含 Total/Resolved/Rate/Feedback/Escalated/Avg* 列

**Sheet 4: By Staff** —— 同上，按 staff 分组（key = `name (email)`，跳过 null staffName）

**Sheet 5: Time Analysis** —— 按时长分桶：
- `Very Fast (< 5min)` / `Fast (5-15min)` / `Normal (15-30min)` / `Slow (30-60min)` / `Very Slow (> 1hour)`
- 两组：Waiting Time 桶 + Processing Time 桶（Processing 仅用 `isComplete=true` 的样本，Waiting 用全部）

**Sheet 6: Feedback Quality**
- Total Feedback Received / Avg / Median / Feedback Rate
- 1-5 星 breakdown
- 每个 category 的平均分

**Sheet 7: Date Trends** —— 按 `YYYY-MM-DD` 分组，列：Total / Resolved / Resolution Rate / Avg Waiting Time / Avg Processing Time

### Metrics 计算逻辑

| 指标 | 公式 |
|---|---|
| `waitingTimeSeconds` | `(startedAt - createdAt) / 1000`，缺一即 null |
| `processingTimeSeconds` | `(resolvedAt - startedAt) / 1000`，缺一即 null |
| `totalTimeSeconds` | `(resolvedAt - createdAt) / 1000`，缺一即 null |
| `formatDuration` | 自适应：`<60s` → `Ns`；`<60min` → `Nm Ms`；`<24h` → `Nh Mm`；`else` → `Nd Hh` |
| `isComplete` | `!!(startedAt && resolvedAt)` |
| `calculateAverage` | `sum / length`，空数组 → null |
| `calculateMedian` | 排序后取中位数 |

### ⚠️ 失败模式
1. **大数据 OOM**：XLSX.write 把 7 个 sheet 全在内存生成；几万 case 容易爆。
2. **`formatDuration(0)` 返 `'0s'`**：但 `avgX ? formatDuration : 'N/A'` 让 0 显示为 N/A——逻辑错误。
3. **comment 含特殊字符**：XLSX 不会转义 HTML，但 Excel 打开会按 cell 类型解析。如果 comment 以 `=` 开头会被当公式（CSV/Excel 注入风险）。

---

## 端到端时序

```
Admin Portal              Backend                       DB
   │                         │                            │
   │ GET /excel/preview      │                            │
   │ ─────────────────────►  │ parseFilters → validate    │
   │                         │ getCasesForExport ───────► │
   │                         │ ◄── cases + staff + feedback (raw)
   │                         │ filter hasFeedback (in JS)
   │                         │ map → calc metrics
   │                         │ aggregate breakdowns
   │ ◄── 200 preview         │                            │
   │                         │                            │
   │ GET /excel/cases/xlsx   │                            │
   │ ─────────────────────►  │ parseFilters → validate    │
   │                         │ getCasesForExport          │
   │                         │ length===0 → 404           │
   │                         │ generateExcelWorkbook (7 sheets, in-memory)
   │                         │ XLSX.write → buffer        │
   │                         │ set Content-Disposition    │
   │ ◄── 200 binary.xlsx     │                            │
```

---

## 迁移 checklist

- [ ] **环境变量**：无 excel 模块独占的；依赖 `DATABASE_URL` / `JWT_SECRET`
- [ ] **行数上限**：评估生产数据量，加 `take` 或拆批
- [ ] **`xlsx` 库**：评估迁移到 `exceljs`（活跃维护 + 流式 API）
- [ ] **`hasFeedback` 改 SQL 层过滤**
- [ ] **统一空结果行为**：preview / json / xlsx 都返 200
- [ ] **`status` 白名单校验**
- [ ] **`startDate > endDate` 校验**
- [ ] **导出 audit log**：记录 staffId、filters、行数、时间戳
- [ ] **CSV 注入防护**：comment 以 `=`/`@`/`+`/`-` 开头时加前缀 `'`（Excel 友好）
- [ ] **`staffEmail` 是否脱敏**：根据数据合规决策
- [ ] **`endDate` 智能延伸**：仅纯日期才补 23:59:59
- [ ] **文件名加时间戳到秒/小时**
- [ ] **falsy 判断改 `=== null`**
- [ ] **`/excel/cases` 路径去重**
- [ ] **`json` 输出补 `status`**
- [ ] **`/excel/preview` 改 SQL count + groupBy**（性能优化）
- [ ] **流式导出 / worker thread**：大数据
- [ ] **统一聚合层**：把 controller 里的 `getStatusBreakdown` 等搬到 service
