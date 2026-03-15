# STFCS 项目状态报告

> 最后更新：2026年3月15日
> 版本：v0.6.0-alpha

---

## 📋 项目概述

**远行星号桌面推演系统 (Starsector Tabletop VTT)** 是一个基于Web的多人太空战棋虚拟桌面平台。

- **项目目标**：在浏览器中实现类似《远行星号》(Starsector) 的回合制太空战斗体验
- **当前阶段**：Alpha - 核心框架完成，游戏玩法开发中
- **技术栈**：React + TypeScript + PixiJS + Fastify + WebSocket

---

## 📊 完成度总览

| 模块 | 完成度 | 状态 |
|-----|-------|------|
| 基础架构 | 95% | ✅ 稳定 |
| 渲染系统 | 90% | ✅ 可用 |
| 舰船数据模型 | 85% | ✅ 可用 |
| 回合制框架 | 75% | ⚠️ 需完善 |
| 武器系统 | 60% | ⚠️ 开发中 |
| 移动系统 | 40% | ⚠️ 待实现 |
| 战斗结算 | 30% | ❌ 待开发 |
| 服务器验证 | 20% | ❌ 待开发 |

**整体完成度：约 60%**

---

## ✅ 已实现功能

### 1. 技术架构

| 特性 | 实现详情 |
|-----|---------|
| Monorepo结构 | `client`/`server`/`shared` 三层分离 |
| 类型安全 | Zod Schema + 严格TypeScript |
| 状态管理 | Redux Toolkit + 切片化组织 |
| 通信协议 | WebSocket + 共享消息类型 |
| DDD架构 | 领域层/应用层/基础设施层清晰分离 |

### 2. 渲染系统

| 特性 | 实现详情 |
|-----|---------|
| 渲染引擎 | PixiJS 8.17 (WebGL) |
| 太空背景 | 动态星空 + 星云效果 |
| 网格系统 | 100单位网格 + 500单位坐标标签 |
| 相机控制 | 缩放(0.1x-5x)、拖拽、边界限制 |
| 图层管理 | 背景/网格/Token/护盾/武器/选中 分层渲染 |

### 3. Token系统

| 特性 | 实现详情 |
|-----|---------|
| 多类型支持 | 飞船(三角形)/空间站(圆形)/小行星(不规则) |
| 交互功能 | 选择、拖拽、旋转(1°精度) |
| 视觉反馈 | 选中高亮、朝向指示器、角度显示 |
| 状态显示 | Hull条(绿/红)、Flux条(蓝/白) |
| 护甲显示 | 6象限护甲指示器 |

### 4. 舰船核心数据

```typescript
// 已实现的数据结构
interface ShipStatus {
  hull: { current: number; max: number };
  armor: { quadrants: Record<6个象限, number>; maxArmor: number };
  flux: { current: number; capacity: number; softFlux: number; hardFlux: number; dissipation: number };
  fluxState: 'normal' | 'venting' | 'overloaded';
  shield: { type: 'front' | 'full'; active: boolean; radius: number; coverageAngle: number; efficiency: number };
  position: { x: number; y: number };
  heading: number;
  speed: number;
  maneuverability: number;
}
```

### 5. 回合制框架

| 特性 | 实现详情 |
|-----|---------|
| 回合顺序 | 按先攻值排序的单位队列 |
| 阶段系统 | planning/movement/action/resolution |
| 单位状态 | waiting/active/moved/acted/ended |
| UI组件 | TurnIndicator(回合指示器) |

### 6. 武器系统

| 特性 | 实现详情 |
|-----|---------|
| 武器类型 | 动能(ballistic)/能量(energy)/导弹(missile)/点防御(pd) |
| 挂载类型 | 固定(fixed)/炮塔(turret) |
| 视觉显示 | 射程扇形、颜色区分(橙/青/红/蓝) |
| 数据模型 | WeaponSpec + WeaponMount |

### 7. UI系统

