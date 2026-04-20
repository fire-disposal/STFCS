## 设计规范（理想结构）

packages/server/src/
├── core/                     # 核心（无依赖，纯逻辑）
│   ├── engine/              # 游戏引擎
│   │   ├── index.ts
│   │   ├── applyAction.ts   # 入口（最核心）
│   │   ├── context.ts       # 执行上下文
│   │
│   │   ├── modules/         # 子系统
│   │   │   ├── movement.ts
│   │   │   ├── combat.ts
│   │   │   ├── flux.ts
│   │   │   ├── shield.ts
│   │   │   ├── turn.ts
│   │   │   └── modifier.ts
│   │
│   │   ├── geometry/        # 几何模块
│   │   │   ├── distance.ts
│   │   │   ├── angle.ts
│   │   │   ├── sector.ts
│   │   │   ├── quadrant.ts
│   │   │   └── index.ts
│   │
│   │   └── rules/           # 规则实现
│   │       ├── damage.ts
│   │       ├── armor.ts
│   │       ├── weapon.ts
│   │       └── index.ts
│   │
│   ├── state/               # 状态结构（纯JSON）
│   │   ├── GameState.ts
│   │   ├── Token.ts
│   │   ├── Component.ts
│   │   └── index.ts
│   │
│   ├── actions/             # Action定义（输入）
│   │   ├── move.ts
│   │   ├── attack.ts
│   │   ├── rotate.ts
│   │   ├── endTurn.ts
│   │   └── index.ts
│   │
│   ├── events/              # Event定义（输出）
│   │   ├── damage.ts
│   │   ├── moved.ts
│   │   ├── fluxChanged.ts
│   │   ├── turnChanged.ts
│   │   └── index.ts
│   │
│   └── types/               # 仅少量核心类型
│       └── common.ts
│
├── server/                  # 网络层（WS为主）
│   ├── ws/
│   │   ├── server.ts        # WS入口
│   │   ├── connection.ts    # 连接管理
│   │   └── protocol.ts      # 消息协议
│   │
│   ├── rooms/               # 房间系统（极简）
│   │   ├── Room.ts
│   │   ├── RoomManager.ts
│   │   └── types.ts
│   │
│   ├── handlers/            # 消息处理（很薄）
│   │   ├── actionHandler.ts
│   │   ├── joinHandler.ts
│   │   └── index.ts
│   │
│   └── broadcast/           # 广播策略
│       └── broadcaster.ts
│
├── data/                    # JSON数据（核心！）
│   ├── ships/
│   ├── weapons/
│   ├── components/
│   └── modifiers/
│
├── runtime/                 # 运行时服务
│   ├── GameRuntime.ts       # 管理所有对局
│   ├── Match.ts             # 单局封装
│   └── TurnManager.ts
│
├── infra/                   # 基础设施
│   ├── logger.ts
│   ├── errors.ts
│   └── config.ts
│
└── index.ts                 # 启动入口

---

## 现有后端真实文件树

