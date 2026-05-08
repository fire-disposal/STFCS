# Faction 实体化 + Phase 三阶段重构

## 概述

将派系从硬编码枚举重构为全局实体，将回合流程从"派系轮转循环"改为"固定三阶段+动态先攻"，并统一 Asset 和 Save 体验。

## 一、Faction 实体化

### 1.1 Schema 定义

```typescript
// GameSchemas.ts
FactionDefSchema = z.object({
    $id: z.string(),              // "preset:faction:player-alliance"
    name: z.string(),             // 显示名称
    color: z.string(),            // hex 主题色 "#4a9eff"
    flagAssetId: z.string().optional(),  // 方形旗帜素材 ID（可选）
});
```

- 旗帜标准化为方形，渲染层直接使用，无需偏移/缩放参数
- color 用于舰船标记、UI 高亮等

### 1.2 内置预设

存放于 `packages/data/src/presets/factions/`，受 `validatePresets` 验证：

| 文件 | $id | name | color |
|------|-----|------|-------|
| `player-alliance.json` | `preset:faction:player-alliance` | 玩家联盟 | `#4a9eff` |
| `fate-grip.json` | `preset:faction:fate-grip` | 命运之握 | `#ff4a4a` |

### 1.3 Asset 体系扩展

```typescript
// AssetType 新增
AssetTypeSchema = z.enum(["ship_texture", "weapon_texture", "faction_flag"]);
```

存储目录：
```
storage/assets/faction_flag/
```

- faction_flag 上传/加载时标准化为统一方形尺寸
- 全局可用，非玩家私有

### 1.4 自定义 Faction

DM 在 room 内创建的自定义 faction 存储在 `GameRoomState.factions` 中，随 save 持久化。不污染全局预设。

---

## 二、Phase 三阶段

### 2.1 Phase 定义

```typescript
GamePhaseSchema = z.enum(["DEPLOYMENT", "FACTION_ACTION", "SETTLEMENT"]);
```

| Phase | activeFaction | 说明 |
|-------|---------------|------|
| `DEPLOYMENT` | `undefined` | 部署舰船 |
| `FACTION_ACTION` | faction $id | 当前派系操控舰船 |
| `SETTLEMENT` | `undefined` | 自动结算（辐能/冷却/过载） |

### 2.2 单轮流程

```
DEPLOYMENT
  │ DM [开始游戏]，进入 initiativeOrder[0]
  ▼
FACTION_ACTION (faction A)     ← 该派系内玩家/DM 操控舰船
  │ DM [推进]
  ▼
FACTION_ACTION (faction B)     ← initiativeOrder 中下一个派系
  │ DM [结算回合]
  ▼
SETTLEMENT (自动)
  ├  辐能消散 / 过载恢复 / 武器冷却 / 移动重置 / 护盾维持
  ├  BattleLog: "Round N 结束"
  └  自动进入下一轮 → FACTION_ACTION (initiativeOrder[0])
```

- DM 每轮操作：k 次 [推进] + 1 次 [结算]（k = initiativeOrder 长度）
- SETTLEMENT 进入即执行结算逻辑，完成后自动进入下一轮（无延迟，无确认）

### 2.3 Phase ↔ activeFaction 映射

| Phase | activeFaction |
|-------|---------------|
| `DEPLOYMENT` | `undefined` |
| `FACTION_ACTION` | 当前 initiativeOrder 指针指向的 faction $id |
| `SETTLEMENT` | `undefined` |

---

## 三、动态先攻

### 3.1 Room 状态新增字段

```typescript
GameRoomState:
    factions: Record<string, FactionDef>     // 本局参与的派系
    initiativeOrder: string[]                // faction $id 排序列表
    initiativeIndex: number                  // 当前轮中指向哪个 faction
    phase: "DEPLOYMENT" | "FACTION_ACTION" | "SETTLEMENT"
    activeFaction: string | undefined
```

### 3.2 DM 操作