| 组件 | 功能 |
|-----|------|
| TopBarMenu | 顶栏菜单(缩放控制、玩家信息) |
| TurnIndicator | 回合指示器(单位列表、阶段显示) |
| TacticalCommandPanel | 底部战术面板 |
| RightInfoPanel | 右侧信息面板(聊天/战斗日志) |
| LayerControlPanel | 图层控制 |
| DMToggleButton | DM模式切换 |

---

## ⚠️ 部分实现/待完善

### 1. 三阶段移动系统 (40%)

**当前状态**：
- ✅ 后端有移动验证逻辑(`Ship.validateMovement`)
- ✅ 有`remainingMovement`字段
- ❌ 前端未实现阶段A→转向→阶段B的交互流程
- ❌ 移动预览和路径显示

**需求**：
```
阶段1: 平移A - 沿当前Heading前进/后退(最大2X) 或 横移(最大X)
阶段2: 转向 - 原地旋转，最大角度Y
阶段3: 平移B - 沿新朝向重复阶段1
```

### 2. 过载机制 (50%)

**当前状态**：
- ✅ FluxSystem和状态定义
- ✅ 软/硬辐能区分
- ❌ 完整的触发/恢复流程未实现
- ❌ 过载时的视觉反馈(禁火、禁盾)

### 3. 战斗结算 (30%)

**当前状态**：
- ✅ 伤害公式定义
- ✅ 4种伤害类型(动能/高爆/破片/能量)
- ✅ 护盾/护甲/船体数据结构
- ❌ 完整的攻击→命中→伤害流程未打通
- ❌ 伤害数字动画

---

## ❌ 尚未实现

### 🔥 P0 - 核心游戏循环

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 服务器权威验证 | 🔥高 | 移动/战斗的权威验证，防作弊 |
| WebSocket同步广播 | 🔥高 | Token状态变更的实时同步 |
| 完整战斗流程 | 🔥高 | 攻击→命中判定→伤害计算→状态更新 |
| 三阶段移动交互 | 🔥高 | 前端阶段A→转向→阶段B的完整交互 |

### ⚡ P1 - 游戏体验

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 回合阶段推进 | ⚡中 | 自动阶段切换逻辑 |
| DM全局修正 | ⚡中 | 伤害/射程倍率调整面板 |
| 贴图导入 | ⚡中 | PNG/SVG上传，自动中心点设置 |
| 音效系统 | ⚡中 | 攻击、移动、爆炸音效 |

### 💡 P2 - 扩展功能

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 地图环境 | 💡低 | 星云、小行星带等地形效果 |
| 战争迷雾 | 💡低 | 视野系统 |
| 观战模式 | 💡低 | 旁观者视角 |
| 技能系统 | 💡低 | 舰船特殊能力 |

---

## 🎯 下一步开发重点

### 阶段1：服务器权威验证 (2周)

1. **移动验证**
   - 在`server/src/domain`实现三阶段移动验证
   - WebSocket广播`SHIP_MOVED`事件
   - 客户端预测+服务器校正

2. **状态同步**
   - Token状态变更的实时同步
   - 房间状态持久化

### 阶段2：完整移动系统 (2周)

1. **前端交互**
   - 阶段A移动输入
   - 转向交互(角度选择)
   - 阶段B移动输入

2. **视觉反馈**
   - 移动范围预览
   - 移动路径显示
   - 非法移动提示

### 阶段3：战斗系统 (3周)

1. **攻击流程**
   - 武器选择
   - 目标选择
   - 射界判定

2. **伤害结算**
   - 护盾吸收计算
   - 护甲减伤计算
   - 船体伤害计算

3. **视觉反馈**
   - 射击动画
   - 爆炸效果
   - 伤害数字

---

## 📁 项目结构

