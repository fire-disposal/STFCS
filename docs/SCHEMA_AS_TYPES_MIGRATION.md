# Schema 即类型架构迁移方案

**版本**: 1.3
**日期**: 2026-04-15
**状态**: 进行中（类型重构阶段）
**目标**: 彻底迁移，不向后兼容，速度优先
**最后更新**: 2026-04-16

---

## 0. 当前迁移进度

### 总体进度概览

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 阶段 1: 基础设施准备 | ✅ 完成 | 100% |
| 阶段 2: 服务端迁移 | ⚠️ 部分完成 | 80% |
| 阶段 3: Data & Rules 包迁移 | ✅ 完成 | 100% |
| 阶段 4: 客户端类型迁移 | ⚠️ 部分完成 | 70% |
| 阶段 5: Redux 迁移到 Zustand | ✅ 完成 | 100% |
| 阶段 6: 前端结构重构 | ✅ 完成 | 100% |
| 阶段 7: 删除 @vt/types 包 | ✅ 完成 | 100% |
| 阶段 8: 类型业务场景覆盖 | 🔲 进行中 | 20% |
| 阶段 9: 端到端测试 | 🔲 待执行 | 0% |

### 架构调整（2026-04-16）

由于前端不能直接依赖后端运行时，原方案已调整：

**新架构**:
```
@vt/data              (无依赖，枚举 + 静态数据类型)
@vt/rules             (依赖 @vt/data)
@vt/server            (依赖 @vt/data + @vt/rules)
@vt/schema-types      (依赖 @vt/server，自动推导 Schema 类型)
@vt/client            (依赖 @vt/schema-types + @vt/data)
```

**关键变更**:
- ✅ 新建 `@vt/schema-types` 包，从 Schema 类自动推导类型
- ✅ 前端改用 `@vt/schema-types`，不再直接依赖 `@vt/server`
- ✅ 类型 100% 同步，零维护成本（Schema 变化自动反映）
- ✅ Dockerfile 构建顺序已更新
- ✅ ChatMessage 功能已移除（按用户要求）

### 已完成的关键里程碑

- ✅ `packages/types` 目录已删除
- ✅ `@vt/data` 包无外部依赖，独立运行
- ✅ `@vt/rules` 包只依赖 `@vt/data`
- ✅ `@vt/server` 包构建成功
- ✅ `@vt/schema-types` 包创建完成，构建成功
- ✅ Redux 已完全移除，Zustand 正常工作
- ✅ ChatMessage 相关功能已移除

### 阶段 8：类型业务场景覆盖 - 待修复项

**Schema 方法缺失（需添加到 ShipStateSchema.ts）**:

| 方法 | 当前状态 | 修复方式 |
|------|----------|----------|
| `ship.setPosition(x, y)` | ❌ 不存在 | 添加到 Transform 类 |
| `ship.setHeading(h)` | ❌ 不存在 | 添加到 Transform 类 |
| `shield.setOrientation(h)` | ❌ 不存在 | 添加到 ShieldState 类 |
| `ship.movePhaseAX` | ❌ 字段名错误 | 使用 `phaseAForwardUsed` |
| `ship.movePhaseAStrafe` | ❌ 字段名错误 | 使用 `phaseAStrafeUsed` |
| `ship.turnAngle` | ❌ 不存在 | 使用 `phaseTurnUsed` |
| `ship.movePhaseCX` | ❌ 字段名错误 | 使用 `phaseCForwardUsed` |
| `ship.movePhaseCStrafe` | ❌ 字段名错误 | 使用 `phaseCStrafeUsed` |

**server 导入错误（需修复）**:

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `dto/index.ts` | 导出 `toHealthDto` 不存在 | 改为 `toHealthStatusDto` |
| `rooms/BattleRoom.ts` | 导入 `CreateObjectPayload` 位置错误 | 从 `commands/types.ts` 导入 |
| `rooms/BattleRoom.ts` | `RoomEventLogger` 构造函数参数 | 移除参数 |
| `rooms/BattleRoom.ts` | `serializeGameSave` 参数数量 | 减少参数 |
| `services/SaveStore.ts` | `GameSave` 字段名错误 | 使用 `id` 替代 `saveId` |

