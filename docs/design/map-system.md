# 地图体系设计文档

> 本文档记录 STFCS 地图系统的设计思路、架构方案和演进路线。
> 核心目标：从一个"空矩形"演化为一个**有叙事承载力的世界观地图**，
> 同时保持对桌游跑团场景的便利性。

---

## 1. 核心矛盾

STFCS 目前的定位是"战术战斗模拟器"，但在跑团场景中，实际的游戏流程是：

```
世界观地图（GM 叙事 + 玩家决策）
      │
      ├── 玩家选择前往某星系/区域
      ├── GM 判定遭遇 → 进入战术地图
      ├── 战术战斗结束 → 返回世界观地图
      └── 状态持续（舰船损伤、辐能、消耗品）
```

**问题**：当前只有一个平面战术地图，没有承载"航行 - 遭遇 - 决策"循环的框架。

### 1.1 与存档机制的关系

当前存档（`GameSave`）是整个 `GameRoomState` 的快照，包括：
- 所有 tokens（舰船）
- 所有 players（玩家）
- phase/turn/activeFaction（回合状态）
- **logs**（战斗日志）

如果引入世界观地图，存档需要包含：
- 舰队在星系间的位置
- 已探索/未探索区域
- 各区域的状态（已清理、有威胁、安全）
- 派系势力范围
- 时间线/事件日历

**这是一个增量扩展 —— 不是重写**。世界观地图作为 `GameRoomState` 的一个新顶层字段存在，与当前的战术层共存：

```
GameRoomState
├── (已有) phase, turnCount, tokens, players, logs ...
├── (已有) map: GameMapSchema → 当前战术地图
└── (新增) world: WorldMapSchema → 世界观地图层
         ├── regions: Region[]      // 星系/区域
         ├── fleetPosition: string  // 舰队当前位置 (region id)
         ├── knownRegions: string[] // 已探索区域
         ├── travelLog: TravelEvent[] // 航行日志
         └── eventCalendar: number  // 游戏内时间
```

**保存时**：世界观状态作为存档的一部分，与战术状态一起序列化。
**加载时**：世界观状态恢复，舰队回到之前位置，区域状态不变。

---

## 2. 世界观地图设计（VTT 兼容）

### 2.1 核心理念

不做一个"电子游戏风格"的宇宙地图，而是做一个**GM 友好的叙事地图**，类似：

- **远征号**的星图：节点 + 连线，抽象而非写实
- **星际迷航**的星区网格：可标注、可笔记
- **VTT 风格**：GM 可以添加标注、隐藏信息、逐步揭示

### 2.2 拓扑结构

```
节点 (Node)                         连线 (Edge)
├── 恒星系 (Star System)           ├── 超空间航线 (Trade Route)
│   ├── 星球/空间站                ├── 危险航线 (Perilous Path)
│   ├── 资源点                      ├── 未勘测航线 (Unexplored)
│   └── 遭遇点                      └── 封锁线 (Blockade)
├── 星云区 (Nebula Region)
├── 残骸区 (Graveyard)
└── 未知区域 (Unknown)
```

**这不是开放的 2D 平面，而是节点网络。** 这样设计的原因：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 开放 2D 平面 | 自由探索感强 | 实现复杂，GM 难以控制节奏 |
| **节点网络** | GM 可控节奏，易于叙事 | 探索感较弱 |
| 混合（节点+开放区域） | 两者兼顾 | 实现最复杂 |

**推荐方案**：节点网络为主，每个节点内有一个"探索区域"（小范围开放空间供侦察/搜索）。

### 2.3 数据 Schema

