# 远行星号桌面推演系统 (STFCS) V2

[![Build Status](https://img.shields.io/github/actions/workflow/status/fire-disposal/stfcs/ci.yml)](https://github.com/fire-disposal/stfcs/actions)
[![License](https://img.shields.io/github/license/fire-disposal/stfcs)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-blue)](https://github.com/fire-disposal/stfcs)

基于权威服务器模式 (Authoritative Server) 的《远行星号》(Starsector) 风格桌面推演系统。

## 🚀 快速开始

**立即测试**: 查看 [快速启动指南](QUICK_START.md)

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问客户端
# http://localhost:5173
```

## ✨ 特性

### 核心功能

- **🎯 权威服务器架构**: 服务端验证所有操作，确保推演公平性
- **🔄 实时状态同步**: Colyseus 自动处理状态同步和补丁广播
- **🛡️ 6 象限装甲机制**: 独立计算每个象限的护甲值，精确伤害判定
- **⚡ 完整辐能系统**: 软/硬辐能、过载、排散机制
- **📐 三阶段机动系统**: 严格遵循《远行星号》的机动规则
- **🎮 DM 控制台**: 主持人可实时调控游戏状态

### 新增功能 (v2.0)

- **📋 战斗日志系统**: 完整的战斗事件记录与回放
- **🎯 武器射界可视化**: 实时显示武器攻击范围和射界
- **🚀 舰船数据导入**: 支持 JSON 格式的舰船规格导入导出
- **📊 预设舰船库**: 包含 6 种经典舰船配置
- **🔫 扩展武器库**: 10+ 种武器类型，涵盖动能、能量、导弹
- **📍 部署阶段 UI**: 直观的游戏前舰船部署界面

## 🚀 快速开始

### 环境要求

- Node.js >= 22.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 同时启动服务端和客户端
pnpm dev

# 或分别启动
pnpm dev:server  # 服务端：ws://localhost:2567
pnpm dev:client  # 客户端：http://localhost:5173
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 客户端 | http://localhost:5173 |
| WebSocket | ws://localhost:2567 |
| 健康检查 | http://localhost:2567/health |
| Colyseus 监控 | http://localhost:2567/colyseus |

### 构建

```bash
pnpm build
```

## 🏗️ 技术架构

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **核心引擎** | Colyseus | 状态同步与网络层 |
| **前端框架** | React 19 + PixiJS 8 | 2D 渲染引擎 |
| **状态管理** | Zustand | 客户端状态管理 |
| **数学计算** | gl-matrix | 高性能向量计算 |
| **碰撞检测** | SAT.js | 分离轴定理 |
| **构建工具** | Turborepo + pnpm | Monorepo 管理 |

### 项目结构

```
STFCS/
├── packages/
│   ├── shared/          # 前后端共享逻辑
│   │   ├── schema/      # Colyseus 数据模型
│   │   │   ├── GameSchema.ts       # 游戏状态模型
│   │   │   ├── WeaponSchema.ts     # 武器系统模型
│   │   │   ├── ShipHullSchema.ts   # 舰船数据模型
│   │   │   └── CombatLogSchema.ts  # 战斗日志模型
│   │   ├── math/        # 向量计算与碰撞函数
│   │   └── constants/   # 游戏常量与配置
│   ├── server/          # Colyseus 权威服务端
│   │   ├── rooms/       # 房间系统
│   │   └── commands/    # 指令验证与处理
│   └── client/          # React + PixiJS 前端
│       ├── components/  # UI 组件与地图渲染
│       ├── features/    # 功能模块
│       │   ├── ui/      # 通用 UI 组件
│       │   ├── ship/    # 舰船相关组件
│       │   ├── dm/      # DM 控制台
│       │   └── deployment/ # 部署阶段
│       ├── network/     # 网络管理
│       └── store/       # 本地状态
```

### 数据流

```
用户操作 → Client 派发 Command → Server 验证并计算 
        → 修改 Schema → Colyseus 自动补丁广播 
        → Client 响应视图更新
```

## 🎮 游戏机制

### 回合流程

1. **部署阶段 (DEPLOYMENT)**: 双方部署初始位置
2. **玩家回合 (PLAYER_TURN)**: 玩家控制己方舰船行动
3. **DM 回合 (DM_TURN)**: 主持人控制敌方舰船行动
4. **结束阶段 (END_PHASE)**: 结算辐能、解除过载

### 三阶段机动

每回合移动遵循三阶段算法：

```
┌─────────────────────────────────────────┐
│ 阶段 A: 平移 (最大 2X 前进/后退，最大 X 横移) │
│ 阶段 B: 转向 (最大旋转 Y 度)                │
│ 阶段 C: 平移 (最大 2X 前进/后退，最大 X 横移) │
└─────────────────────────────────────────┘
```

### 伤害类型

| 类型 | 对护盾 | 对装甲 | 对船体 | 说明 |
|------|--------|--------|--------|------|
| 动能 (Kinetic) | 50% | 200% | 100% | 对装甲有效，被护盾削弱 |
| 高爆 (HE) | 50% | 50% | 100% | 对护盾和装甲都有削弱 |
| 破片 (Frag) | 25% | 25% | 25% | 对所有防御都有削弱 |
| 能量 (Energy) | 100% | 100% | 100% | 无特殊倍率，稳定输出 |

### 6 象限装甲

```
        前 (0)
       /    \
  前左 (5)  前右 (1)
     |      |
  后左 (4)  后右 (2)
       \    /
        后 (3)
```

### 辐能机制

- **软辐能 (Flux Soft)**: 每回合自动衰减
- **硬辐能 (Flux Hard)**: 护盾吸收伤害产生，需关闭护盾才能排散
- **过载 (Overload)**: 总辐能 >= 容量时触发，无法行动
- **排散 (Vent)**: 放弃本回合行动，清空所有辐能

## 🛠️ 开发指南

### 添加新武器

1. 在 `packages/shared/src/schema/WeaponSchema.ts` 的 `PRESET_WEAPONS` 中添加：

```typescript
"new_weapon": {
  id: "new_weapon",
  name: "新武器",
  description: "武器描述",
  category: "ballistic",
  damageType: "kinetic",
  mountType: "turret",
  damage: 50,
  range: 300,
  arc: 90,
  cooldown: 3,
  fluxCost: 15,
  ammo: 0,
  reloadTime: 0,
  isBallistic: true,
  isEnergy: false,
  isMissile: false,
  ignoresShields: false,
}
```

### 添加新舰船

1. 在 `packages/shared/src/schema/ShipHullSchema.ts` 的 `PRESET_SHIPS` 中添加：

```typescript
"new_ship": {
  id: "new_ship",
  name: "新舰船",
  description: "舰船描述",
  size: "frigate",
  class: "strike",
  width: 20,
  length: 40,
  hullPoints: 1000,
  armorValue: 100,
  fluxCapacity: 150,
  fluxDissipation: 12,
  maxSpeed: 100,
  maxTurnRate: 45,
  acceleration: 50,
  hasShield: true,
  shieldType: "front",
  weaponMounts: [/* 武器挂载点 */],
}
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @vt/shared test
pnpm --filter client test
pnpm --filter server test

# 生成覆盖率报告
pnpm test:coverage
```

### 代码检查

```bash
# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# Lint 检查
pnpm lint
```

## 📦 部署

### Docker 部署

```bash
# 使用 docker-compose
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
# 服务端配置
HTTP_PORT=3000
WS_PORT=3001
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info
MAX_PLAYERS_PER_ROOM=8
```

### 生产环境

1. 构建镜像：
```bash
docker build -t stfcs-server ./packages/server
docker build -t stfcs-client ./packages/client
```

2. 使用 docker-compose 部署：
```bash
docker-compose -f docker-compose.yml up -d
```

## 📝 API 文档

### 客户端指令

| 指令 | 描述 | 参数 |
|------|------|------|
| `CMD_MOVE_TOKEN` | 移动舰船 | `{ shipId, x, y, heading }` |
| `CMD_TOGGLE_SHIELD` | 切换护盾 | `{ shipId, isActive, orientation }` |
| `CMD_FIRE_WEAPON` | 开火攻击 | `{ attackerId, weaponId, targetId }` |
| `CMD_VENT_FLUX` | 排散辐能 | `{ shipId }` |
| `CMD_ASSIGN_SHIP` | 分配舰船 | `{ shipId, targetSessionId }` |
| `CMD_TOGGLE_READY` | 准备状态 | `{ isReady }` |
| `CMD_NEXT_PHASE` | 下一阶段 | - |

### DM 指令

| 指令 | 描述 |
|------|------|
| `DM_CLEAR_OVERLOAD` | 清除舰船过载 |
| `DM_SET_ARMOR` | 修改装甲值 |
| `CREATE_TEST_SHIP` | 创建测试舰船 |

## 🤝 贡献

欢迎提交 Issue 和 PR！

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Biome 规则
- 为新功能添加测试

## 📄 许可证

MIT License

## 🙏 致谢

- [Starsector](https://fractalsoftworks.com/) - 灵感来源
- [Colyseus](https://colyseus.io/) - 多人游戏框架
- [PixiJS](https://pixijs.com/) - 2D 渲染引擎
- [gl-matrix](https://glmatrix.net/) - 数学计算库
- [SAT.js](https://github.com/jriecken/sat-js) - 碰撞检测库

## 🔗 链接

- [GitHub](https://github.com/fire-disposal/stfcs)
- [Issue Tracker](https://github.com/fire-disposal/stfcs/issues)
- [Discord](https://discord.gg/placeholder)