**client 类型错误（需修复）**:

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `ui/panels/ChatPanel.tsx` | 导入 `ChatMessage` | 移除文件或重构 |
| `pages/GamePage.tsx` | `player` 参数类型 | 添加类型注解 |
| `renderer/entities/WeaponArcRenderer.ts` | `w`/`weaponSlot` 类型 | 添加类型注解 |
| `ui/overlays/WeaponArcOverlay.tsx` | 参数类型 | 添加类型注解 |
| `ui/panels/BattleCommandPanel.tsx` | `weapon` 类型 | 添加类型注解 |

### 下一步行动

1. **修复 Schema 方法** - 在 Transform/ShieldState 添加缺失方法
2. **修复 server 导入** - 更正所有导入路径和字段名
3. **修复 client 类型** - 移除 ChatPanel，添加类型注解
4. **执行构建验证** - `pnpm build` 全项目通过
5. **端到端测试** - 启动服务验证功能

---

## 1. 核心理念

### 1.1 问题诊断

当前架构存在**三层重复定义**:

```
┌─────────────────┐
│   @vt/types     │  interface ShipState { weapons: SchemaMap<WeaponSlot> }
│   (类型定义)     │
└────────┬────────┘
         │ implements
         ▼
┌─────────────────┐
│  server/schema  │  class ShipState extends Schema implements VT.ShipState
│   (Schema类)     │
└────────┬────────┘
         │ 需要转换
         ▼
┌─────────────────┐
│  client/types   │  interface ShipStatus { weapons: Record<string, any> }
│  (客户端重复)    │
└─────────────────┘
```

**后果**:
- 修改一处需要同步三处
- 类型不一致导致运行时错误
- Colyseus Schema 的特殊类型（MapSchema/ArraySchema）在客户端难以直接使用

### 1.2 目标架构