```typescript
// ── 世界观地图 ──

/** 节点类型 */
export const WorldNodeTypeSchema = z.enum([
  "star_system",     // 恒星系 — 标准节点，可包含多个子区域
  "nebula",          // 星云区 — 遮蔽，探索
  "anomaly",         // 异常区 — 随机事件
  "waypoint",        // 航标 — 无人区域，补给/维修
  "safe_haven",      // 安全港 — 完全安全，可交易/修复
  "hostile_zone",    // 敌对区 — 持续威胁
  "unknown",         // 未知区域 — GM 揭示前不可见
]);

/** 节点间连线类型 */
export const WorldEdgeTypeSchema = z.enum([
  "trade_route",     // 贸易航线 — 安全
  "perilous",        // 危险航线 — 可能遭遇
  "unexplored",      // 未勘测 — 首次通过触发事件
  "blockade",        // 封锁线 — 需要特殊条件通过
  "hidden",          // 隐藏航线 — 发现后才可见
]);

/** 世界观节点 */
export const WorldNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: WorldNodeTypeSchema,
  // 在星图上的位置（用于可视化布局，不是自由移动）
  position: PointSchema,
  // 描述文本（GM 可见/可编辑）
  description: z.string().optional(),
  // 隐藏描述（仅在玩家探索后揭示）
  hiddenDescription: z.string().optional(),
  // 已探索
  explored: z.boolean().default(false),
  // 当前状态
  state: z.enum(["safe", "threat", "cleared", "active"]).default("safe"),
  // 标签（GM 可自定义）
  tags: z.array(z.string()).optional(),
  // 关联资源/预设（可选，进入时触发）
  encounterPresetId: z.string().optional(),
  // 自定义数据（GM 扩展）
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** 节点间连线 */
export const WorldEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),      // 源节点 id
  to: z.string(),         // 目标节点 id
  type: WorldEdgeTypeSchema,
  // 航行消耗（天数/资源单位）
  travelCost: z.number().default(1),
  // 遭遇概率（0-1，每次通过时判定）
  encounterChance: z.number().default(0),
  // 隐藏连线（需发现才可见）
  hidden: z.boolean().default(false),
  // 已发现（hidden 连线用）
  discovered: z.boolean().default(false),
});

/** 世界观地图 */
export const WorldMapSchema = z.object({
  // 启用状态（未启用时使用传统单战斗地图）
  enabled: z.boolean().default(false),
  // 节点网络
  nodes: z.array(WorldNodeSchema),
  edges: z.array(WorldEdgeSchema),
  // 舰队当前位置
  fleetNodeId: z.string().optional(),
  // 最近访问历史（用于返回）
  nodeHistory: z.array(z.string()).optional(),
  // 游戏内时间线
  timeline: z.object({
    currentDay: z.number().default(1),
    events: z.array(z.object({
      day: z.number(),
      description: z.string(),
      nodeId: z.string().optional(),
    })).optional(),
  }).optional(),
  // GM 笔记（仅 GM 可见）
  gmNotes: z.string().optional(),
  // 星图外观
  appearance: z.object({
    backgroundColor: z.number().optional(),
    fogOfWar: z.boolean().default(true),
    gridStyle: z.enum(["none", "dots", "lines"]).default("dots"),
  }).optional(),
});
```

---

## 3. 游戏流程整合

### 3.1 两种模式的切换

```
DEPLOYMENT phase (当前)
  │
  ├── 世界观模式 enabled = false
  │   └── 直接进入战术地图（当前行为）
  │
  └── 世界观模式 enabled = true
      ├── 初始化世界观地图（加载预设或 GM 创建）
      ├── 玩家在世界观层选择航行目标
      ├── 进入战术地图（自动或 GM 触发）
      └── 战术战斗结束 → 返回世界观层
```

### 3.2 "星图"界面

世界观地图的 UI 不是用 PixiJS 画布渲染，而是在 React 层用一个**独立的星图面板**：

```
┌─────────────────────────────────────────────┐
│  [星图]                                      │
│                                              │
│       ○ 卡兰迪亚                    ○ 伊普西龙│
│      /        \                    /          │
│  ○ 门户      ○ 新巴布  ────  ○ 铁砧         │
│      \        /                    \          │
│       ○ 深渊                        ○ 终点   │
│                                              │
│  当前位置：卡兰迪亚    第 7 日                │
│  下一步：→ 门户 (安全)  → 新巴布 (危险)      │
└─────────────────────────────────────────────┘
```

