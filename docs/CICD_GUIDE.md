# CI/CD 部署指南

本文档描述 STFCS 项目的持续集成和持续部署（CI/CD）流程。

## 概述

本项目使用 GitHub Actions 作为 CI/CD 平台，自动化执行以下流程：

```
代码提交 → 代码检查 → 测试 → 构建镜像 → 推送镜像 → 部署到服务器 → 健康检查
```

## 流水线架构

### 触发条件

- **Push 事件**: 推送到 `main` 或 `master` 分支
- **Pull Request**: 针对 `main` 或 `master` 分支的 PR
- **手动触发**: 通过 GitHub Actions UI 手动运行

### 工作流阶段

```yaml
prepare → lint → test → build → deploy → notify
```

## 详细阶段说明

### 1. Prepare（预处理）

**目的**: 设置环境变量和镜像标签

**输出**:
- `server_image`: Server 镜像名称（小写）
- `client_image`: Client 镜像名称（小写）
- `repository_lower`: 小写仓库名

### 2. Lint（代码质量检查）

**运行条件**: 所有触发事件

**执行步骤**:
1. 检出代码
2. 设置 pnpm (v10.32.1)
3. 设置 Node.js (v24)
4. 安装依赖
5. 运行 ESLint/Biome 检查
6. 运行 TypeScript 类型检查
7. 构建核心包 (`@vt/contracts`, `@vt/rules`)
8. 验证构建输出

**通过标准**:
- 无 lint 错误
- 无类型错误
- 核心包成功构建

### 3. Test（测试）

**运行条件**: PR 或 Push 事件

**执行步骤**:
1. 检出代码
2. 设置 pnpm 和 Node.js
3. 安装依赖
4. 构建核心包
5. 运行测试套件

**通过标准**: 所有测试通过

### 4. Build（构建 Docker 镜像）

**运行条件**: 仅 Push 到 main/master

**权限要求**:
- `contents: read`
- `packages: write`

**执行步骤**:
1. 设置 Docker Buildx
2. 登录 GHCR (GitHub Container Registry)
3. 配置 Docker 层缓存
4. 构建并推送 Server 镜像
5. 构建并推送 Client 镜像
6. 清理缓存

**镜像标签**:
- `:latest` - 最新版本
- `:${{ github.sha }}` - 提交哈希标签

**构建优化**:
- 使用本地缓存加速构建
- 缓存大小限制：2GB
- 多阶段构建减少镜像大小

### 5. Deploy（部署）

**运行条件**: 仅 Push 到 main/master

**环境**: production

**执行步骤**:
1. 设置 SSH Agent
2. 验证 SSH 连接
3. 远程服务器操作:
   - 登录 GHCR
   - 清理旧镜像和容器
   - 拉取最新镜像
   - 停止并删除旧容器
   - 创建网络（如不存在）
   - 启动 Server 容器
   - 启动 Client 容器
   - 显示容器状态和日志
4. 健康检查（最多 24 次尝试，每次间隔 5 秒）

**服务器配置**:
- Server 端口：2567
- Client 端口：80
- 网络：stfcs-network
- 重启策略：unless-stopped

### 6. Notify（通知）

**运行条件**: 始终运行（deploy 成功后或失败后）

**执行步骤**:
- 输出部署状态
- 失败时退出码为 1

## 环境变量配置

### GitHub Secrets

需要在 GitHub 仓库设置以下 Secrets：

| Secret 名称 | 描述 | 示例 |
|------------|------|------|
| `SERVER_HOST` | 服务器 IP 或域名 | `192.168.1.100` |
| `SERVER_USER` | SSH 用户名 | `deploy` |
| `SSH_PRIVATE_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GITHUB_TOKEN` | 自动提供，无需手动设置 | - |

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `REGISTRY` | 容器镜像仓库 | `ghcr.io` |
| `NODE_ENV` | Node.js 环境 | `production` |
| `PORT` | Server 端口 | `2567` |
| `CORS_ORIGINS` | CORS 允许的来源 | - |

## Docker 镜像

### Server 镜像

**基础镜像**: `node:24-alpine`

**构建阶段**:
1. **deps**: 安装依赖
2. **builder**: 构建代码（tsup）
3. **runner**: 运行环境（非 root 用户）

**暴露端口**: 2567

**健康检查**: HTTP GET `/health`

### Client 镜像

**基础镜像**: `node:24-alpine` (构建) + `nginx:alpine` (运行)

**构建阶段**:
1. **deps**: 安装依赖
2. **builder**: 构建代码（Vite）
3. **runner**: Nginx 静态文件服务