```
新架构（Schema 即类型）:
┌─────────────────────────────────────────────────────────────────┐
│                       @vt/server                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  schema/ (唯一真相源)                                        │ │
│  │  ├── ShipState.ts       - class ShipState extends Schema    │ │
│  │  ├── GameRoomState.ts                                      │ │
│  │  ├── types.ts           - export type ShipStateType =...    │ │
│  │  └── index.ts                                              │ │
│  │                                                              │ │
│  │  commands/                                                   │ │
│  │  ├── types.ts           - Payload 定义（与 handler 内聚）    │ │
│  │  └── CommandDispatcher.ts                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 类型导出 + WebSocket 同步
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   @vt/client  │   │   @vt/rules   │   │    @vt/data   │
│  (直接引用)    │   │  (轻量类型)    │   │  (纯数据定义)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 1.3 关键原则

1. **Schema 即类型**: Colyseus Schema 类是运行时状态的唯一来源，其类型通过 TypeScript 的 `InstanceType<typeof Class>` 导出
2. **Payload 内聚**: 命令 Payload 类型定义在 `commands/types.ts`，与 handler 放在一起
3. **静态数据独立**: `@vt/data` 纯静态 JSON + 类型定义，不依赖任何运行时包
4. **规则纯函数**: `@vt/rules` 只包含纯计算函数，不依赖 Schema
5. **不向后兼容**: 删除 `@vt/types` 包，所有代码一次性迁移

---

## 2. 理想文件树

### 2.1 完整目录结构

```
packages/
├── server/                          # 类型唯一来源
│   ├── src/
│   │   ├── schema/                  # Schema 类定义
│   │   │   ├── ShipStateSchema.ts
│   │   │   ├── GameRoomStateSchema.ts
│   │   │   ├── types.ts             # 类型导出
│   │   │   └── index.ts
│   │   │
│   │   ├── commands/                # 命令处理（Payload 内聚）
│   │   │   ├── types.ts             # 所有 Payload 类型
│   │   │   ├── CommandDispatcher.ts
│   │   │   └── handlers/
│   │   │       ├── moveHandler.ts
│   │   │       ├── fireHandler.ts
│   │   │       └── createHandler.ts
│   │   │
│   │   ├── rooms/
│   │   │   ├── BattleRoom.ts
│   │   │   └── SaveRoom.ts
│   │   │
│   │   ├── factory/
│   │   │   └── ShipFactory.ts       # 组合 data + rules
│   │   │
│   │   ├── dto/                     # 精简 DTO（仅网络传输用）
│   │   │   ├── roomDto.ts
│   │   │   └── saveDto.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── client/                          # 页游风格单页面应用
│   ├── src/
│   │   ├── pages/                   # 页面级组件（极少）
│   │   │   ├── AuthPage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   └── GamePage.tsx         # 主游戏页
│   │   │
│   │   ├── ui/                      # React UI 组件
│   │   │   ├── panels/              # 外围面板
│   │   │   │   ├── CommandPanel.tsx
│   │   │   │   ├── PhasePanel.tsx
│   │   │   │   ├── InfoPanel.tsx
│   │   │   │   └── ChatPanel.tsx
│   │   │   ├── overlays/            # 悬浮层
│   │   │   │   ├── SettingsModal.tsx
│   │   │   │   └── PlayerRoster.tsx
│   │   │   └── shared/              # 通用组件
│   │   │       ├── Button.tsx
│   │   │       └── Icon.tsx
│   │   │
│   │   ├── renderer/                # Pixi 渲染层（核心）
│   │   │   ├── core/                # 渲染基础设施
│   │   │   │   ├── PixiCanvas.tsx
│   │   │   │   ├── LayerSystem.ts
│   │   │   │   └── usePixiApp.ts
│   │   │   ├── entities/            # 实体渲染
│   │   │   │   ├── ShipRenderer.ts
│   │   │   │   ├── WeaponRenderer.ts
│   │   │   │   ├── GridRenderer.ts
│   │   │   │   └── EffectRenderer.ts
│   │   │   ├── systems/             # 渲染系统
│   │   │   │   ├── CameraSystem.ts
│   │   │   │   ├── SelectionSystem.ts
│   │   │   │   └── MovementPreview.ts
│   │   │   └── interactions/        # 交互处理
│   │   │       ├── PanZoom.ts
│   │   │       ├── TokenSelection.ts
│   │   │       └── WeaponTargeting.ts
│   │   │
│   │   ├── sync/                    # Colyseus 同步层
│   │   │   ├── types.ts             # 从 server 导入的类型
│   │   │   ├── useRoomSync.ts       # 同步入口 hook
│   │   │   ├── adapters/            # Schema → 客户端状态转换
│   │   │   │   ├── shipAdapter.ts
│   │   │   │   └── playerAdapter.ts
│   │   │   └── bridge/
│   │   │       └── commandBridge.ts # 命令发送
│   │   │
│   │   ├── state/                   # 客户端状态（Zustand 唯一）
│   │   │   ├── stores/
│   │   │   │   ├── gameStore.ts     # 游戏状态
│   │   │   │   ├── uiStore.ts       # UI 状态
│   │   │   │   └── cameraStore.ts   # 相机状态
│   │   │   └── selectors/           # 派生状态
│   │   │       └── shipSelectors.ts
│   │   │
│   │   ├── network/
│   │   │   └── NetworkManager.ts
│   │   │
│   │   ├── utils/                   # 纯工具函数
│   │   │   ├── coordinate.ts
│   │   │   └── geometry.ts
│   │   │
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── rules/                           # 游戏规则（纯函数）
│   ├── src/
│   │   ├── math/                    # 数学工具
│   │   │   ├── index.ts
│   │   │   ├── movement.ts          # 三阶段移动
│   │   │   └── geometry.ts          # 几何计算
│   │   │
│   │   ├── combat/                  # 战斗计算
│   │   │   ├── armor.ts
│   │   │   ├── damage.ts
│   │   │   └── shield.ts
│   │   │
│   │   ├── validation/              # 动作验证
│   │   │   └── index.ts             # validateWeaponFire 等
│   │   │
│   │   └── index.ts
│   │
│   ├── package.json                 # 依赖: @vt/data, gl-matrix, sat
│   └── tsconfig.json
│
├── data/                            # 静态数据
│   ├── src/
│   │   ├── types.ts                 # 独立类型定义
│   │   ├── ships.ts                 # 舰船模板
│   │   ├── weapons.ts               # 武器模板
│   │   ├── config.ts                # 游戏配置
│   │   └── index.ts
│   │
│   ├── package.json                 # 无依赖
│   └── tsconfig.json
│
└── turbo.json                       # 构建配置
```

---

## 3. 核心技术栈

### 3.1 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x | 运行时 |
| TypeScript | 5.x | 开发语言 |
| Colyseus | 0.16.x | 多人游戏服务器框架 |
| @colyseus/schema | 2.x | 状态同步 Schema |
| @vt/data | workspace:* | 静态数据 |
| @vt/rules | workspace:* | 游戏规则验证 |

### 3.2 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vite | 5.x | 构建工具 |
| TypeScript | 5.x | 开发语言 |
| React | 18.x | UI 框架（仅外围面板）|
| Pixi.js | 8.x | 游戏渲染引擎 |
| Colyseus.js | 0.16.x | WebSocket 客户端 |
| Zustand | 4.x | 状态管理（唯一方案）|
| @vt/server | workspace:* | 类型来源 |

### 3.3 废弃技术

以下技术在新架构中**不再使用**:
- ~~@vt/types~~ - 被 server/schema/types 替代
- ~~Redux~~ - 被 Zustand 替代
- ~~React Context~~ - 被 Zustand 替代

---

## 4. 详细技术重构指导

### 4.1 Server 包重构

#### 4.1.1 Schema 类型导出

```typescript
// packages/server/src/schema/types.ts

