# WebSocket 消息与指令体系优化分析

**日期**: 2026-04-18  
**架构**: JSON 原生化 v2

---

## 一、当前架构分析

### 1.1 消息分层

```
客户端                          服务端
┌─────────────────┐            ┌─────────────────┐
│  GameClient     │            │ MessageController│
│  (命令发送层)    │ ──WS────► │  (消息接收层)     │
├─────────────────┤            ├─────────────────┤
│  UI Components  │            │ CommandDispatcher│
│  (业务调用)     │            │  (业务分发)       │
└─────────────────┘            └────────┬────────┘
                                        │
                               ┌────────▼────────┐
                               │  Game Handlers  │
                               │  (业务逻辑)      │
                               └─────────────────┘
```

### 1.2 当前命令分类（28 个命令）

| 分类 | 命令数量 | 命令列表 |
|------|---------|---------|
| **核心战斗** | 9 | MOVE, TOGGLE_SHIELD, FIRE, VENT, CLEAR_OVERLOAD, SET_ARMOR, ADVANCE_MOVE_PHASE, GET_ALL_ATTACKABLE_TARGETS, ASSIGN_SHIP |
| **游戏流程** | 2 | NEXT_PHASE, CREATE_OBJECT |
| **玩家档案** | 6 | UPDATE_PROFILE, TOGGLE_READY, SAVE_VARIANT, LOAD_VARIANT, DELETE_VARIANT, GET_PROFILE, UPDATE_SETTINGS |
| **房间管理** | 5 | DISSOLVE, KICK_PLAYER, UPDATE_PROFILE, TRANSFER_OWNER, CREATE_OBJECT |
| **存档管理** | 4 | SAVE_GAME, LOAD_GAME, DELETE_SAVE, LIST_SAVES |
| **舰船自定义** | 6 | CUSTOMIZE_SHIP, ADD_WEAPON_MOUNT, REMOVE_WEAPON_MOUNT, UPDATE_WEAPON_MOUNT, SET_TEXTURE, CREATE_CUSTOM_WEAPON, UPDATE_CUSTOM_WEAPON |

---

## 二、发现的问题

### 2.1 命令粒度过细

**问题**: 多个命令可以合并为统一的 `UPDATE` 命令

```typescript
// 当前：分散的命令
CMD_VENT_FLUX        // 排散辐能
CMD_CLEAR_OVERLOAD   // 清除过载
CMD_SET_ARMOR        // 设置护甲
CMD_TOGGLE_SHIELD    // 切换护盾

// 优化后：统一的 ShipStateUpdate 命令
{
  type: "VENT_FLUX",
  shipId: "xxx",
  data: {}
}
```

### 2.2 权限检查重复

**问题**: 每个命令都重复检查 `OWNER` 权限

```typescript
// 当前：每个方法都检查
dispatchClearOverload() { this.assertDM(client); ... }
dispatchSetArmor() { this.assertDM(client); ... }
dispatchCreateObject() { this.assertDM(client); ... }

// 优化：在 MessageController 层统一拦截
room.onMessage("*", (client, payload) => {
  if (isOwnerCommand(payload.type) && !isOwner(client)) {
    throw Error("无权限");
  }
});
```

### 2.3 Payload 类型冗余

**问题**: 每个命令都有独立的 Payload 类型定义

```typescript
// 当前：28 个独立 Payload 类型
interface VentFluxPayload { shipId: string; }
interface ClearOverloadPayload { shipId: string; }
interface SetArmorPayload { shipId: string; quadrant: number; value: number; }

// 优化：统一的 CommandPayload 联合类型
type ShipCommand = 
  | { type: "VENT_FLUX"; shipId: string; }
  | { type: "CLEAR_OVERLOAD"; shipId: string; }
  | { type: "SET_ARMOR"; shipId: string; quadrant: number; value: number; };
```

### 2.4 响应格式不统一

**问题**: 成功/失败响应格式不一致

```typescript
// 有的返回 boolean
loadGame(): Promise<boolean>

// 有的返回 string
saveGame(): Promise<string>

// 有的直接广播事件
broadcast("game_saved", ...)

// 优化：统一的 Result 类型
type Result<T = void> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

---

## 三、JSON 化架构优化方案

### 3.1 核心设计理念

> **"JSON 即指令"** - 所有操作都是对 JSON 文档的 Patch

```typescript
// 传统 RPC 风格
CMD_SET_ARMOR({ shipId: "xxx", quadrant: 1, value: 100 })

