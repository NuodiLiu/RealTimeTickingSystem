#!/bin/sh
set -e

# 运行数据库迁移（带超时保护）
timeout 30 npx prisma migrate deploy || echo "Migration skipped"

# 启动应用
exec node dist/server.js