import type { 
  ShipState, 
  WeaponSlot,
  Transform,
  GameRoomState,
  PlayerState 
} from './index.js';

// Schema 实例类型 - 供客户端和其他包使用
export type ShipStateType = InstanceType<typeof ShipState>;
export type WeaponSlotType = InstanceType<typeof WeaponSlot>;
export type TransformType = InstanceType<typeof Transform>;
export type GameRoomStateType = InstanceType<typeof GameRoomState>;
export type PlayerStateType = InstanceType<typeof PlayerState>;

// 从 Schema 字段提取的枚举类型
export type Faction = ShipStateType['faction'];
export type GamePhase = GameRoomStateType['currentPhase'];
export type PlayerRole = PlayerStateType['role'];
export type WeaponState = WeaponSlotType['state'];
```

#### 4.1.2 Payload 内聚

```typescript
// packages/server/src/commands/types.ts

// 所有命令 Payload 定义集中于此
// 与 handler 文件放在一起，保持内聚

export interface MoveTokenPayload {
  shipId: string;
  x: number;
  y: number;
  heading: number;
  movementPlan?: MovementPlan;
  phase?: MovePhase;
  isIncremental?: boolean;
}

export interface FireWeaponPayload {
  attackerId: string;
  weaponId: string;
  targetId: string;
}

export interface CreateObjectPayload {
  type: 'ship' | 'station' | 'asteroid';
  hullId?: string;
  x: number;
  y: number;
  heading?: number;
  faction?: Faction;
  ownerId?: string;
  name?: string;
}

// ... 其他 Payload
```

### 4.2 Client 包重构

#### 4.2.1 类型引用

```typescript
// packages/client/src/sync/types.ts

// 从 server 包直接导入类型
import type { 
  ShipStateType,
  GameRoomStateType,
  PlayerStateType
} from '@vt/server/schema/types';

// 导出给客户端使用
export type ShipState = ShipStateType;
export type GameRoomState = GameRoomStateType;
export type PlayerState = PlayerStateType;

// 客户端友好的扁平化类型（如果需要）
export interface PlainShip {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  heading: number;
  hull: number;
  maxHull: number;
  // ... 其他 UI 需要的字段
}

// 转换函数
export function toPlainShip(state: ShipState): PlainShip {
  return {
    id: state.id,
    ownerId: state.ownerId,
    x: state.transform.x,
    y: state.transform.y,
    heading: state.transform.heading,
    hull: state.hull.current,
    maxHull: state.hull.max,
  };
}
```

#### 4.2.2 Zustand Store

```typescript
// packages/client/src/state/stores/gameStore.ts

import { create } from 'zustand';
import type { ShipState, GameRoomState } from '../../sync/types';

interface GameStore {
  ships: Map<string, ShipState>;
  players: Map<string, PlayerState>;
  currentPhase: GameRoomState['currentPhase'];
  turnCount: number;
  
