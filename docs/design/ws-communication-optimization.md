# WebSocket 通信与同步优化分析

**日期**: 2026-04-18  
**范围**: 后端通信架构

---

## 一、当前架构分析

### 1.1 消息分层

```
┌─────────────────────────────────────────────────────────┐
│                    BattleRoom                           │
│  (Colyseus Room - 连接管理、生命周期、定时更新)          │
├─────────────────────────────────────────────────────────┤
│              registerMessageController                  │
│  (消息路由 - 28 个命令分发到 6 个注册函数)                  │
├─────────────────────────────────────────────────────────┤
│               CommandDispatcher                         │
│  (权限检查 + 业务逻辑调用)                                │
├─────────────────────────────────────────────────────────┤
│                  Game Handlers                          │
│  (纯函数业务逻辑：moveHandler, fireHandler, etc.)        │
└─────────────────────────────────────────────────────────┘
```

### 1.2 当前命令分类（28 个）

| 分类 | 命令数 | 示例 |
|------|--------|------|
| **核心战斗** | 9 | MOVE, FIRE, TOGGLE_SHIELD, VENT_FLUX |
| **游戏流程** | 2 | NEXT_PHASE, CREATE_OBJECT |
| **玩家档案** | 6 | UPDATE_PROFILE, TOGGLE_READY, SAVE_VARIANT |
| **房间管理** | 5 | KICK_PLAYER, DISSOLVE, SAVE_GAME |
| **舰船自定义** | 6 | CUSTOMIZE_SHIP, ADD_WEAPON_MOUNT |

### 1.3 广播消息类型

| 事件 | 触发时机 | 数据量 |
|------|----------|--------|
| `player_joined` | 玩家加入 | 小 (~100B) |
| `player_left` | 玩家离开 | 小 |
| `owner_rejoined` | 房主重连 | 小 |
| `owner_left` | 房主离开 | 小 |
| `room_dissolved` | 房间解散 | 小 |
| `game_saved` | 游戏保存 | 小 |
| `game_loaded` | 游戏加载 | 小 |
| `PLAYER_AVATAR` | 头像同步 | 中 (~1KB) |

---

## 二、发现的问题

### 2.1 消息粒度过细

**问题**: 每个操作都有独立命令，导致：
- 消息类型过多（28+ 种）
- 每个命令需要独立的 payload 解析和验证
- 客户端需要维护 28+ 个发送方法

```typescript
// 当前：分散的命令
room.onMessage(CMD_MOVE_TOKEN, ...)
room.onMessage(CMD_TOGGLE_SHIELD, ...)
room.onMessage(CMD_VENT_FLUX, ...)
room.onMessage(CMD_CLEAR_OVERLOAD, ...)

// 优化：统一的 ACTION 命令
room.onMessage("ACTION", (client, payload) => {
  switch (payload.actionType) {
    case "MOVE": handleMove(...)
    case "TOGGLE_SHIELD": handleToggleShield(...)
    case "VENT_FLUX": handleVentFlux(...)
  }
})
```

### 2.2 广播消息未压缩

**问题**: 
- `PLAYER_AVATAR` 每次发送完整 Base64 数据
- 房间列表、玩家列表重复发送完整数据
- 无增量更新机制

### 2.3 权限检查重复

**问题**: 每个命令都检查房主权限

```typescript
// 当前：每个 handler 都检查
dispatchCreateObject() { this.assertOwner(client); ... }
dispatchSetArmor() { this.assertOwner(client); ... }
dispatchCustomizeShip() { this.assertOwner(client); ... }

// 优化：在消息路由层统一拦截
```

### 2.4 状态同步冗余

**问题**:
- Schema 自动同步 + 手动广播混用
- 部分状态通过 Schema 同步，部分通过消息发送
- 客户端需要监听两种数据源

---

## 三、优化方案

### 3.1 命令合并（28 → 8）

| 新命令 | 合并原命令 | 说明 |
|--------|-----------|------|
| `GAME_ACTION` | MOVE, FIRE, TOGGLE_SHIELD, VENT_FLUX, ADVANCE_MOVE_PHASE | 核心战斗行动 |
| `MANAGE_ACTION` | CREATE_OBJECT, SET_ARMOR, CLEAR_OVERLOAD, CUSTOMIZE_SHIP, ADD/REMOVE/UPDATE_WEAPON_MOUNT | 房主管理操作 |
| `PLAYER_ACTION` | TOGGLE_READY, ASSIGN_SHIP | 玩家操作 |
| `QUERY_ACTION` | GET_ALL_ATTACKABLE_TARGETS | 查询类 |
| `PROFILE_ACTION` | UPDATE_PROFILE, SAVE/LOAD/DELETE_VARIANT | 档案相关 |
| `ROOM_ACTION` | KICK_PLAYER, DISSOLVE, SAVE_GAME, LOAD_GAME | 房间管理 |
| `NET_PING` | (保留) | 网络质量监测 |
| `NET_PONG` | (保留) | 服务器响应 |

### 3.2 统一 Payload 格式

```typescript
// 新格式
interface GameMessage {
  actionType: string;
  payload: unknown;
  correlationId?: string;  // 请求 - 响应关联
  timestamp?: number;      // 客户端时间戳
}

// 示例：移动
{
  actionType: "MOVE",
  payload: {
    shipId: "ship:xxx",
    plan: { forward: 100, strafe: 0, turn: 45 }
  },
  correlationId: "move_123"
}

// 示例：开火
{
  actionType: "FIRE",
  payload: {
    attackerId: "ship:xxx",
    weaponId: "w1",
    targetId: "ship:yyy"
  }
}
```

