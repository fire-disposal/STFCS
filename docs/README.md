# STFCS 开发者文档

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问客户端
# http://localhost:5173
```

## 项目结构

```
STFCS/
├── packages/
│   ├── client/     # React 客户端
│   ├── server/     # Colyseus 游戏服务器
│   ├── contracts/  # 共享类型和协议
│   └── rules/      # 游戏规则引擎
└── docs/           # 文档
```

## 核心架构

### 网络架构

- **权威服务器模式**: 服务端验证所有操作
- **Colyseus**: 实时状态同步
- **WebSocket**: 客户端 - 服务器通信

### 游戏流程

```
认证 → 大厅 → 部署阶段 → 玩家回合 → DM 回合 → 结束阶段
```

## 关键功能

### 三阶段移动系统

```
阶段 A (平移) → 攻击 → 阶段 B (转向) → 攻击 → 阶段 C (平移) → 攻击
```

每个阶段可以：
- 执行移动操作
- 进行武器攻击
- 使用特殊能力

### 战斗系统

- **6 象限装甲**: 独立计算每个象限的护甲值
- **辐能系统**: 软/硬辐能、过载、排散机制
- **武器系统**: 动能、能量、导弹三种类型

### DM 工具

- 创建舰船/对象
- 修改游戏状态
- 强制推进阶段
- 分配舰船控制权

## 技术栈

### 前端

- React 19
- TypeScript
- Redux Toolkit
- Pixi.js (渲染)
- Colyseus SDK

### 后端

- Node.js
- Colyseus
- Express
- TypeScript

## 开发指南

### 添加新武器

1. 在 `packages/rules/src/data/WeaponSchema.ts` 添加武器数据
2. 在客户端添加武器 UI 组件
3. 在服务端添加武器逻辑

### 添加新舰船

1. 在 `packages/rules/src/data/ShipHullSchema.ts` 添加舰船数据
2. 配置武器挂载点
3. 设置属性值

## 常见问题

### 无法连接服务器

确保服务器运行在端口 2567：
```bash
pnpm dev:server
```

### 构建失败

清理缓存后重试：
```bash
pnpm clean
pnpm install
pnpm build
```

## 测试

```bash
# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 部署

### Docker 部署

```bash
docker-compose up -d
```

### 手动部署

```bash
pnpm build
pm2 start ecosystem.config.js
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

ISC License
