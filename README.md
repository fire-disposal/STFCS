# STFCS - 战术舰队战斗系统

《远行星号》风格的桌面推演系统，基于权威服务器架构。

[![CI/CD](https://github.com/fire-disposal/stfcs/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/fire-disposal/stfcs/actions)
[![License](https://img.shields.io/github/license/fire-disposal/stfcs)](LICENSE)

## 项目结构

```
STFCS/
├── packages/
│   ├── client/    # React 前端 (PixiJS 渲染)
│   ├── server/    # Node.js 后端 (Socket.IO)
│   └── data/      # 共享数据层 (Schema + Presets)
├── storage/       # 运行时数据 (玩家存档、资源)
├── Dockerfile.unified
└── docker-compose.yml
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:5173
```

## 开发命令

```bash
pnpm dev          # 启动开发环境
pnpm build        # 构建所有包
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # 代码检查
pnpm test         # 运行测试
```

## 部署

### Docker

```bash
docker-compose up -d
```

数据持久化: `/srv/stfcs/storage`

### CI/CD

推送到 `main` 分支自动触发 GitHub Actions：
- 构建镜像推送到 GHCR
- SSH 部署到服务器
- 健康检查验证

## 技术栈

| 前端 | 后端 |
|------|------|
| React 19 | Node.js 24 |
| PixiJS | Socket.IO |
| Zustand | Express |
| TypeScript | TypeScript |

## 核心特性

- **权威服务器**: 所有操作服务端验证
- **实时同步**: WebSocket 状态推送
- **6象限装甲**: 独立计算每个象限
- **辐能系统**: 软/硬辐能、过载、排散
- **三阶段机动**: A平移 → B转向 → C平移
- **DM控制台**: 主持人实时调控

## 许可证

ISC License