# STFCS 部署指南

## 架构概述

本项目采用以下架构：

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │   Lint      │───▶│    Test     │───▶│   Docker Build  │ │
│  └─────────────┘    └─────────────┘    └─────────────────┘ │
│                                               │             │
│                                               ▼             │
│                                        ┌─────────────┐      │
│                                        │    GHCR     │      │
│                                        │   (ghcr.io) │      │
│                                        └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ SSH Deploy
┌─────────────────────────────────────────────────────────────┐
│                      生产服务器 (单台)                        │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   stfcs-server   │◀───────▶│   stfcs-client   │         │
│  │   Port: 3000/3001│         │   Port: 8080     │         │
│  │   (Fastify+WS)   │         │   (Nginx+Vue)    │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## CI/CD 流程

1. **Lint 检查**: ESLint 检查代码规范
2. **类型检查**: TypeScript 类型检查
3. **单元测试**: Vitest 运行测试
4. **Docker 构建**: 构建前后端镜像
5. **推送到 GHCR**: 镜像推送到 GitHub Container Registry
6. **部署到服务器**: 通过 SSH 自动部署到单台服务器

## 前置要求

### 1. 服务器准备

确保生产服务器已安装：
- Docker (>= 20.10)
- Docker Compose (>= 1.29)
- Git

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置 GitHub Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加以下 secrets：

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH 私钥 (OpenSSH 格式) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_HOST` | 服务器 IP 或域名 | `123.45.67.89` |
| `SERVER_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `CORS_ORIGINS` | 允许的跨域来源 | `https://stfcs.yourdomain.com` |

### 3. 配置 SSH 访问

在本地生成 SSH 密钥对：

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/stfcs_deploy
```

将公钥添加到服务器的 `~/.ssh/authorized_keys`：

```bash
ssh-copy-id -i ~/.ssh/stfcs_deploy.pub user@server
```

将私钥内容复制到 GitHub Secrets 的 `SSH_PRIVATE_KEY`。

## 部署步骤

### 首次部署

1. **配置 GitHub Actions 权限**
   
   前往 Settings → Actions → General → Workflow permissions，选择：
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests

2. **创建容器仓库包**
   
   GitHub Actions 会自动创建 ghcr.io 镜像仓库。

3. **推送代码触发部署**
   
   ```bash
   git push origin main
   ```

### 后续部署

每次推送到 `main` 或 `master` 分支会自动触发完整 CI/CD 流程：

```bash
git add .
git commit -m "✨ 新功能"
git push origin main
```

## 服务端口说明

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| Server HTTP | 3000 | 3000 | REST API 和 tRPC |
| Server WS | 3001 | 3001 | WebSocket 连接 |
| Client | 80 | 8080 | Nginx 前端服务 |

## 监控与日志

### 查看容器日志

```bash
# 查看服务端日志
docker logs -f stfcs-server

# 查看客户端日志
docker logs -f stfcs-client

# 查看所有服务日志
docker-compose logs -f
```

### 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 检查容器状态
docker-compose ps
```

## 故障排查

### 镜像拉取失败

```bash
# 手动登录 ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 手动拉取镜像
docker pull ghcr.io/fire-disposal/stfcs-server:latest
docker pull ghcr.io/fire-disposal/stfcs-client:latest
```

### 端口冲突

```bash
# 检查端口占用
netstat -tlnp | grep -E '3000|3001|8080'

# 修改 docker-compose.yml 中的端口映射
```

### 手动部署

如果 CI/CD 失败，可以手动部署：

```bash
# 在服务器上执行
cd ~/stfcs
docker-compose down
docker-compose pull
docker-compose up -d
```

## 安全建议

1. **使用非 root 用户运行容器** (已在 Dockerfile 配置)
2. **配置防火墙规则**，仅开放必要端口
3. **使用 HTTPS**，建议配合 Nginx 反向代理 + SSL
4. **定期更新依赖**，运行 `pnpm update`
5. **启用 Docker 安全选项**：
   - read_only: true
   - security_opt: [no-new-privileges:true]

## 性能优化

1. **启用 Docker BuildKit**：
   ```bash
   export DOCKER_BUILDKIT=1
   ```

2. **使用多阶段构建**：已配置，减小镜像体积

3. **启用镜像缓存**：GitHub Actions 已配置 Buildx 缓存

4. **资源限制**：docker-compose.yml 已配置 CPU/内存限制

## 备份策略

建议定期备份：

```bash
# 备份数据卷（如果有持久化数据）
docker run --rm -v stfcs_data:/data -v $(pwd):/backup alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```
