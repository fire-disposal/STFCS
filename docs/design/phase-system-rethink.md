# 阶段/回合/GM 系统重设计

> 问题：DM 系统、派系系统、回合系统三者纠缠不清。
> 根源：战术战斗的"回合制派系轮流"与世界探索的"GM 驱动叙事"
> 被硬塞进同一个 `GamePhase` + `activeFaction` 状态机。

---

## 1. 核心矛盾

当前状态机：

```
DEPLOYMENT ──→ PLAYER_ACTION (turn 1, faction A)
                   │
                   ├── (faction B) PLAYER_ACTION (turn 1, faction B)
                   │
                   └── PLAYER_ACTION (turn 2, faction A) ...
```

问题：**"GM 驱动"和"派系轮流"是两种不同的执行模式，不应共享同一个状态机。** 当前 `force_end_turn` 既是"推进回合"又是"切换派系"又是"阶段变更"，职责不清。

---

## 2. 重设计：双层状态机

### 上层：游戏模式 (GameMode)

描述"当前在干什么"，由 GM 控制切换。

```typescript
// ── 模式枚举 ──
export const GameModeSchema = z.enum([
  "DEPLOYMENT", // 部署舰船，准备开始
  "WORLD_EXPLORATION", // 星图航行，GM 驱动叙事
  "TACTICAL_COMBAT", // 战术战斗，派系轮流
]);
```

### 下层：战术回合 (TurnState)

仅在 `TACTICAL_COMBAT` 模式下有效，与上层解耦。

```typescript
// ── 战术战斗回合状态 ──
export const TurnStateSchema = z.object({
  turnCount: z.number().default(0),
  activeFactionIndex: z.number().default(0), // TURN_ORDER 中的当前索引
});
```

### 对比

| 方面                         | 当前（纠缠）                 | 重设计（分离）                          |
| ---------------------------- | ---------------------------- | --------------------------------------- |
| 阶段变量                     | `phase: GamePhase`           | `mode: GameMode` + `turn?: TurnState`   |
| 派系切换                     | `phase + activeFaction` 联动 | `turn.activeFactionIndex` 独立          |
| GM 操作                      | `force_end_turn` 身兼数职    | `setMode()` 单独 + `advanceTurn()` 单独 |
| WORLD_EXPLORATION 时 faction | 无意义，但必须定义           | `turn = undefined`，干净                |
| 存档兼容                     | 需要迁移 phase               | `mode + turn` 可映射回旧 phase          |

---

## 3. 状态转换图

```
DEPLOYMENT
  │
  ├── (world 模式启用) ──→ WORLD_EXPLORATION
  │                            │
  │                            ├── world:travel（GM 操作）
  │                            ├── world:explore（GM 揭示）
  │                            ├── world:enter_combat ──→ TACTICAL_COMBAT
  │                            └── (GM 结束游戏) ──→ 关闭房间
  │
  └── (传统模式, 无 world) ──→ TACTICAL_COMBAT


TACTICAL_COMBAT
  │
  ├── turn.turnCount = 1, turn.activeFactionIndex = 0
  ├── 玩家行动（move/attack/shield/vent）
  ├── advanceTurn(): activeFactionIndex++
  │   ├── 超出 TURN_ORDER 长度 → turnCount++, activeFactionIndex = 0
  │   └── 触发回合结算（辐能/冷却/护盾维持）
  │
  ├── (world 模式启用)
  │   └── 所有派系完成 → return_to_world ──→ WORLD_EXPLORATION
  │
  └── (传统模式)
      └── 无限循环，直到 GM 手动结束游戏
```

---

## 4. GameRoomState 变更

```typescript
GameRoomState {
  // ── 上层：游戏模式 ──
  mode: GameMode,                // 取代 phase
  turn: TurnState | undefined,   // 仅在 TACTICAL_COMBAT 时有值

  // ── 现有字段保持不变 ──
  players: {...},
  tokens: {...},
  map: GameMap | undefined,      // 战术地图
  world: WorldMap | undefined,   // 世界观地图

  // ── 简化：删除以下字段 ──
  // phase: GamePhase,            → 由 mode 替代
  // turnCount: number,           → 由 turn.turnCount 替代
  // activeFaction: Faction,      → 由 turn.activeFactionIndex 推导
}
```

### 派系推导逻辑

```typescript
function getActiveFaction(state: GameRoomState): Faction | undefined {
  if (state.mode !== "TACTICAL_COMBAT") return undefined;
  if (!state.turn) return undefined;
  return TURN_ORDER[state.turn.activeFactionIndex];
}
```

不再需要 `phase ↔ activeFaction` 联动。`activeFaction` 从 `turn` 字段纯函数推导。

---

## 5. GM 操作界面

| GM 操作                     | 效果                                                            |
| --------------------------- | --------------------------------------------------------------- |
| `edit:room.set_mode`        | 切换 `mode`（DEPLOYMENT / WORLD_EXPLORATION / TACTICAL_COMBAT） |
| `edit:room.advance_turn`    | TACTICAL_COMBAT 下推进到下一派系/回合                           |
| `edit:room.set_turn_number` | 直接设置回合数（GM 调）                                         |
| `world:travel`              | WORLD_EXPLORATION 下航行                                        |
| `world:enter_combat`        | WORLD_EXPLORATION → TACTICAL_COMBAT（含地形生成）               |
| `world:return`              | TACTICAL_COMBAT → WORLD_EXPLORATION（战斗结束返回）             |
| `world:manage`              | 编辑星图                                                        |

---

## 6. 迁移策略

**向后兼容**：在 MutativeStateManager 中保留 `phase` 字段的 getter/setter，映射到新的 `mode`：

```typescript
// 读
get phase(): GamePhase {
  if (this.state.mode === "TACTICAL_COMBAT") return "PLAYER_ACTION";
  if (this.state.mode === "WORLD_EXPLORATION") return "WORLD_EXPLORATION";
  return "DEPLOYMENT";
}

// 写（deprecated，逐步迁移）
changePhase(phase: GamePhase) {
  if (phase === "PLAYER_ACTION") this.state.mode = "TACTICAL_COMBAT";
  else this.state.mode = phase;
}
```

**这样做的好处**：

- 现有代码渐进迁移，不需一次性重写
- 新代码直接使用 `mode` + `turn`
- 旧存档读取时自动映射

---

## 7. 为什么更好

| 场景                             | 当前（纠缠）                                                    | 重设计（分离）                                |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| WORLD_EXPLORATION 时检查 faction | `phase=WORLD_EXPLORATION, activeFaction=undefined` 可理解但奇怪 | `mode=WORLD_EXPLORATION, turn=undefined` 清晰 |
| GM 切换模式                      | `changePhase()` 同时改 faction，需要加条件分支                  | `setMode()` 只改模式，turn 自动创建/销毁      |
| 多派系扩展                       | faction 枚举在 schema 级别硬编码                                | `TURN_ORDER` 数组可动态扩展                   |
| 世界观模式开关                   | world 字段与 phase 无关联                                       | mode 自然区分世界观/传统                      |
| 战斗外查看星图                   | phase 不允许 game:action                                        | mode 为 NON_COMBAT 时直接拒绝 game 操作       |
| 核心理念                         | "游戏是一个巨大的状态机"                                        | "游戏是两层独立的状态机"                      |
