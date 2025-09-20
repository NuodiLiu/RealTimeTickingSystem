# Azure SignalR Service Serverless 部署指南

本指南将帮助您将实时通信系统从本地 SignalR 迁移到 Azure SignalR Service 的 serverless 模式。

## 准备工作

### 1. 创建 Azure 资源

#### 创建 Azure SignalR Service
```bash
# 创建资源组
az group create --name your-resource-group --location eastus

# 创建 SignalR Service (Serverless 模式)
az signalr create \
  --name your-signalr-service \
  --resource-group your-resource-group \
  --location eastus \
  --service-mode Serverless \
  --unit-count 1 \
  --sku Free_F1
```

#### 创建 Azure Function App
```bash
# 创建存储账户
az storage account create \
  --name yourstorageaccount \
  --resource-group your-resource-group \
  --location eastus \
  --sku Standard_LRS

# 创建 Function App
az functionapp create \
  --name your-function-app \
  --storage-account yourstorageaccount \
  --resource-group your-resource-group \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

### 2. 获取连接字符串

```bash
# 获取 SignalR Service 连接字符串
az signalr key list --name your-signalr-service --resource-group your-resource-group
```

复制 `Primary Connection String` 以供后续使用。

## 配置环境变量

### 后端 (.env)
```bash
AZURE_SIGNALR_CONNECTION_STRING=Endpoint=https://your-signalr-service.service.signalr.net;AccessKey=your-access-key;Version=1.0;
AZURE_SIGNALR_HUB_NAME=realtimeticket
```

### 前端 (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://your-function-app.azurewebsites.net
```

## 本地开发

### 1. 安装 Azure Functions Core Tools
```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### 2. 启动本地开发服务器
```bash
# 后端 Azure Functions
cd backend
npm run dev:functions

# 前端 Next.js
cd frontend
npm run dev
```

Azure Functions 将在 `http://localhost:7071` 运行。

## 部署到 Azure

### 1. 配置 Function App 环境变量
```bash
az functionapp config appsettings set \
  --name your-function-app \
  --resource-group your-resource-group \
  --settings \
    AZURE_SIGNALR_CONNECTION_STRING="your-connection-string" \
    AZURE_SIGNALR_HUB_NAME="realtimeticket" \
    JWT_SECRET="your-jwt-secret" \
    DATABASE_URL="your-database-url"
```

### 2. 部署 Azure Functions
```bash
cd backend
npm run deploy
```

### 3. 配置 SignalR Service Upstream
在 Azure Portal 中配置 SignalR Service 的 Upstream 设置：

- **URL Template**: `https://your-function-app.azurewebsites.net/api/signalr/{event}`
- **Hub Pattern**: `realtimeticket`
- **Event Pattern**: `*`
- **Category Pattern**: `*`

或使用 Azure CLI：
```bash
az signalr upstream update \
  --name your-signalr-service \
  --resource-group your-resource-group \
  --template url-template="https://your-function-app.azurewebsites.net/api/signalr/{event}" \
           hub-pattern="realtimeticket" \
           event-pattern="*" \
           category-pattern="*"
```

## 前端连接配置

前端会自动连接到 Azure SignalR Service。确保以下配置正确：

1. **negotiate 端点**: `/api/signalr/negotiate`
2. **消息发送端点**: `/api/signalr/send`
3. **环境变量**: `NEXT_PUBLIC_API_URL` 指向您的 Function App

## 测试连接

### 1. 检查 Azure Functions 状态
```bash
curl https://your-function-app.azurewebsites.net/api/health
```

### 2. 测试 SignalR negotiate
```bash
curl -X POST https://your-function-app.azurewebsites.net/api/signalr/negotiate \
  -H "x-user-id: test-user" \
  -H "x-user-type: dashboard"
```

### 3. 发送测试消息
```bash
curl -X POST https://your-function-app.azurewebsites.net/api/signalr/send \
  -H "Content-Type: application/json" \
  -d '{
    "target": "dashboard",
    "message": {
      "type": "test",
      "payload": {"message": "Hello from serverless!"}
    }
  }'
```

## 监控和调试

### 1. 查看 Function App 日志
```bash
az functionapp log tail --name your-function-app --resource-group your-resource-group
```

### 2. 在 Azure Portal 中监控
- Function App > Monitor > Logs
- SignalR Service > Monitoring > Metrics

### 3. 本地调试
使用 VSCode 的 Azure Functions 扩展进行本地调试。

## 性能优化

1. **连接池**: Azure SignalR Service 自动管理连接
2. **自动扩展**: 根据连接数自动扩展
3. **地理分布**: 可以在多个区域部署
4. **缓存**: 使用 Redis 缓存频繁访问的数据

## 故障排除

### 常见问题

1. **连接失败**: 检查连接字符串和 Hub 名称
2. **认证错误**: 确保 JWT 密钥正确配置
3. **消息不到达**: 检查 Upstream 配置和函数权限
4. **CORS 错误**: 在 Function App 中配置 CORS 设置

### 调试步骤

1. 检查环境变量是否正确设置
2. 验证 SignalR Service 和 Function App 是否正常运行
3. 查看 Function App 的执行日志
4. 测试 negotiate 端点是否返回有效的连接信息

## 成本优化

1. 使用 Free tier 进行开发和测试
2. 根据实际使用量选择合适的定价层
3. 定期检查连接数和消息数
4. 设置预算警报

## 安全注意事项

1. 定期轮换访问密钥
2. 使用 Azure AD 进行身份验证
3. 配置网络安全组限制访问
4. 启用 SSL/TLS 加密传输

## 备份和恢复

1. 定期备份配置和代码
2. 使用 ARM 模板进行基础设施即代码
3. 设置多区域部署以实现高可用性
