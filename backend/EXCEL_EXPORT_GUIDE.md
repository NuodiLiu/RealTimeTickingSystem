# Excel 导出功能说明

## 功能概述

新的Excel导出功能提供了完整的案例数据分析，包含多个工作表（sheet），每个表格专注于不同的数据分析维度。

## API 端点

### 1. 预览导出数据
```
GET /excel/preview
```
返回导出数据的统计预览，不生成实际文件。

### 2. 导出为JSON (兼容性)
```
GET /excel/cases/json
```
返回JSON格式的案例数据，保持与原有API的兼容性。

### 3. 导出为Excel文件
```
GET /excel/cases/xlsx
GET /excel/cases  (默认Excel格式)
```
生成并下载完整的Excel文件。

## 查询参数 (所有端点通用)

- `status[]`: 过滤状态 (QUEUED, IN_PROGRESS, RESOLVED_PENDING_FEEDBACK, RESOLVED)
- `startDate`: 开始日期 (ISO格式: 2025-01-01)
- `endDate`: 结束日期 (ISO格式: 2025-12-31)
- `staffId`: 工作人员ID
- `category`: 案例分类

## Excel工作簿结构

### Sheet 1: "All Cases" - 完整数据
包含所有案例的详细信息：

**基础信息:**
- Case ID (zID)
- Student Name
- Category
- Status

**时间信息:**
- Created At
- Started At
- Resolved At

**工作人员信息:**
- Staff Name
- Staff Email
- Staff Role

**升级信息:**
- Escalated To

**反馈信息:**
- Feedback Rating (1-5)
- Feedback Comment
- Feedback Date

**计算的衍生指标:**
- Waiting Time (seconds) - 等待时间（秒）
- Processing Time (seconds) - 处理时间（秒）
- Total Time (seconds) - 总时长（秒）
- Waiting Time - 格式化的等待时间 (如: "2h 30m")
- Processing Time - 格式化的处理时间
- Total Time - 格式化的总时长

**状态标志:**
- Has Escalation (Yes/No)
- Has Feedback (Yes/No)
- Is Complete (Yes/No)

### Sheet 2: "Summary" - 汇总统计
整体运营指标：
- 总案例数
- 已解决案例数
- 解决率
- 有反馈的案例数
- 反馈率
- 升级案例数
- 升级率
- 平均等待时间
- 平均处理时间
- 平均总时长
- 平均评分

### Sheet 3: "By Category" - 按分类统计
每个分类的详细统计：
- 分类名称
- 总案例数
- 已解决案例数
- 解决率
- 有反馈的案例数
- 升级案例数
- 升级率
- 平均等待时间
- 平均处理时间
- 平均评分

### Sheet 4: "By Staff" - 按工作人员统计
每个工作人员的绩效指标：
- 工作人员姓名和邮箱
- 处理的总案例数
- 已解决案例数
- 解决率
- 有反馈的案例数
- 升级案例数
- 平均等待时间
- 平均处理时间
- 平均评分

### Sheet 5: "Time Analysis" - 时间分析
按时间范围分析处理效率：
- Very Fast (< 5min)
- Fast (5-15min)
- Normal (15-30min)
- Slow (30-60min)
- Very Slow (> 1hour)

分别统计等待时间和处理时间的分布。

### Sheet 6: "Feedback Quality" - 反馈质量分析
反馈相关的详细分析：
- 总反馈数量
- 平均评分
- 中位数评分
- 反馈率
- 各星级评分的分布
- 按分类的平均评分

### Sheet 7: "Date Trends" - 日期趋势分析
按日期的趋势分析：
- 每日案例数量
- 每日解决率
- 每日平均等待时间
- 每日平均处理时间

## 使用示例

### 1. 导出所有已解决的案例
```
GET /excel/cases?status=RESOLVED
```

### 2. 导出指定日期范围的案例
```
GET /excel/cases?startDate=2025-09-01&endDate=2025-09-15
```

### 3. 导出特定工作人员处理的案例
```
GET /excel/cases?staffId=staff123
```

### 4. 导出特定分类的案例
```
GET /excel/cases?category=technical_support
```

### 5. 组合过滤条件
```
GET /excel/cases?status=RESOLVED&category=technical_support&startDate=2025-09-01
```

## 权限要求

所有Excel导出端点都需要：
- 用户认证 (requireAuth)
- 管理员权限 (requireAdmin)

## 文件格式

- 文件格式: .xlsx (Excel 2007+)
- 文件名格式: `cases_detailed_export_YYYY-MM-DD.xlsx`
- 压缩: 启用
- 编码: UTF-8

## 技术实现

- **后端库**: xlsx (SheetJS)
- **架构**: Service -> Controller -> Router 分层设计
- **数据源**: Prisma ORM + PostgreSQL
- **内存优化**: 流式处理大数据集
- **错误处理**: 完整的错误处理和验证

## 性能考虑

- 对于大数据集，建议使用日期范围过滤
- 系统会在响应头中提供文件大小信息
- 预览端点可用于估算导出文件大小
