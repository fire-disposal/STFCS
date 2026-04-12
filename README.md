# 远行星号桌面推演系统 (STFCS) V2

基于权威服务器模式的《远行星号》风格桌面推演系统。

[![Status](https://img.shields.io/badge/status-alpha-blue)](https://github.com/fire-disposal/stfcs)
[![License](https://img.shields.io/github/license/fire-disposal/stfcs)](LICENSE)

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问客户端
# http://localhost:5173
```

详细指南：[QUICK_START.md](QUICK_START.md)

## ✨ 核心特性

- **🎯 权威服务器架构**: 服务端验证所有操作
- **🔄 实时状态同步**: Colyseus 自动处理同步
- **🛡️ 6 象限装甲**: 独立计算每个象限
- **⚡ 完整辐能系统**: 软/硬辐能、过载、排散
- **📐 三阶段机动**: A 平移→B 转向→C 平移
- **🎮 DM 控制台**: 主持人实时调控

## 📋 游戏流程

```
认证 → 大厅 → 部署 → 玩家回合 → DM 回合 → 结束阶段
```

### 三阶段移动系统

```
阶段 A (平移) → 攻击 → 阶段 B (转向) → 攻击 → 阶段 C (平移) → 攻击
```

每个阶段可以执行移动、攻击或使用特殊能力。

## 🛠️ 技术栈

**前端**: React 19, TypeScript, Redux Toolkit, Pixi.js
**后端**: Node.js, Colyseus, Express, TypeScript

## 📚 文档

- [开发者文档](docs/README.md) - 架构和开发指南
- [快速启动](QUICK_START.md) - 安装和运行
- [Docker 部署](docker-compose.yml) - 容器化部署

## 🧪 测试

```bash
# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 📦 部署

### Docker

```bash
docker-compose up -d
```

### 手动

```bash
pnpm build
pm2 start ecosystem.config.js
```

## 🤝 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 📄 许可证

ISC License
