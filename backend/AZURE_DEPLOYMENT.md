# Azure Functions + Azure Web PubSub 部署指南

## 概述

这个项目已经配置为使用 Azure Functions 作为 serverless 后端，并集成 Azure Web PubSub 服务来提供实时通信功能。

## 架构

```
Frontend (Next.js) 
    ↓ HTTP/WebSocket
Azure Functions (Express Wrapper)
    ↓ SDK
Azure Web PubSub Service
```

## 设置步骤

### 1. 创建 Azure 资源

#### Azure Web PubSub 服务
```bash
# 创建资源组
az group create --name rg-realtimeticket --location eastus

# 创建 Web PubSub 服务
az webpubsub create \
  --name your-webpubsub-name \
  --resource-group rg-realtimeticket \
  --location eastus \
  --sku Free_F1

# 获取连接字符串
az webpubsub key show \
  --name your-webpubsub-name \
  --resource-group rg-realtimeticket \
  --query primaryConnectionString
```

#### Azure Functions App
```bash
# 创建存储账户
az storage account create \
  --name yourstorageaccount \
  --location eastus \
  --resource-group rg-realtimeticket \
  --sku Standard_LRS

# 创建 Function App
az functionapp create \
  --resource-group rg-realtimeticket \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name your-function-app-name \
  --storage-account yourstorageaccount
```

### 2. 配置环境变量

在 Azure Portal 中配置以下应用设置：

```
AZURE_WEB_PUBSUB_CONNECTION_STRING=<从步骤1获取>
AZURE_WEB_PUBSUB_HUB_NAME=realtimeticket
JWT_SECRET=<生成强密码>
SESSION_KEYS=<逗号分隔的密钥>
DATABASE_URL=<数据库连接字符串>
FRONTEND_URL=<前端域名>
NODE_ENV=production
```

### 3. 配置 Web PubSub 事件处理

在 Azure Portal 的 Web PubSub 服务中：

1. 进入 "Settings" → "Event handler"
2. 添加新的事件处理器：
   - Hub Name: `realtimeticket`
   - URL Template: `https://your-function-app.azurewebsites.net/api/signalr/webhook`
   - System Events: 选择 `connect`, `connected`, `disconnected`
   - User Events: 选择 `message`

### 4. 本地开发

```bash
# 安装 Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# 安装依赖
npm install

# 复制环境文件
cp .env.example .env
# 编辑 .env 文件填入实际值

# 本地运行
npm run start:functions
```

### 5. 部署

```bash
# 构建项目
npm run build

# 部署到 Azure Functions
func azure functionapp publish your-function-app-name
```

## 前端配置

确保前端的环境变量指向 Azure Functions：

```env
NEXT_PUBLIC_API_BASE_URL=https://your-function-app.azurewebsites.net
```

## 测试连接

1. 部署完成后访问健康检查端点：
   ```
   GET https://your-function-app.azurewebsites.net/health
   ```

2. 测试 SignalR 连接：
   ```
   GET https://your-function-app.azurewebsites.net/api/signalr/dashboard/connect
   ```

## 监控和故障排除

### 日志查看
```bash
# 实时日志
func azure functionapp logstream your-function-app-name

# 或在 Azure Portal 的 "Monitor" → "Log stream"
```

### 常见问题

1. **连接失败**: 检查 Web PubSub 连接字符串和 Hub 名称
2. **认证错误**: 验证 JWT_SECRET 配置
3. **CORS 错误**: 确保 FRONTEND_URL 正确配置
4. **Webhook 调用失败**: 检查 Function App 的 URL 配置

## 性能优化

1. **冷启动优化**: 使用 Premium Plan 或预留实例
2. **连接池**: Azure Web PubSub 自动处理连接缩放
3. **监控**: 使用 Application Insights 监控性能

## 成本优化

1. **消费计划**: 按使用量付费，空闲时无费用
2. **Web PubSub 免费层**: 每月前 20,000 消息免费
3. **自动缩放**: 根据负载自动调整实例数量

## 安全配置

1. **网络安全**: 配置 Azure Private Link（可选）
2. **访问控制**: 使用 Azure AD 集成
3. **密钥管理**: 使用 Azure Key Vault 存储敏感信息

## 高可用性

1. **多区域部署**: 在多个 Azure 区域部署
2. **健康检查**: 配置应用程序健康监控
3. **备份**: 定期备份数据和配置