### 3.3 权限检查中间件

```typescript
// 命令权限映射
const ACTION_PERMISSIONS: Record<string, "OWNER" | "PLAYER"> = {
  // 玩家可执行
  MOVE: "PLAYER",
  FIRE: "PLAYER",
  TOGGLE_SHIELD: "PLAYER",
  VENT_FLUX: "PLAYER",
  TOGGLE_READY: "PLAYER",
  
  // 仅房主
  CREATE_OBJECT: "OWNER",
  SET_ARMOR: "OWNER",
  CLEAR_OVERLOAD: "OWNER",
  CUSTOMIZE_SHIP: "OWNER",
  KICK_PLAYER: "OWNER",
  DISSOLVE: "OWNER",
  SAVE_GAME: "OWNER",
  LOAD_GAME: "OWNER",
};

// 统一拦截
function checkPermission(client: Client, actionType: string): void {
  const required = ACTION_PERMISSIONS[actionType];
  const player = state.players.get(client.sessionId);
  
  if (!player) throw new Error("未注册");
  if (required === "OWNER" && player.role !== "OWNER") {
    throw new Error("无权限");
  }
}
```

### 3.4 广播消息优化

#### 3.4.1 增量更新

```typescript
// 当前：发送完整数据
broadcast("player_joined", {
  sessionId: "xxx",
  shortId: 1,
  name: "Player",
  role: "PLAYER",
  avatar: "data:image/..."
})

// 优化：仅发送变更
broadcast("player_update", {
  sessionId: "xxx",
  changes: {
    joined: true,  // 或 left: true
    fields: { name: "Player" }  // avatar 不在此发送
  }
})
```

#### 3.4.2 头像延迟加载

```typescript
// 当前：加入时立即广播给所有人
broadcast("PLAYER_AVATAR", { shortId: 1, avatar: "..." })

// 优化：按需请求
// 1. 加入时仅通知 shortId
broadcast("player_joined", { shortId: 1 })

// 2. 客户端需要时再请求
client.send("REQUEST_AVATAR", { shortId: 1 })
server.send("AVATAR_RESPONSE", { shortId: 1, avatar: "..." })
```

### 3.5 Schema 同步优化

#### 当前问题

```typescript
// Schema 自动同步（Colyseus 特性）
@type({ map: ShipState }) ships = new MapSchema<ShipState>();

// 同时手动广播
broadcast("ship_created", { shipId: "xxx", ... })
```

**问题**: 客户端收到两份数据，可能不同步。

#### 优化方案

```typescript
// 方案 A：仅使用 Schema 同步（推荐）
// - 状态变更通过 Schema 自动同步
// - 广播仅用于事件通知（不含状态数据）

broadcast("ship_created", { shipId: "xxx" })  // 仅通知 ID
// ShipState 自动同步到客户端

// 方案 B：仅使用消息同步
// - 禁用 Schema 同步
// - 所有状态通过消息发送
```

---

## 四、实施路线图

### Phase 1: 命令合并（1 周）

- [ ] 定义统一的 `GameMessage` 类型
- [ ] 合并战斗命令为 `GAME_ACTION`
- [ ] 合并管理命令为 `MANAGE_ACTION`
- [ ] 更新客户端发送层

### Phase 2: 权限中间件（2 天）

- [ ] 创建 `ACTION_PERMISSIONS` 映射
- [ ] 实现统一权限检查
- [ ] 移除各 handler 中的重复检查

### Phase 3: 广播优化（3 天）

- [ ] 实现增量更新格式
- [ ] 头像延迟加载
- [ ] 事件去重机制

### Phase 4: Schema 同步清理（2 天）

- [ ] 审查所有 `broadcast()` 调用
- [ ] 移除冗余状态数据
- [ ] 统一为事件通知

---

## 五、预期收益

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 命令类型 | 28 | 8 | -71% |
| Payload 验证函数 | 28+ | 8 | -71% |
| 权限检查点 | 15+ | 1 | -93% |
| 广播消息体积 | 100% | ~40% | -60% |
| 头像带宽 | 100% | ~10% | -90% |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 客户端兼容性 | 高 | 保留旧命令别名，分阶段迁移 |
| 调试难度 | 中 | 实现消息日志和追踪 |
| 性能回归 | 低 | 压测验证 |

---

## 七、立即执行项

### 7.1 移除冗余广播

当前 `BattleRoom.ts` 中的广播可优化：

```typescript
// 可移除（Schema 已同步）
- broadcast("player_joined", {...}) → 仅保留事件通知
- broadcast("PLAYER_AVATAR", {...}) → 改为按需请求
```

### 7.2 简化 MessageController

将 6 个注册函数合并为 1 个统一路由器：

```typescript
// 当前
registerActionHandlers(...)
registerQueryHandlers(...)
registerProfileHandlers(...)
registerManagementHandlers(...)
registerUtilityHandlers(...)
registerCustomizationHandlers(...)

// 优化
registerGameActions(...)  // 统一处理
```

### 7.3 清理未使用的导入

`BattleRoom.ts` 导入了未使用的模块：
- `MAX_CLIENTS_LIMIT` - 未使用
- `MIN_CLIENTS` - 未使用
- `SIMULATION_INTERVAL_MS` - 硬编码值