packages/server/src/
├── api/                        # [新增] API 路由
│   └── routers/
│       └── __tests__/
│
├── core/                       # ✓ 符合设计
│   ├── actions/
│   │   ├── attack.ts
│   │   ├── endTurn.ts
│   │   ├── index.ts
│   │   ├── move.ts
│   │   └── rotate.ts
│   │
│   ├── engine/
│   │   ├── applyAction.ts
│   │   ├── context.ts
│   │   ├── index.ts
│   │   │
│   │   ├── geometry/
│   │   │   ├── angle.ts
│   │   │   ├── distance.ts
│   │   │   ├── index.ts
│   │   │   ├── quadrant.ts
│   │   │   └── sector.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── combat.ts
│   │   │   ├── flux.ts
│   │   │   ├── index.ts
│   │   │   ├── modifier.ts
│   │   │   ├── movement.test.ts    # 测试文件混入源码
│   │   │   ├── movement.ts
│   │   │   ├── shield.ts
│   │   │   └── turn.ts
│   │   │
│   │   ├── rules/
│   │   │   ├── armor.ts
│   │   │   ├── damage.ts
│   │   │   ├── index.ts
│   │   │   ├── targeting.test.ts   # 测试文件混入源码
│   │   │   ├── targeting.ts
│   │   │   └── weapon.ts
│   │   │
│   │   └── utils/                  # [新增] 未在设计规范中
│   │       ├── incrementalUpdate.test.ts
│   │       └── incrementalUpdate.ts
│   │
│   ├── events/
│   │   ├── damage.ts
│   │   ├── fluxChanged.ts
│   │   ├── index.ts
│   │   ├── moved.ts
│   │   └── turnChanged.ts
│   │
│   ├── state/
│   │   ├── Component.ts
│   │   ├── GameState.ts
│   │   ├── GameStateManager.ts     # [新增] 状态管理器
│   │   ├── Token.ts
│   │   └── index.ts
│   │
│   └── types/
│       ├── common.ts
│       └── index.ts
│
├── data/                        # ⚠️ 职责混乱
│   ├── DataRegistry.ts           # 逻辑代码混入数据目录！
│   ├── index.ts
│   │
│   ├── components/
│   │   └── index.ts
│   ├── modifiers/
│   │   └── index.ts
│   ├── ships/
│   │   └── index.ts
│   └── weapons/
│       └── index.ts
│
├── infra/                       # ⚠️ 不完整
│   └── simple-logger.ts          # 缺少 errors.ts, config.ts
│
├── persistence/                 # [新增] 持久化层
│   ├── index.ts
│   ├── interfaces.ts
│   ├── PersistenceManager.ts
│   ├── types.ts
│   └── memory/
│       ├── index.ts
│       ├── MemoryBaseRepository.ts
│       ├── MemoryRoomSaveRepository.ts
│       ├── MemoryShipRepository.ts
│       └── MemoryUserRepository.ts
│
├── runtime/                     # ✓ 基本符合
│   ├── GameRuntime.ts
│   ├── Match.ts
│   ├── TurnManager.ts
│   └── index.ts
│
├── server/                      # ⚠️ 结构有偏差
│   ├── broadcast/
│   │   ├── broadcaster.ts
│   │   └── index.ts
│   │
│   ├── handlers/
│   │   ├── actionHandler.ts
│   │   ├── index.ts
│   │   └── joinHandler.ts
│   │
│   ├── rooms/
│   │   ├── Room.ts
│   │   ├── RoomManager.ts
│   │   └── index.ts
│   │
│   ├── services/                 # ⚠️ 与顶级 services/ 重复
│   │   └── DataUpdateService.ts
│   │
│   └── socketio/                 # ⚠️ 设计规范是 ws/
│       └── handler.ts
│
├── services/                    # [新增] 服务层
│   ├── AssetService.ts
│   ├── PlayerAvatarStorageService.ts
│   ├── PlayerProfileService.test.ts
│   ├── PlayerProfileService.ts
│   └── SimpleObjectCreationService.ts
│
├── storage/                     # [新增] 存储层
│   └── MemoryStorage.ts
│
└── index.ts

---

## 结构不合理之处分析

### 1. `DataRegistry.ts` 位置问题 ⚠️ 严重

**现状**: `DataRegistry.ts` 位于 `src/data/` 目录下

**背景**: 上个版本 `@vt/data` 包被简化，DataRegistry 作为后端逻辑被移入 `packages/server`

**问题**:
- `data/` 目录本应是**纯 JSON 数据目录**（存放舰船、武器定义等静态数据）
- `DataRegistry.ts` 是**逻辑代码**（类、方法、状态管理、ID生成），不是数据
- 违反了"数据与逻辑分离"原则
- 导入路径 `@/data/DataRegistry` 语义上应为数据而非代码

**根本原因**: 后端目录层级混乱，不知道该放哪里：
```
packages/server/          <- 后端包
├── src/
│   ├── server/          <- 也叫 server（网络层）
│   │   ├── services/    <- server 下有 services
│   ├── services/        <- src 下也有 services（重复！）
│   ├── data/            <- DataRegistry 被塞这里
```

