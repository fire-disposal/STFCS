# CI/CD 配置汇总

## 创建的文件清单

### 1. Lint 配置
- ✅ `eslint.config.mjs` - ESLint 配置文件，支持 TypeScript 和 Vue
- ✅ `package.json` - 更新添加 lint 脚本和依赖

### 2. Docker 配置
- ✅ `packages/server/Dockerfile` - 后端多阶段构建镜像
- ✅ `packages/client/Dockerfile` - 前端多阶段构建镜像
- ✅ `packages/client/nginx.conf` - Nginx 配置
- ✅ `docker-compose.yml` - 生产环境编排配置
- ✅ `.dockerignore` - Docker 构建忽略文件

### 3. CI/CD 工作流
- ✅ `.github/workflows/ci-cd.yml` - 完整的 GitHub Actions 工作流

### 4. 项目配置更新
- ✅ `packages/shared/package.json` - 添加 build 脚本和 exports
- ✅ `.env.example` - 环境变量示例

### 5. 文档
- ✅ `docs/DEPLOYMENT.md` - 完整的部署指南

---

## 配置合理性分析

### 当前系统评估

| 项目 | 状态 | 说明 |
|------|------|------|
| 架构设计 | ✅ 良好 | Monorepo + DDD 架构清晰 |
| 前后端分离 | ✅ 良好 | REST + WebSocket + tRPC 组合合理 |
| 类型安全 | ✅ 良好 | TypeScript 全栈覆盖 |
| 环境配置 | ⚠️ 需改进 | 后端支持环境变量，前端需补充 |
| Lint 检查 | ❌ 缺失 | 已补充 ESLint 配置 |
| 容器化 | ❌ 缺失 | 已补充 Dockerfile |
| CI/CD | ❌ 缺失 | 已补充 GitHub Actions |

### 接口配置评估

**优点：**
1. WebSocket 与 HTTP API 分离，避免阻塞
2. tRPC 提供类型安全的 API 调用
3. 共享类型包确保前后端类型一致
4. CORS 配置灵活，支持多环境

**建议改进：**
1. 前端应使用环境变量配置 API 地址
2. 添加 API 版本控制 (v1, v2)
3. 考虑添加 API 网关统一入口

---

## GitHub Secrets 配置清单

在 GitHub 仓库 Settings → Secrets → Actions 中添加：

```
SSH_PRIVATE_KEY    # SSH 私钥 (OpenSSH 格式)
SERVER_HOST        # 服务器 IP 或域名
SERVER_USER        # SSH 用户名
CORS_ORIGINS       # 生产环境允许的跨域域名
```

---

## CI/CD 流程图

```
Push to main/master
        │
        ▼
┌───────────────┐
│   Lint Check  │  ESLint + TypeScript
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Run Tests    │  Vitest
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Build Images │  Docker Buildx
│  Server       │  ghcr.io/...-server
│  Client       │  ghcr.io/...-client
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Push to GHCR │  GitHub Container Registry
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Deploy via   │  SSH Agent
│  SSH          │  docker-compose up
└───────────────┘
        │
        ▼
  Production Server
```

---

## 服务器端口映射

```
主机端口    容器端口    服务
─────────────────────────────────────
3000        3000        Server HTTP API
3001        3001        Server WebSocket
8080        80          Client (Nginx)
```

---

## 快速启动命令

```bash
# 1. 安装依赖
pnpm install

# 2. 运行 Lint
pnpm lint

# 3. 本地开发
pnpm dev

# 4. 构建 Docker 镜像
docker build -f packages/server/Dockerfile -t stfcs-server .
docker build -f packages/client/Dockerfile -t stfcs-client .

# 5. 本地测试容器
docker-compose up -d

# 6. 推送代码触发 CI/CD
git add .
git commit -m "✨ 添加 CI/CD 配置"
git push origin main
```

---

## 故障排查清单

| 问题 | 解决方案 |
|------|----------|
| Lint 失败 | 运行 `pnpm lint:fix` 自动修复 |
| 镜像构建失败 | 检查 `.dockerignore` 是否排除了必要文件 |
| GHCR 推送失败 | 检查 GitHub Token 权限 |
| SSH 部署失败 | 检查 Secrets 配置和服务器防火墙 |
| 容器启动失败 | 查看日志 `docker logs stfcs-server` |
| 健康检查失败 | 确认端口映射和防火墙规则 |

---

## 后续优化建议

1. **添加 Prettier 格式化**
2. **集成 Sentry 错误监控**
3. **添加数据库迁移步骤**（如果使用数据库）
4. **配置蓝绿部署**减少停机时间
5. **添加 Prometheus + Grafana 监控**
6. **使用 Traefik 或 Nginx 作为反向代理**
7. **配置 Let's Encrypt 自动 SSL 证书**