// JSON Patch 风格
PATCH /ships/xxx/runtime/armor/quadrants/1
{ "op": "replace", "path": "/quadrants/1", "value": 100 }

// WebSocket 消息格式
{
  type: "JSON_PATCH",
  target: "ship:xxx",
  operations: [
    { op: "replace", path: "/runtime/armor/quadrants/1", value: 100 }
  ]
}
```

### 3.2 命令合并方案

#### 方案 A：按领域合并

```typescript
// 舰船操作合并为 SHIP_ACTION
type ShipAction = 
  | { action: "MOVE"; plan: MovementPlan }
  | { action: "FIRE"; weaponId: string; targetId: string }
  | { action: "TOGGLE_SHIELD"; active: boolean; orientation?: number }
  | { action: "VENT_FLUX" }
  | { action: "CLEAR_OVERLOAD" }  // 仅房主
  | { action: "SET_ARMOR"; quadrant: number; value: number };  // 仅房主

// 发送
room.send("SHIP_ACTION", {
  shipId: "xxx",
  action: { action: "VENT_FLUX" }
});
```

#### 方案 B：JSON Patch 风格

```typescript
// 统一更新命令
room.send("UPDATE_SHIP", {
  shipId: "xxx",
  patches: [
    { op: "replace", path: "/runtime/flux/soft", value: 0 },
    { op: "replace", path: "/runtime/flux/hard", value: 0 },
    { op: "replace", path: "/runtime/overloaded", value: false }
  ]
});
```

### 3.3 推荐优化方案

基于 JSON 化架构，建议采用 **混合模式**：

```typescript
// ==================== 高频战斗命令（保持独立，低延迟） ====================

CMD_FIGHT = {
  type: "FIGHT_ACTION",
  shipId: string,
  action: 
    | { type: "MOVE"; plan: MovementPlan }
    | { type: "FIRE"; weaponId: string; targetId: string }
    | { type: "TOGGLE_SHIELD"; active: boolean }
    | { type: "VENT_FLUX" }
}

// ==================== 低频管理命令（统一为 PATCH） ====================

CMD_MANAGE = {
  type: "MANAGE_PATCH",
  target: "ship" | "room" | "game",
  targetId: string,
  patches: JsonPatchOperation[]
}

// 示例：设置护甲
{
  type: "MANAGE_PATCH",
  target: "ship",
  targetId: "ship:xxx",
  patches: [
    { op: "replace", path: "/runtime/armor/quadrants/0", value: 100 }
  ]
}

// 示例：清除过载
{
  type: "MANAGE_PATCH",
  target: "ship",
  targetId: "ship:xxx",
  patches: [
    { op: "replace", path: "/runtime/overloaded", value: false },
    { op: "replace", path: "/runtime/flux/soft", value: 0 },
    { op: "replace", path: "/runtime/flux/hard", value: 0 }
  ]
}
```

---

## 四、具体优化清单

### 4.1 命令合并（28 → 12）

| 原命令 | 新命令 | 说明 |
|--------|--------|------|
| CMD_MOVE_TOKEN | CMD_FIGHT_ACTION | 合并移动相关 |
| CMD_ADVANCE_MOVE_PHASE | CMD_FIGHT_ACTION | ↑ |
| CMD_FIRE_WEAPON | CMD_FIGHT_ACTION | ↑ |
| CMD_TOGGLE_SHIELD | CMD_FIGHT_ACTION | ↑ |
| CMD_VENT_FLUX | CMD_FIGHT_ACTION | ↑ |
| CMD_CLEAR_OVERLOAD | CMD_MANAGE_PATCH | 合并管理操作 |
| CMD_SET_ARMOR | CMD_MANAGE_PATCH | ↑ |
| CMD_CUSTOMIZE_SHIP | CMD_MANAGE_PATCH | ↑ |
| CMD_ADD_WEAPON_MOUNT | CMD_MANAGE_PATCH | ↑ |
| CMD_REMOVE_WEAPON_MOUNT | CMD_MANAGE_PATCH | ↑ |
| CMD_UPDATE_WEAPON_MOUNT | CMD_MANAGE_PATCH | ↑ |
| CMD_CREATE_OBJECT | CMD_MANAGE_PATCH | ↑ |

### 4.2 权限检查优化

```typescript
// 中间件模式
const ownerCommands = new Set(["MANAGE_PATCH", "SAVE_GAME", "LOAD_GAME"]);