**建议方案**:

**方案A**: 放入 `src/runtime/`（推荐）
```
src/runtime/
├── DataRegistry.ts    <- 运行时数据管理
├── GameRuntime.ts
├── Match.ts
└── TurnManager.ts
```

**方案B**: 新建 `src/registry/`
```
src/registry/
├── DataRegistry.ts    <- 数据注册中心
└── index.ts
```

**方案C**: 放入 `src/services/`（如果视为服务）
```
src/services/
├── DataRegistryService.ts  <- 重命名强调是服务
├── AssetService.ts
└── ...
```

### 2. `services/` 目录重复 ⚠️

**现状**:
- `src/services/` - 顶级服务层
- `src/server/services/` - 服务层子目录

**问题**:
- 两个 `services` 目录职责不清
- `DataUpdateService` 放在 `server/services/` 但其他服务在顶级 `services/`
- 缺乏统一的命名和组织规范

**建议**: 合并为单一 `src/services/` 目录

### 3. 网络层技术栈不一致

**现状**: `src/server/socketio/` 

**设计**: `src/server/ws/` (WebSocket)

**问题**: 设计文档期望原生 WebSocket，实际使用了 Socket.io
- 如果是刻意选择，应更新设计文档
- 如果是临时方案，应标注 TODO

### 4. `infra/` 目录不完整

**现状**: 只有 `simple-logger.ts`

**设计**: 应包含 `logger.ts`, `errors.ts`, `config.ts`

**建议**: 补全或调整设计规范

### 5. 测试文件混入源码

**现状**:
- `movement.test.ts` 在 `modules/` 下
- `targeting.test.ts` 在 `rules/` 下
- `incrementalUpdate.test.ts` 在 `utils/` 下
- `PlayerProfileService.test.ts` 在 `services/` 下

**问题**: 测试文件应放在 `__tests__/` 或同级 `*.test.ts` 目录，但最好统一放置在 `tests/` 或 `__tests__/`

### 6. `data/` 下各子目录只有 `index.ts`

**现状**: `ships/`, `weapons/`, `components/`, `modifiers/` 只有空的 index.ts

**问题**: 如果是为了未来扩展，应添加注释说明；如果是废弃结构，应清理

### 7. `persistence/` 与 `storage/` 职责重叠

**现状**:
- `persistence/` - 仓库模式实现
- `storage/` - 只有 `MemoryStorage.ts`

**问题**: 两个目录都涉及数据持久化，职责边界模糊

**建议**: 将 `storage/` 合并到 `persistence/` 下

---

## 最终目录结构（重构后）

```
packages/server/src/
├── core/           # 纯游戏逻辑
├── services/       # ✓ 业务服务（统一）
│   ├── preset/     # 预设加载/查询
│   ├── ship/       # 舰船构建服务
│   ├── weapon/     # 武器服务
│   ├── component/  # 组件服务
│   ├── modifier/   # 修正器服务
│   ├── AssetService.ts
│   ├── PlayerProfileService.ts
│   └── ...
├── persistence/    # ✓ 数据存储
│   ├── interfaces.ts
│   ├── types.ts
│   ├── PersistenceManager.ts
│   └── memory/
│       ├── MemoryShipRepository.ts
│       ├── MemoryWeaponRepository.ts  # 新增
│       └── ...
├── runtime/        # 游戏运行时
├── server/         # 网络层
├── infra/          # 基础设施
├── api/            # API 路由
└── index.ts

packages/data/src/
├── core/           # Zod Schema
├── configs/        # game-rules.json
├── presets/        # ✓ 预设数据
│   ├── ships/      # 预设舰船 JSON
│   ├── weapons/    # 预设武器 JSON
│   └── index.ts
└── index.ts
```

### 重构成果

1. **删除冗余代码**:
   - `src/data/` 整个目录
   - `src/storage/` 整个目录
   - `src/server/services/` 整个目录