**暴露端口**: 80

**健康检查**: HTTP GET `/`

## 本地测试

### 测试 Docker 构建

```bash
# 构建 Server 镜像
docker build -f packages/server/Dockerfile -t stfcs-server:local .

# 构建 Client 镜像
docker build -f packages/client/Dockerfile -t stfcs-client:local .
```

### 使用 Docker Compose

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 本地健康检查

```bash
# 检查 Server
curl http://localhost:2567/health

# 检查 Client
curl http://localhost:80/
```

## 故障排查

### 构建失败

**问题**: Docker 构建超时或内存不足

**解决方案**:
```bash
# 增加 Docker 资源限制
# Docker Desktop → Settings → Resources → 增加内存和 CPU

# 清理构建缓存
docker builder prune -a
```

### 部署失败

**问题**: SSH 连接失败

**解决方案**:
1. 验证 SSH 私钥格式正确
2. 确保服务器 SSH 公钥已添加
3. 检查服务器防火墙设置
4. 测试本地 SSH 连接：
   ```bash
   ssh -i ~/.ssh/id_rsa user@host
   ```

**问题**: 容器启动失败

**解决方案**:
```bash
# 查看容器日志
docker logs stfcs-server
docker logs stfcs-client

# 检查容器状态
docker ps -a

# 手动启动调试
docker run --rm -it stfcs-server:latest /bin/sh
```

### 健康检查失败

**问题**: Server 健康检查超时

**解决方案**:
1. 检查 Server 日志：
   ```bash
   docker logs --tail 200 stfcs-server
   ```
2. 验证端口映射：
   ```bash
   docker port stfcs-server
   ```
3. 检查资源限制：
   ```bash
   docker stats stfcs-server
   ```

## 手动部署

### 从本地推送镜像

```bash
# 登录 GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 构建并推送
docker buildx build --platform linux/amd64 -f packages/server/Dockerfile \
  -t ghcr.io/fire-disposal/stfcs-server:latest --push .

docker buildx build --platform linux/amd64 -f packages/client/Dockerfile \
  -t ghcr.io/fire-disposal/stfcs-client:latest --push .
```

### 远程服务器手动部署

```bash
# SSH 到服务器
ssh user@host

# 拉取镜像
docker pull ghcr.io/fire-disposal/stfcs-server:latest
docker pull ghcr.io/fire-disposal/stfcs-client:latest

# 停止旧容器
docker stop stfcs-server stfcs-client || true
docker rm stfcs-server stfcs-client || true

# 启动新容器
docker run -d --name stfcs-server --restart unless-stopped \
  --network stfcs-network -p 2567:2567 \
  -e NODE_ENV=production stfcs-server:latest

docker run -d --name stfcs-client --restart unless-stopped \
  --network stfcs-network -p 80:80 stfcs-client:latest
```

## 最佳实践

### 代码提交

1. **小步提交**: 频繁提交小改动
2. **描述性信息**: 使用清晰的提交信息
3. **PR 审查**: 所有代码变更通过 PR 审查

### 镜像管理

1. **标签策略**: 使用 `:latest` 和提交哈希双标签
2. **定期清理**: 删除旧的镜像版本
3. **安全扫描**: 定期扫描镜像漏洞

### 服务器维护

1. **日志轮转**: 配置 Docker 日志轮转
2. **资源监控**: 监控 CPU、内存使用
3. **备份策略**: 定期备份重要数据

## 性能优化

### 构建加速

- 使用 Docker 层缓存
- 并行构建多个镜像
- 使用 `--cache-from` 复用缓存

### 部署优化

- 使用增量更新
- 蓝绿部署（未来）
- 滚动更新（未来）

## 安全建议

1. **最小权限**: 使用非 root 用户运行容器
2. **密钥管理**: 使用 GitHub Secrets 管理敏感信息
3. **网络隔离**: 使用 Docker 网络隔离服务
4. **定期更新**: 及时更新基础镜像和依赖

## 监控和告警

### 日志收集

```bash
# 实时查看日志
docker logs -f stfcs-server
docker logs -f stfcs-client

# 查看最近 N 行
docker logs --tail 100 stfcs-server
```

### 资源监控

```bash
# 容器资源使用
docker stats

# 磁盘使用
docker system df
```

## 未来改进

- [ ] 添加 Canary 部署
- [ ] 实现自动回滚
- [ ] 集成监控告警（Prometheus + Grafana）
- [ ] 添加性能测试阶段
- [ ] 支持多环境部署（staging/production）

## 参考链接

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)
- [Colyseus 部署指南](https://docs.colyseus.io/deployment/)