room.onMessage("*", (client, payload) => {
  if (ownerCommands.has(payload.type)) {
    const player = state.players.get(client.sessionId);
    if (player?.role !== "OWNER") {
      throw new Error("无权限");
    }
  }
});
```

### 4.3 Payload 类型简化

```typescript
// 统一的 Command 类型
interface FightAction {
  type: "FIGHT_ACTION";
  shipId: string;
  action: FightActionType;
}

interface ManagePatch {
  type: "MANAGE_PATCH";
  target: "ship" | "room" | "game";
  targetId: string;
  patches: { op: string; path: string; value: unknown }[];
}

type GameCommand = FightAction | ManagePatch;
```

### 4.4 响应标准化

```typescript
// 统一响应格式
interface CommandResponse<T = unknown> {
  requestId: string;  // 与请求 correlationId 对应
  timestamp: number;
  result: 
    | { success: true; data: T }
    | { success: false; error: { code: string; message: string } };
}

// 广播事件标准化
interface GameEvent<T = unknown> {
  type: string;
  timestamp: number;
  data: T;
}
```

---

## 五、JSON Schema 验证优化

### 5.1 当前问题

```typescript
// 每个命令独立的 validation 函数
parseMoveTokenPayload(payload)
parseFireWeaponPayload(payload)
parseToggleShieldPayload(payload)
// ... 20+ 个验证函数
```

### 5.2 JSON Schema 方案

```typescript
// 统一的 Schema 验证器
import { Validator } from 'json-schema';

const fightActionSchema = {
  type: "object",
  properties: {
    type: { const: "FIGHT_ACTION" },
    shipId: { type: "string", pattern: "^ship:.+" },
    action: {
      oneOf: [
        { type: "object", properties: { type: { const: "MOVE" }, ... } },
        { type: "object", properties: { type: { const: "FIRE" }, ... } }
      ]
    }
  }
};

// 统一验证
function validateCommand(cmd: unknown): asserts cmd is GameCommand {
  const result = validator.validate(cmd, commandSchema);
  if (!result.valid) throw new Error(result.errors.join(", "));
}
```

---

## 六、实施路线图

### Phase 1: 基础优化（1 周）

- [ ] 统一响应格式（Result 类型）
- [ ] 合并权限检查逻辑
- [ ] 简化 Payload 类型定义

### Phase 2: 命令合并（2 周）

- [ ] 实现 CMD_FIGHT_ACTION
- [ ] 实现 CMD_MANAGE_PATCH
- [ ] 迁移现有命令到新格式

### Phase 3: JSON Schema 验证（1 周）

- [ ] 定义完整的命令 Schema
- [ ] 实现统一验证中间件
- [ ] 生成 TypeScript 类型

### Phase 4: 性能优化（1 周）

- [ ] 实现命令批处理
- [ ] 增量状态同步（JSON Patch）
- [ ] 命令压缩（lz-string）

---

## 七、预期收益

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 命令数量 | 28 | 12 | -57% |
| Payload 类型 | 28+ | 5 | -82% |
| 验证函数 | 28+ | 2 | -93% |
| 权限检查点 | 15+ | 1 | -93% |
| 消息体积 | 100% | ~60% | -40% |

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 向后兼容 | 高 | 保留旧命令别名，逐步迁移 |
| 学习成本 | 中 | 提供迁移指南和示例代码 |
| 调试难度 | 中 | 实现命令日志和重放功能 |

---

## 九、总结

**核心建议**：

1. **短期**：统一响应格式和权限检查（1 周）
2. **中期**：合并战斗命令和管理命令（2 周）
3. **长期**：全面采用 JSON Patch 进行状态同步

**设计原则**：
- 高频操作（战斗）保持独立命令，低延迟
- 低频操作（管理）采用 JSON Patch，灵活可扩展
- 所有验证基于 JSON Schema，类型安全