2. **新增/重构**:
   - `@vt/data/presets/` - 预设舰船/武器 JSON 数据
   - `src/services/preset/` - PresetLoader, PresetService
   - `src/services/ship/` - ShipBuildService
   - `src/services/weapon/` - WeaponService
   - `src/services/component/` - ComponentService
   - `src/services/modifier/` - ModifierService
   - `src/persistence/memory/MemoryWeaponRepository.ts`

3. **数据流清晰**:
   ```
   @vt/data/presets/*.json  → PresetLoader → persistence → PresetService
   用户输入                  → ShipBuildService → persistence
   ```

4. **构建验证**: ✓ 成功

---

## MongoDB + Mongoose 存储方案

### 文件结构

```
persistence/
├── interfaces.ts        # Repository 接口（不变）
├── types.ts             # 领域模型类型（不变）
├── PersistenceManager.ts
│
├── memory/              # 内存存储（默认）
│   ├── MemoryBaseRepository.ts
│   ├── MemoryShipRepository.ts
│   ├── MemoryWeaponRepository.ts
│   ├── MemoryUserRepository.ts
│   └── MemoryRoomSaveRepository.ts
│
└── mongoose/            # MongoDB 存储（新增）
│   ├── Schemas.ts       # Mongoose Schema 定义
│   ├── MongoBaseRepository.ts  # 通用 Repository 实现
│   └── index.ts         # connectMongo, disconnectMongo, mongoRepositories
│
└── index.ts             # 统一导出（内存 + MongoDB）
```

### 使用方式

```typescript
// 内存存储（默认）
import { PersistenceManager } from "@vt/server";
const persistence = PersistenceManager.createMemory();

// MongoDB 存储
import { connectMongo, mongoRepositories } from "@vt/server";

await connectMongo({ uri: "mongodb://localhost:27017", dbName: "stfcs" });
const persistence = mongoRepositories;  // { ships, weapons, users, roomSaves }

// 服务层代码无需修改，Repository 接口一致
const shipService = new ShipBuildService(persistence);
```

### 切换逻辑

服务层依赖 Repository 接口而非具体实现，可无缝切换：

```typescript
// 环境配置决定使用哪种存储
const useMongo = process.env.DB_TYPE === "mongo";

const persistence = useMongo
  ? mongoRepositories
  : PersistenceManager.createMemory();
```

### 依赖

```json
{
  "dependencies": {
    "mongoose": "^9.4.1"
  }
}

### 持久化开关

**环境变量**: `PERSISTENCE_TYPE`

- `"memory"` (默认) - 内存存储，重启后数据丢失
- `"mongo"` - MongoDB 存储，需要先调用 `connectMongo()`

**使用方式**:

```typescript
// 方式1: 直接使用内存存储（推荐测试）
import { PersistenceManager, persistence } from "@vt/server";
const pm = PersistenceManager.createMemory();  // 或直接使用 persistence

// 方式2: 环境变量控制
// 设置 PERSISTENCE_TYPE=mongo 后需要手动连接
import { connectMongo, mongoRepositories } from "@vt/server";
await connectMongo({ uri: "mongodb://localhost:27017" });
const pm = mongoRepositories;

// 方式3: 检查当前类型
console.log(persistence.getType());  // "memory"
```

**配置文件示例** (.env):
```
PERSISTENCE_TYPE=memory  # 测试环境
PERSISTENCE_TYPE=mongo   # 生产环境（需配合 connectMongo）
```

---

## 新架构设计方案

### 核心问题诊断

现有 `src/data/` 目录的问题：

| 文件 | 实际内容 | 问题 |
|------|----------|------|
| `DataRegistry.ts` | 类定义+状态管理 | **逻辑代码混入数据目录** |
| `ShipDataManager` | 包装 DataRegistry | **冗余**：每个实例创建独立 Registry，数据不共享 |
| `WeaponDataManager` | 包装 DataRegistry | **冗余**：同上 |
| `ComponentDataManager` | 独立服务+内置数据 | 有价值，但位置错误 |
| `ModifierSystem` | 独立服务+内置数据 | 有价值，但位置错误 |

### 现有 persistence 层分析

**已有的优秀设计**：
```
persistence/
├── interfaces.ts           # Repository 接口定义 ✓
├── types.ts                # ShipBuild, UserProfile, RoomArchive ✓
├── PersistenceManager.ts   # 统一管理入口 ✓
└── memory/
    ├── MemoryBaseRepository.ts   # 基础 CRUD ✓
    ├── MemoryShipRepository.ts   # 舰船存储 ✓
    ├── MemoryUserRepository.ts   # 用户存储 ✓
    └── MemoryRoomSaveRepository.ts # 存档 ✓