  // Actions
  setShip: (ship: ShipState) => void;
  removeShip: (id: string) => void;
  setPhase: (phase: GameRoomState['currentPhase']) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  ships: new Map(),
  players: new Map(),
  currentPhase: 'DEPLOYMENT',
  turnCount: 1,
  
  setShip: (ship) => set((state) => ({
    ships: new Map(state.ships).set(ship.id, ship)
  })),
  
  removeShip: (id) => set((state) => {
    const next = new Map(state.ships);
    next.delete(id);
    return { ships: next };
  }),
  
  setPhase: (phase) => set({ currentPhase: phase }),
}));
```

#### 4.2.3 Colyseus 同步 Hook

```typescript
// packages/client/src/sync/useRoomSync.ts

import { useEffect } from 'react';
import type { Room } from 'colyseus.js';
import type { GameRoomState } from './types';
import { useGameStore } from '../state/stores/gameStore';

export function useRoomSync(room: Room<GameRoomState> | null) {
  const { setShip, removeShip, setPhase, setTurnCount } = useGameStore();
  
  useEffect(() => {
    if (!room) return;
    
    const state = room.state;
    
    // 同步舰船
    state.ships.onAdd = (ship) => {
      setShip(ship);
    };
    
    state.ships.onChange = (ship) => {
      setShip(ship);
    };
    
    state.ships.onRemove = (ship) => {
      removeShip(ship.id);
    };
    
    // 同步游戏阶段
    state.listen('currentPhase', (phase) => {
      setPhase(phase);
    });
    
    state.listen('turnCount', (count) => {
      setTurnCount(count);
    });
    
  }, [room, setShip, removeShip, setPhase, setTurnCount]);
}
```

### 4.3 Data 包重构

```typescript
// packages/data/src/types.ts
// 独立类型定义，不依赖任何包

export interface ShipHullSpec {
  id: string;
  name: string;
  size: 'FIGHTER' | 'FRIGATE' | 'DESTROYER' | 'CRUISER' | 'CAPITAL';
  class: string;
  width: number;
  length: number;
  hitPoints: number;
  armorMax: number;
  fluxCapacity: number;
  fluxDissipation: number;
  hasShield: boolean;
  shieldType: 'FRONT' | 'OMNI' | 'NONE';
  shieldArc: number;
  maxSpeed: number;
  maxTurnRate: number;
  weaponMounts: WeaponMountSpec[];
}

export interface WeaponMountSpec {
  id: string;
  type: 'FIXED' | 'TURRET' | 'HIDDEN';
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  position: { x: number; y: number };
  facing: number;
  arc: number;
  defaultWeapon?: string;
}

export interface WeaponSpec {
  id: string;
  name: string;
  category: 'BALLISTIC' | 'ENERGY' | 'MISSILE' | 'SYNERGY';
  damageType: 'KINETIC' | 'HIGH_EXPLOSIVE' | 'ENERGY' | 'FRAGMENTATION';
  damage: number;
  range: number;
  arc: number;
  cooldown: number;
  fluxCost: number;
}
```

### 4.4 Rules 包重构

```typescript
// packages/rules/src/index.ts
// 纯函数导出，不依赖 Schema

// 数学工具
export * from './math/index.js';

// 战斗计算
export * from './combat/armor.js';
export * from './combat/damage.js';

// 验证器
export * from './validation/index.js';