```
STFCS/
├── docs/                      # 设计文档
│   ├── mechanics/             # 游戏机制文档
│   │   └── ship.md            # 舰船系统需求
│   ├── PROJECT_STATUS.md      # 本项目状态文档
│   ├── Architecture.md        # 架构设计
│   ├── spec.md                # 开发规范
│   ├── QuickStart.md          # 快速开始
│   ├── DEPLOYMENT.md          # 部署指南
│   └── gituse.md              # Git使用指南
│
├── packages/
│   ├── client/                # 前端 (React + PixiJS)
│   │   └── src/
│   │       ├── features/      # 功能模块
│   │       │   ├── game/      # 游戏核心
│   │       │   │   ├── components/  # Token组件
│   │       │   │   ├── layers/      # 渲染图层
│   │       │   │   └── view/        # 游戏视图
│   │       │   └── ui/        # UI组件
│   │       ├── store/         # Redux状态
│   │       │   └── slices/    # 状态切片
│   │       ├── services/      # WebSocket服务
│   │       └── components/    # 通用组件
│   │
│   ├── server/                # 后端 (Fastify)
│   │   └── src/
│   │       ├── domain/        # 领域层
│   │       │   ├── ship/      # 舰船领域
│   │       │   │   ├── Ship.ts        # 舰船实体
│   │       │   │   ├── Shield.ts      # 护盾
│   │       │   │   ├── FluxSystem.ts  # 辐能系统
│   │       │   │   └── ArmorQuadrant.ts # 护甲象限
│   │       │   ├── map/       # 地图领域
│   │       │   └── weapon/    # 武器领域
│   │       ├── application/   # 应用层
│   │       └── infrastructure/# 基础设施
│   │
│   └── shared/                # 共享层
│       └── src/
│           ├── core-types.ts  # 核心类型定义
│           ├── types/         # 类型工具
│           ├── schemas/       # Zod Schema
│           └── ws/            # WebSocket协议
│
├── package.json               # 根配置
├── pnpm-workspace.yaml        # Monorepo配置
└── turbo.json                 # 构建配置
```

---

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **状态**: Redux Toolkit
- **渲染**: PixiJS 8.17 (WebGL)
- **样式**: CSS-in-JS
- **国际化**: i18next

### 后端
- **框架**: Fastify
- **通信**: WebSocket (ws)
- **架构**: DDD (领域驱动设计)
- **验证**: Zod

### 共享
- **类型**: Zod Schema → TypeScript
- **协议**: WebSocket消息定义
- **工具**: 前后端共享工具函数

### 工具链
- **包管理**: pnpm + workspace
- **构建**: Vite (前端) + tsup (后端)
- **代码质量**: ESLint + Biome
- **测试**: Vitest

---

## 🐛 已知问题

| 问题 | 影响 | 状态 |
|-----|------|------|
| 客户端状态未同步 | 高 | 待修复 |
| `any`类型残留 | 中 | 逐步替换 |
| 缺少集成测试 | 中 | 待补充 |
| 武器数据硬编码 | 低 | 建议配置化 |

---

## 📈 版本历史

| 版本 | 日期 | 主要更新 |
|-----|------|---------|
| v0.6.0 | 2026-03-15 | 项目状态文档、代码架构稳定 |
| v0.5.0 | 2026-03 | 回合制框架、UI组件 |
| v0.4.0 | 2026-02 | 武器系统、护盾渲染 |
| v0.3.0 | 2026-02 | Token系统、PixiJS渲染 |
| v0.2.0 | 2026-01 | WebSocket通信、基础架构 |
| v0.1.0 | 2026-01 | 项目初始化 |

---

## 👥 贡献指南

1. 阅读 `docs/Architecture.md` 了解架构设计
2. 阅读 `docs/spec.md` 了解开发规范
3. 从 `docs/mechanics/ship.md` 了解游戏机制
4. 参考 `docs/QuickStart.md` 开始开发

---

## 📞 联系方式

- **项目仓库**: `D:\repo\STFCS`
- **开发服务器**: `pnpm dev` (同时启动前后端)
- **前端地址**: http://localhost:5173
- **后端地址**: http://localhost:3000
- **WebSocket**: ws://localhost:3001

---

*本文档替代了之前的 todo.md 和各类分散的进度文档，作为项目的单一事实来源。*