```

**关键发现**：
- `ShipBuild` 类型已定义：包含 `isPreset` 字段，可区分预设与用户自定义
- `PersistenceManager` 已提供统一入口
- Repository 模式已完善，未来可无缝切换到 MongoDB

### 建议的新架构

```
packages/server/src/
├── core/                       # 纯游戏逻辑（无状态，无 I/O）
│   ├── engine/                 # 游戏引擎
│   │   ├── applyAction.ts      # 核心：执行动作
│   │   ├── context.ts          # 执行上下文
│   │   ├── modules/            # 子系统
│   │   │   ├── movement.ts
│   │   │   ├── combat.ts
│   │   │   ├── flux.ts
│   │   │   ├── shield.ts
│   │   │   ├── turn.ts
│   │   │   └── modifier.ts     # 修正器应用逻辑（不是管理）
│   │   ├── geometry/           # 几何计算
│   │   ├── rules/              # 规则计算
│   │   └── utils/              # 工具函数
│   ├── state/                  # 状态类型（纯定义）
│   │   ├── GameState.ts
│   │   ├── GameStateManager.ts
│   │   ├── Token.ts
│   │   └── Component.ts
│   ├── actions/                # Action 类型定义
│   ├── events/                 # Event 类型定义
│   └── types/                  # 共享类型
│
├── services/                   # 业务服务层（统一！）
│   ├── index.ts                # 服务层统一导出
│   │
│   ├── preset/                 # 预设数据服务
│   │   ├── PresetLoader.ts     # 从 @vt/data 或 JSON 加载预设
│   │   └── PresetService.ts    # 预设查询/管理
│   │
│   ├── ship/                   # 舰船服务
│   │   ├── ShipBuildService.ts # 用户舰船构建（CRUD + 实例化）
│   │   └── ShipInstanceService.ts # 运行时舰船实例管理
│   │
│   ├── weapon/                 # 武器服务
│   │   └── WeaponService.ts    # 武器数据查询
│   │
│   ├── component/              # 组件服务
│   │   └── ComponentService.ts # 组件定义+运行时状态
│   │
│   ├── modifier/               # 修正器服务
│   │   └── ModifierService.ts  # 修正器定义+运行时管理
│   │
│   ├── player/                 # 玩家服务
│   │   ├── PlayerService.ts    # 玩家档案管理
│   │   └── PlayerProfileService.ts
│   │
│   └── AssetService.ts         # 资源加载
│   └── PlayerAvatarStorageService.ts
│   └── SimpleObjectCreationService.ts
│
├── persistence/                # 持久化层（保持现状，增强）
│   ├── interfaces.ts           # Repository 接口
│   ├── types.ts                # 领域模型
│   ├── PersistenceManager.ts   # 统一管理
│   │
│   ├── memory/                 # 内存存储实现
│   │   ├── MemoryBaseRepository.ts
│   │   ├── MemoryShipRepository.ts    # 存 ShipBuild
│   │   ├── MemoryWeaponRepository.ts  # [新增] 存 WeaponBuild
│   │   ├── MemoryUserRepository.ts
│   │   └── MemoryRoomSaveRepository.ts
│   │
│   ├── file/                   # [未来] 文件存储
│   └── mongodb/                 # [未来] MongoDB 实现
│
├── runtime/                    # 游戏运行时（无状态存储）
│   ├── GameRuntime.ts          # 对局管理器
│   ├── Match.ts                # 单局封装
│   ├── TurnManager.ts          # 回合管理
│   └── index.ts
│
├── server/                     # 网络层
│   ├── socketio/               # Socket.IO
│   ├── rooms/                  # 房间管理
│   ├── handlers/               # 消息处理
│   └── broadcast/              # 广播
│
├── infra/                      # 基础设施
│   ├── logger.ts               # 日志
│   ├── errors.ts               # 错误定义
│   └── config.ts               # 配置
│
└── index.ts                    # 入口
```

### 关键设计决策

#### 1. 删除冗余代码

```diff
- src/data/DataRegistry.ts          # 删除，功能分散到 services
- src/data/ships/index.ts           # 删除（ShipDataManager 冗余）
- src/data/weapons/index.ts         # 删除（WeaponDataManager 冗余）
- src/data/index.ts                 # 删除
- src/storage/MemoryStorage.ts      # 删除，已有 persistence 层
- src/server/services/              # 删除，合并到顶层 services
```

#### 2. @vt/data 包的结构（预设数据源）

```
packages/data/src/
├── core/
│   ├── GameSchemas.ts        # Zod Schema（类型定义）
│   ├── ActionSchemas.ts      # Action Schema
│   └── index.ts
│
├── configs/
│   ├── game-rules.json       # ✓ 已存在：游戏规则配置
│   └── index.ts
│
├── presets/                  # [新增] 预设数据目录
│   ├── ships/                # 预设舰船 JSON
│   │   ├── frigate-basic.json
│   │   ├── destroyer-standard.json
│   │   ├── cruiser-assault.json
│   │   └── index.ts          # 导出所有预设舰船
│   │
│   ├── weapons/              # 预设武器 JSON
│   │   ├── railgun-small.json
│   │   ├── laser-medium.json
│   │   ├── missile-large.json
│   │   └── index.ts          # 导出所有预设武器
│   │
│   ├── components/           # 预设组件定义（可选）
│   │   └── index.ts
│   │
│   └── modifiers/            # 预设修正器定义（可选）
│   │   └── index.ts
│   │
│   └── index.ts              # 预设数据统一导出
│
└── index.ts                  # 包主入口
```

**预设舰船 JSON 示例** (`presets/ships/frigate-basic.json`):
```json
{
  "$id": "preset:frigate-basic",
  "$schema": "ship-v1",
  "metadata": {
    "name": "基础护卫舰",
    "description": "标准护卫舰配置",
    "author": "STFCS",
    "createdAt": 1700000000000
  },
  "ship": {
    "class": "FRIGATE",
    "size": "SMALL",
    "maxHitPoints": 800,
    "armorMaxPerQuadrant": 100,
    "fluxCapacity": 200,
    "fluxDissipation": 10,
    "speed": 150,
    "turnRate": 30,
    "shield": { "radius": 50, "type": "OMNI" },
    "mounts": [
      { "id": "mount-1", "size": "SMALL", "arc": 120, "weapon": "preset:railgun-small" }
    ]
  }
}
```

#### 3. 数据流设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        @vt/data 包                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Zod Schema   │  │ 预设舰船JSON │  │ 预设武器JSON │               │
│  │ (类型定义)   │  │ presets/     │  │ presets/     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│         │                  │                  │                      │
│         │ 类型验证          │ 数据导入         │                      │
│         ▼                  ▼                  ▼                      │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          │ import from "@vt/data"
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        @vt/server 包                                 │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      services 层                               │  │
│  │  ┌──────────────┐                                             │  │
│  │  │ PresetLoader │  ← 启动时加载 @vt/data/presets/ 下的 JSON   │  │
│  │  └──────────────┘                                             │  │
│  │         │                                                      │  │
│  │         │ 验证 + 注册                                          │  │
│  │         ▼                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │ PresetService│  │ShipBuildService│ │WeaponService │         │  │
│  │  │ (预设查询)   │  │(用户舰船CRUD) │ │(武器查询)    │         │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │  │
│  │         │                  │                  │                │  │
│  └─────────┼──────────────────┼──────────────────┼────────────────┘  │
│            │                  │                  │                   │
│            ▼                  ▼                  ▼                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    persistence 层                              │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ ShipRepository   │  │ WeaponRepository │                   │  │
│  │  │ (ShipBuild存储)  │  │ (WeaponBuild存储)│                   │  │
│  │  │ isPreset=true    │  │ isPreset=true    │                   │  │
│  │  │ isPreset=false   │  │ isPreset=false   │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  │        预设数据 ←───────┬───────→ 用户数据                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4. 服务层职责划分

| 服务 | 职责 | 数据来源 |
|------|------|----------|
| `PresetLoader` | 启动时加载 `@vt/data/presets/*.json` | @vt/data |
| `PresetService` | 预设查询（舰船/武器/组件） | persistence (isPreset=true) |
| `ShipBuildService` | 用户舰船 CRUD、验证、实例化 | persistence |
| `ShipInstanceService` | 运行时舰船状态管理（对局内） | runtime |
| `WeaponService` | 武器查询、兼容性检查、属性计算 | persistence |
| `ComponentService` | 组件定义管理、效果计算 | 内置 + persistence |
| `ModifierService` | 修正器定义管理、运行时应用 | 内置 + persistence |

#### 5. PresetLoader 实现

```typescript
// services/preset/PresetLoader.ts
import { 
  ShipJSONSchema, 
  WeaponJSONSchema,
  type ShipJSON,
  type WeaponJSON,
} from "@vt/data";

// 从 @vt/data 动态导入预设 JSON
import presetShips from "@vt/data/presets/ships";
import presetWeapons from "@vt/data/presets/weapons";

export class PresetLoader {
  constructor(private persistence: PersistenceManager) {}

  async loadAllPresets(): void {
    // 加载舰船预设
    for (const shipJson of presetShips) {
      const validated = ShipJSONSchema.parse(shipJson);
      await this.persistence.ships.create({
        id: validated.$id,
        shipJson: validated,
        ownerId: "system",
        isPreset: true,
        isPublic: true,
        customizations: {},
        tags: ["preset"],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // 加载武器预设...
  }
}
```

#### 6. @vt/data/presets 导出设计

```typescript
// packages/data/src/presets/ships/index.ts
import frigateBasic from "./frigate-basic.json";
import destroyerStandard from "./destroyer-standard.json";

export const presetShips = [
  frigateBasic,
  destroyerStandard,
] as const;

// packages/data/src/presets/index.ts
export { presetShips } from "./ships/index.js";
export { presetWeapons } from "./weapons/index.js";

// packages/data/src/index.ts (更新)
export * from "./core/index.js";
export * from "./configs/index.js";
export { presetShips, presetWeapons } from "./presets/index.js";
```
```

### 迁移步骤

1. **Phase 1**: 创建新服务骨架
   - 创建 `services/preset/PresetLoader.ts`
   - 创建 `services/preset/PresetService.ts`
   - 创建 `services/ship/ShipBuildService.ts`

2. **Phase 2**: 迁移有价值代码
   - `ComponentDataManager` → `services/component/ComponentService.ts`
   - `ModifierSystem` → `services/modifier/ModifierService.ts`

3. **Phase 3**: 删除冗余代码
   - 删除 `src/data/` 目录
   - 删除 `src/storage/`
   - 删除 `src/server/services/`

4. **Phase 4**: 更新导入路径
   - 更新 `index.ts` 导出
   - 更新所有依赖引用

### 最终目录结构（删除 data/ 后）

```
packages/server/src/
├── core/           # 纯逻辑
├── services/       # 业务服务（统一）
├── persistence/    # 数据存储
├── runtime/        # 运行时
├── server/         # 网络
├── infra/          # 基础设施
├── api/            # API 路由（可选）
└── index.ts
```

**清晰分层**：
- `core/` = 无状态的纯计算逻辑
- `services/` = 有状态的业务逻辑，调用 persistence
- `persistence/` = 数据存储抽象层
- `runtime/` = 游戏运行时生命周期
- `server/` = 网络通信