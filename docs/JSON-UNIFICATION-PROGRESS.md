# Schema 重构进度报告

**分支**: `feature/json-unification`
**日期**: 2026-04-22
**核心理念**: "类型分层，内嵌完整，无版本管理"

---

## 一、架构变更

### Token 类型分层

```
InventoryToken (玩家存档，无 runtime)
    └── CombatToken (房间实例，有 runtime)
```

| 场景 | 类型 | 特点 |
|------|------|------|
| 玩家库存 | InventoryToken | 无 runtime，与房间无关 |
| 房间联机 | CombatToken | 有 runtime，实时状态 |
| 房间存档 | CombatToken[] | 保存完整战斗状态 |

### 核心变更

1. **移除 `$schema` 字段** - 不考虑多版本管理
2. **护盾简化** - 无 `type`/`direction`，用 `arc` 表示覆盖范围
3. **预设内嵌** - 武器完整内嵌于 mounts，无字符串引用
4. **删除别名** - 直接使用 `CombatToken`、`InventoryToken`、`TokenRuntime`

---

## 二、已完成任务

### Phase 1: Schema 重构 ✅

| 文件 | 变更 |
|------|------|
| GameSchemas.ts | InventoryTokenSchema、CombatTokenSchema 分层定义 |
| WsSchemas.ts | edit:token、BattleLogEdit 事件定义 |
| presets/ships/*.json | 更新为新格式，内嵌完整武器 |
| presets/weapons/*.json | 移除 $schema，使用 spec 字段 |

### Phase 2: Server 重构 ✅

| 文件 | 变更 |
|------|------|
| Token.ts | isCombatToken 改用 runtime 存在判断 |
| GameStateManager.ts | 使用 CombatToken/InventoryToken |
| shield.ts | 用 arc >= 360 表示全向护盾 |
| damage.ts | 护盾方向基于舰船 heading |
| PlayerProfileService.ts | 创建存档时生成 CombatToken |
| handlers.ts | save:create/load 使用 $id |

### Phase 3: 移除废弃代码 ✅

| 删除项 | 说明 |
|------|------|
| TokenJSON 别名 | 改用 CombatToken |
| ShipRuntime 别名 | 改用 TokenRuntime |
| ShipState 类型 | 改用 CombatToken |
| $schema 字段 | 所有 schema 移除 |

---

## 三、类型检查状态

| 包 | 状态 | 错误数 |
|------|------|------|
| data | ✅ 通过 | 0 |
| server | ✅ 通过 | 0 |
| client | 🔴 待修复 | ~30 |

### Client 待修复项

- `TokenJSON` → `CombatToken` 或 `InventoryToken`
- `ShipRuntime` → `TokenRuntime`
- `shipJson`/`weaponJson` → `data`
- `TokenJSONSchema` → `CombatTokenSchema`
- LoadoutCustomizerDialog `.weapon` 属性访问

---

## 四、文件变更统计

```
74 files changed
1675 insertions(+)
6138 deletions(-)
```

### 新增文件

- `packages/server/src/core/state/MutativeStateManager.ts`
- `packages/server/src/server/socketio/handlers.ts`
- `packages/server/src/server/socketio/RpcServer.ts`
- `packages/client/src/network/hooks.ts`

### 删除文件

- 旧 WebSocket 模块 (`core/`, `services/`)
- 旧 handlers (`actionHandler.ts`, `joinHandler.ts`, `unifiedHandler.ts`)
- 旧 sync 模块

---

## 五、下一步行动

1. **修复 Client 类型错误** (~30 个)
2. **构建验证** `pnpm turbo build`
3. **测试验证** `pnpm turbo test`