- DM 在配置面板中拖拽调整 `initiativeOrder`
- DM 可增删 `factions`
- `initiativeOrder` 调整仅在轮间生效（SETTLEMENT 阶段），当前轮内不改
- 自定义 faction 的 flag 可选，无 flag 时以 color 纯色方块替代

### 3.3 DM 身份

Room 加入时 DM 选择：
- **归属某派系** — 该派系行动时 DM 正常受规则约束。DM 仍可通过 `edit:token` 在任何阶段修改任何 token
- **全局 DM** — 不隶属任何派系，所有阶段均可执行 game:action，不受 faction 检查

---

## 四、删除与变更清单

### 删除

| 项目 | 原因 |
|------|------|
| `FactionSchema` 枚举 + `Faction` 值对象 + `Faction` 类型（旧） | 替换为 FactionDef 实体 |
| `FactionColors` 映射常量 | faction.color 取代 |
| `FactionLabels` 映射常量 | faction.name 取代 |
| `TURN_ORDER` 数组 | 替换为 initiativeOrder |
| `getFactionForPhase()` 中的取模计算 | 替换为 initiativeIndex 直读 |
| `isLastFaction` 判断逻辑 | 替换为 initiativeIndex === len-1 |
| `calculateTurnAdvance` 中的循环逻辑 | 简化为固定顺序推进 |

### 变更

| 文件 | 变更 |
|------|------|
| `GameSchemas.ts` | 新增 FactionDefSchema；修改 GamePhaseSchema；修改 GameRoomStateSchema |
| `ErrorCodes.ts` | 无需变更（已有的 ERROR 和 INVALID_PHASE 够用） |
| `TurnFlowController.ts` | `calculateTurnAdvance` 简化；SETTLEMENT 自动转场逻辑 |
| `MutativeStateManager.ts` | `startGame` 适配；`changePhase` 适配；新增 `advanceToNextPhase` |
| `game.ts` | 阶段检查改为新 phase 值；派系检查改为 faction $id |
| `edit.ts` | `force_end_turn` 简化为"推进至下一阶段"；可删除或重命名 |
| `room.ts` | `room:action start` 使用新启动逻辑 |
| `Room.ts` | 删除死代码 `startGame`/`advancePhase` |
| `TurnBar.tsx` | 显示 ROUND N + 当前阶段/派系 |
| `DMControlSidebarPanel.tsx` | 两按钮：[推进] / [结算]；initiative 排序面板 |
| `TopBar.tsx` | 派系选择器改为从 `gameState.factions` 读取 |
| `WsSchemas.ts` | 新增 faction CRUD 事件定义 |
| `presets/index.ts` | 导出 faction 预设 |
| `presets/factions/` | 新建目录 + 2 个预设 JSON |
| `validatePresets.ts` | 新增 faction 预设验证 |
| `ErrorCodes.ts` | 添加 NOT_YOUR_TURN（已有）、ATTACK_INVALID（已有） |

### 向后兼容

- 旧存档（含 `Faction` 枚举值的）加载时需要迁移到新 FactionDef 格式
- `FactionSchema` 旧枚举暂不删除，用作迁移映射（"PLAYER_ALLIANCE" → "preset:faction:player-alliance"）

---

## 五、实现阶段

| 序号 | 提交 | 范围 |
|------|------|------|
| 1 | 新增 FactionDefSchema + 内置预设 + AssetType 扩展 | data |
| 2 | Phase 枚举改为三阶段 + GameRoomState 新增字段 | data |
| 3 | TurnFlowController + MutativeStateManager 适配新 phase | server |
| 4 | game/edit/room handler 适配 | server |
| 5 | 删除旧 dead code + 清理 | server |
| 6 | preset 验证扩展 | data |
| 7 | DM 控制面板 + TurnBar/TopBar 适配 | client |
| 8 | 存档迁移逻辑 | server |
| 9 | faction flag 上传/加载 | server + client |