- **节点** = 可点击的圆形按钮
- **连线** = 线段，颜色表示安全等级
- **当前位置** = 高亮标记
- **GM 模式** = 可拖拽编辑、添加节点、写笔记
- **FOW** = 未探索节点灰色不可见

### 3.3 航行流程

```
玩家选择目标节点
  │
  ├── 检查连线是否可达
  │   ├── 封锁线 → 需要特殊条件
  │   └── 隐藏线 → 需要已发现
  │
  ├── 确定航行消耗
  │   └── travelCost 天（影响 game timeline）
  │
  ├── 遭遇判定
  │   ├── encounterChance roll
  │   ├── 命中 → 进入战术地图（使用 encounterPresetId）
  │   └── 未命中 → 到达目标节点
  │
  └── 更新舰队位置
      ├── fleetNodeId = 目标节点
      └── timeline.currentDay += travelCost
```

---

## 4. 桌游便利功能

### 4.1 GM 工具（世界观层）

| 功能 | 描述 |
|------|------|
| **节点编辑** | 在星图上添加/删除/移动节点，编辑描述 |
| **事件触发器** | 设置条件触发（进入某节点自动开始战斗） |
| **FOW 控制** | 逐节点揭示/隐藏，控制信息流 |
| **时间线管理** | 手动推进天数，记录事件 |
| **多重预设** | 保存多种星图布局，开团前选择 |
| **随机生成器** | 基于种子生成节点网络（可选） |

### 4.2 基于当前系统的增量改造

不需要改动现有战斗系统。只需要：

**新增文件**：
```
packages/data/src/core/WorldSchemas.ts    ← 世界地图 Schema
packages/server/src/core/world/           ← 航行逻辑
packages/client/src/ui/panels/StarMap.tsx ← 星图 UI
```

**修改文件**：
```
GameSchemas.ts        → import 并嵌套 WorldMapSchema 到 GameRoomState（可选字段）
GamePage.tsx          → 增加"星图"模式切换
handlers/             → 新增 travel/world 命名空间
```

### 4.3 与存档的兼容

当前存档 = 整个 `GameRoomState`。世界观地图作为可选的顶层字段：

```typescript
// GameRoomState 新增
world: WorldMapSchema.optional()
```

- **现有存档**：`world = undefined` → 表现同当前（空战术地图）
- **新存档**：`world = {...}` → 启用世界观模式

加载时无需迁移代码。这是 Schema 层面的兼容。

---

## 5. 实现路线图

```
Phase 0（本文档）       设计方案评审
                         ~ 当前 ✓

Phase 1（Schema）       WorldSchemas.ts + GameRoomState 嵌套
                         ~ 100 行，纯数据层

Phase 2（星图 UI）       StarMap.tsx 基础版
                         ~ 400 行，节点+连线渲染

Phase 3（后端航行）      travel namespace + 遭遇判定
                         ~ 150 行，核心逻辑

Phase 4（整合）          GamePage 模式切换 + 存档兼容
                         ~ 100 行，胶水代码

Phase 5（GM 工具）       节点编辑器 + FOW + 时间线
                         ~ 300 行，DM 面板扩展

Phase 6（地形整合）      战术地图地形渲染（之前讨论）
                         ~ 500 行，视觉丰富度
```

---

## 6. 开放问题

1. **单地图 vs 多地图**：世界观模式下，每个节点是进入同一张战术地图的不同区域，还是进入完全不同的地图实例？（推荐：同一地图实例，通过位置偏移切换焦点）

2. **舰队拆分**：如果玩家舰队想分头行动（一队探索星云，一队维修），如何用当前单 token 模型表示？（推荐：每个玩家控制自己的 token 组，不同节点可分配不同 token）

3. **多 GM 支持**：STFCS 目前是单房主。世界观地图是否需要多个 GM？（推荐：不需要，单 GM 足矣）

4. **移动端适**：星图 UI 需要支持触控。节点点击比自由拖动更友好。（推荐：节点点击为主，拖动为辅）

5. **预设星图库**：是否需要内置几套星图供 GM 直接使用？（推荐：是，开箱即用很重要）