// 不再重导出 @vt/data 或 @vt/types
```

---

## 5. 迁移阶段与里程碑

### 阶段 1: 基础设施准备 (Day 1-2)

**目标**: 建立新的类型导出机制，准备迁移基础

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 创建 server/src/schema/types.ts | 后端 | 导出所有 Schema 类型，无编译错误 |
| 创建 server/src/commands/types.ts | 后端 | 所有 Payload 类型迁移完成 |
| 更新 server/package.json 添加 exports | 后端 | 其他包可以导入 @vt/server/schema/types |
| 创建 data/src/types.ts | 数据 | 独立类型定义，无外部依赖 |
| 更新 data/package.json | 数据 | 准备好被 server/rules 引用 |

**里程碑**: Server 包可以导出类型供其他包使用

---

### 阶段 2: 服务端迁移 (Day 3-5)

**目标**: Server 包完全使用 Schema 作为类型，删除 @vt/types 引用

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 修改所有 Schema 文件，删除 implements VT.xxx | 后端 | Schema 类不依赖 @vt/types |
| 迁移所有 Payload 定义到 commands/types.ts | 后端 | BattleRoomHandlers.ts 使用新类型 |
| 修改所有 handler 文件，更新 import | 后端 | 无 @vt/types 引用 |
| 修改 DTO 文件，使用 Schema 类型 | 后端 | dto/*.ts 无 @vt/types 引用 |
| 修改 factory，组合 data + rules | 后端 | ShipFactory.ts 运行正常 |
| 修改 validation/messagePayloads.ts | 后端 | 使用 commands/types |
| 运行服务端测试 | 后端 | 所有测试通过 |

**里程碑**: Server 包零 @vt/types 依赖，可以独立运行

---

### 阶段 3: Data & Rules 包迁移 (Day 6)

**目标**: Data 和 Rules 包独立，不依赖 @vt/types

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 删除 data 包的 @vt/types 依赖 | 数据 | 类型独立定义 |
| 更新 rules 包的 import | 规则 | 从 @vt/data 导入类型 |
| 删除 rules 包的 @vt/types 依赖 | 规则 | 只依赖 @vt/data |
| 运行 rules 测试 | 规则 | 所有测试通过 |

**里程碑**: Data + Rules 包零 @vt/types 依赖

---

### 阶段 4: 客户端类型迁移 (Day 7-9)

**目标**: Client 包使用 @vt/server 的类型，删除重复定义

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 创建 client/src/sync/types.ts | 前端 | 从 @vt/server 导入类型 |
| 删除 client/src/types/index.ts 的重复定义 | 前端 | 文件删除或仅保留派生类型 |
| 更新 store/slices/*.ts，使用新类型 | 前端 | 所有 slice 文件编译通过 |
| 更新所有 hooks 文件 | 前端 | hooks 无 @vt/types 引用 |
| 更新 renderer/ 下的所有文件 | 前端 | 渲染层使用新类型 |
| 更新 features/ 下的所有文件 | 前端 | features 无 @vt/types 引用 |
| 更新 components/ 下的所有文件 | 前端 | components 无 @vt/types 引用 |

**里程碑**: Client 包零 @vt/types 依赖，编译通过

---

### 阶段 5: Redux 迁移到 Zustand (Day 10-12)

**目标**: 统一使用 Zustand，删除 Redux

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 创建 state/stores/gameStore.ts | 前端 | 替代 store/slices/*.ts |
| 创建 state/stores/uiStore.ts | 前端 | 替代 uiStore.ts |
| 创建 state/stores/cameraStore.ts | 前端 | 如果需要 |
| 删除 store/slices/ 目录 | 前端 | 目录删除 |
| 删除 store/index.ts | 前端 | 文件删除 |
| 更新所有使用 Redux 的文件 | 前端 | 改用 Zustand |
| 删除 Redux 依赖 | 前端 | package.json 无 redux/react-redux |

**里程碑**: 单一状态管理方案（Zustand），无 Redux

---

### 阶段 6: 前端结构重构 (Day 13-15)

**目标**: 按新技术栈组织文件

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 创建 renderer/ 目录结构 | 前端 | 文件按新结构放置 |
| 移动 components/map/hooks/ 到 renderer/ | 前端 | hooks 按功能分类 |
| 移动 features/game/ 到 renderer/ | 前端 | 渲染逻辑统一在 renderer |
| 移动 features/ui/ 到 ui/panels/ | 前端 | UI 组件统一在 ui |
| 删除 features/ 目录 | 前端 | 目录删除 |
| 更新所有 import 路径 | 前端 | 无 broken import |
| 运行前端测试 | 前端 | 所有测试通过 |

**里程碑**: 前端文件结构符合理想树

---

### 阶段 7: 删除 @vt/types 包 (Day 16)

**目标**: 彻底删除废弃的类型包

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 确认无包依赖 @vt/types | 全员 | grep -r "@vt/types" packages/ 无结果 |
| 删除 packages/types 目录 | 全员 | 目录删除 |
| 更新根 package.json | 全员 | workspaces 更新 |
| 更新 turbo.json | 全员 | pipeline 更新 |
| 全项目构建测试 | 全员 | pnpm build 通过 |
| 全项目类型检查 | 全员 | pnpm typecheck 通过 |

**里程碑**: @vt/types 包彻底删除，项目使用新架构

---

### 阶段 8: 端到端测试 (Day 17-18)

**目标**: 验证完整功能

| 任务 | 负责人 | 验收标准 |
|------|--------|----------|
| 启动服务端 | 测试 | 无错误启动 |
| 启动客户端 | 测试 | 无错误启动 |
| 测试登录流程 | 测试 | 可以正常登录 |
| 测试大厅功能 | 测试 | 房间列表、创建房间正常 |
| 测试游戏流程 | 测试 | 进入房间、同步状态正常 |
| 测试战斗功能 | 测试 | 移动、射击、护盾正常 |
| 测试存档功能 | 测试 | 保存、加载正常 |

**里程碑**: 完整游戏功能可用，无回归 bug

---

## 6. 风险管理

### 6.1 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Schema 类型导出不完整 | 客户端编译失败 | 阶段 1 仔细设计 types.ts 导出 |
| Colyseus Schema 与 Zustand 状态冲突 | 运行时错误 | 在适配层做类型转换，不直接混用 |
| Redux 迁移遗漏 | 某些组件状态异常 | 全局搜索 useDispatch/useSelector，确保全部替换 |
| 文件移动导致 import 断裂 | 编译失败 | 使用 IDE 重构功能，批量更新 import |
| 三阶段移动逻辑损坏 | 核心玩法异常 | 保留 rules 包不变，只更新 import |

### 6.2 回滚策略

**不设置回滚**，因为是彻底迁移。但每个阶段结束时保存 git tag：

```bash
# 每个阶段完成后
git tag -a "refactor-p1-infrastructure" -m "阶段1完成: 基础设施准备"
git tag -a "refactor-p2-server" -m "阶段2完成: 服务端迁移"
git tag -a "refactor-p3-data-rules" -m "阶段3完成: Data & Rules 迁移"
git tag -a "refactor-p4-client-types" -m "阶段4完成: 客户端类型迁移"
git tag -a "refactor-p5-zustand" -m "阶段5完成: Redux 迁移到 Zustand"
git tag -a "refactor-p6-structure" -m "阶段6完成: 前端结构重构"
git tag -a "refactor-p7-delete-types" -m "阶段7完成: 删除 @vt/types"
git tag -a "refactor-p8-complete" -m "阶段8完成: 端到端测试通过"
```

---

## 7. 成功标准

迁移成功需满足以下全部条件：

1. **无 @vt/types 依赖**: `grep -r "@vt/types" packages/` 返回空
2. **单一状态管理**: 无 Redux 代码，Zustand 正常工作
3. **编译通过**: `pnpm build` 所有包构建成功
4. **类型检查通过**: `pnpm typecheck` 无错误
5. **测试通过**: `pnpm test` 所有测试通过
6. **功能完整**: 登录、大厅、游戏、战斗、存档功能正常
7. **文件结构符合**: 实际目录与理想文件树一致

---

## 8. 附录

### 8.1 依赖关系图

```
新依赖关系:

@vt/data
  └─ 无依赖

@vt/rules
  └─ @vt/data

@vt/server
  ├─ @vt/data
  ├─ @vt/rules
  └─ @colyseus/schema, @colyseus/core

@vt/client
  ├─ @vt/server (仅类型)
  ├─ @vt/data
  ├─ @vt/rules (可选，用于客户端预测)
  ├─ zustand
  ├─ pixi.js
  └─ colyseus.js
```

### 8.2 快速参考命令

```bash
# 检查 @vt/types 引用
grep -r "@vt/types" packages/ --include="*.ts" --include="*.json"

# 检查 Redux 引用
grep -r "useDispatch\|useSelector\|from 'react-redux'" packages/client/src --include="*.ts" --include="*.tsx"

# 构建单个包
pnpm --filter @vt/server build

# 类型检查单个包
pnpm --filter @vt/client typecheck

# 运行测试
pnpm test
```

---

**文档结束**
