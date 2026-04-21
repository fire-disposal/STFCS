# 状态同步与接口统一设计（全WebSocket方案）

## 1. 简化身份体系

### 1.1 角色定义

```
┌─────────────────────────────────────────────────────────────────┐
│                     房间角色体系                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HOST (房主/DM)                         │   │
│  │                                                           │   │
│  │  - 创建房间即为房主                                        │   │
│  │  - 房主 = DM（主持人），控制敌方阵营                        │   │
│  │  - 拥有最高权限：全局修改、踢人、转移房主                   │   │
│  │  - 可放弃房主身份，转移给其他玩家                           │   │
│  │                                                           │   │
│  │  Faction 控制: ENEMY (敌方) + 全局管理                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PLAYER (玩家)                          │   │
│  │                                                           │   │
│  │  - 普通玩家，控制己方 Token                                │   │
│  │  - 只能操作 faction=PLAYER 且 ownerId=自己的 Token         │   │
│  │  - 可准备、可离开                                          │   │
│  │                                                           │   │
│  │  Faction 控制: PLAYER (己方)                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   OBSERVER (观察者)                        │   │
│  │                                                           │   │
│  │  - 仅观看，无操作权限                                       │   │
│  │  - 可被房主提升为 PLAYER                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  总结: HOST = DM（房主即主持人），PLAYER = 普通玩家              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 权限矩阵

| 操作 | HOST | PLAYER | OBSERVER |
|------|------|--------|----------|
| 创建房间 | ✓ | - | - |
| 加入房间 | ✓ | ✓ | ✓ |
| 离开房间 | ✓ | ✓ | ✓ |
| 准备/取消 | ✓ | ✓ | - |
| 开始游戏 | ✓ | - | - |
| **游戏内操作** ||||
| 控制己方Token | ✓ | ✓ | - |
| 控制敌方Token | ✓ | - | - |
| 动态生成Token | ✓ | - | - |
| 强制修改状态 | ✓ | - | - |
| 移除Token | ✓ | - | - |
| 跳过回合/强制结束 | ✓ | - | - |
| **房间管理** ||||
| 踢出玩家 | ✓ | - | - |
| 转移房主 | ✓ | - | - |
| 修改房间配置 | ✓ | - | - |

### 1.3 房主转移

```typescript
interface TransferHostRequest {
  requestId: string;
  payload: {
    newHostId: string;  // 新房主的 playerId
  };
}

// 转移后：
// - 原 HOST 变为 PLAYER
// - 新 HOST 获得全部 DM 权限
// - 房间 ownerId 更新
```

## 2. 全WebSocket接口设计

### 2.1 设计原则

1. **统一命名空间**: 所有操作通过 `{namespace}:{action}` 格式
2. **请求-响应模式**: 所有请求带 `requestId`，响应必须匹配
3. **增量同步**: 操作成功后广播 `sync:delta`
4. **事件广播**: 重要事件（战斗日志等）广播 `sync:event`
5. **权限验证**: 每个操作验证角色权限

### 2.2 完整事件列表

```typescript
// ==================== 基础协议 ====================

interface WsRequest<T = unknown> {
  requestId: string;  // UUID，必填
  payload: T;
}

interface WsResponse<T = unknown> {
  requestId: string;  // 匹配请求
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface WsBroadcast {
  type: string;
  timestamp: number;
  payload: unknown;
}

// ==================== auth namespace ====================

"auth:login"   → WsRequest<{ playerName: string }>
               → WsResponse<{ playerId; playerName; role; isHost: boolean }>
               
"auth:logout"  → WsRequest<{}>
               → WsResponse<{ success: boolean }>

// ==================== room namespace ====================

"room:create"       → WsRequest<{ name: string; maxPlayers?: number; map?: MapConfig }>
                    → WsResponse<{ roomId; room }>
                    → Broadcast: sync:full (创建者自动加入并成为HOST)

"room:list"         → WsRequest<{}>
                    → WsResponse<{ rooms: RoomInfo[] }>

"room:join"         → WsRequest<{ roomId: string }>
                    → WsResponse<{ room }>
                    → Broadcast: player:joined

"room:leave"        → WsRequest<{}>
                    → WsResponse<{ success }>
                    → Broadcast: player:left

"room:action"       → WsRequest<{ 
                        action: "ready" | "start" | "kick" | "transfer_host" | "change_role";
                        targetId?: string;  // kick/transfer_host/change_role 的目标
                        newRole?: "PLAYER" | "OBSERVER";  // change_role
                      }>
                    → WsResponse<{ success }>
                    → Broadcast: 相应事件

// ==================== token namespace (档案管理 - 全WS) ====================

"token:list"        → WsRequest<{}>
                    → WsResponse<{ tokens: TokenJSON[] }>  // 玩家档案中的Token

"token:get"         → WsRequest<{ tokenId: string }>
                    → WsResponse<{ token: TokenJSON }>

"token:create"      → WsRequest<{ token: TokenJSON }>
                    → WsResponse<{ token: TokenJSON }>  // 返回带$id的新Token

"token:update"      → WsRequest<{ tokenId: string; updates: Partial<TokenJSON> }>
                    → WsResponse<{ token: TokenJSON }>

"token:delete"      → WsRequest<{ tokenId: string }>
                    → WsResponse<{ success: boolean }>

"token:copy_preset" → WsRequest<{ presetId: string }>
                    → WsResponse<{ token: TokenJSON }>  // 复制预设到档案

"token:mount"       → WsRequest<{ tokenId: string; mountId: string; weaponId: string | null }>
                    → WsResponse<{ success }>  // null = 卸载

// ==================== weapon namespace (档案管理 - 全WS) ====================

"weapon:list"       → WsRequest<{}>
                    → WsResponse<{ weapons: WeaponJSON[] }>

"weapon:get"        → WsRequest<{ weaponId: string }>
                    → WsResponse<{ weapon: WeaponJSON }>

"weapon:create"     → WsRequest<{ weapon: WeaponJSON }>
                    → WsResponse<{ weapon: WeaponJSON }>

"weapon:update"     → WsRequest<{ weaponId: string; updates: Partial<WeaponJSON> }>
                    → WsResponse<{ weapon: WeaponJSON }>

"weapon:delete"     → WsRequest<{ weaponId: string }>
                    → WsResponse<{ success: boolean }>

"weapon:copy_preset" → WsRequest<{ presetId: string }>
                     → WsResponse<{ weapon: WeaponJSON }>

// ==================== save namespace (存档管理 - 全WS) ====================

"save:list"         → WsRequest<{}>
                    → WsResponse<{ saves: GameSave[] }>

"save:create"       → WsRequest<{ name: string; description?: string }>
                    → WsResponse<{ save: GameSave }>  // 保存当前房间状态

"save:load"         → WsRequest<{ saveId: string }>
                    → WsResponse<{ room: GameRoomState }>  // 加载存档到房间

"save:delete"       → WsRequest<{ saveId: string }>
                    → WsResponse<{ success }>

// ==================== asset namespace (资产管理 - 全WS) ====================

"asset:upload"      → WsRequest<{ type: "avatar" | "token_texture" | "weapon_texture"; 
                                   filename: string; mimeType: string; 
                                   data: ArrayBuffer | base64 string }>
                    → WsResponse<{ assetId: string; url: string }>

"asset:list"        → WsRequest<{ type?: string }>
                    → WsResponse<{ assets: AssetListItem[] }>

"asset:get"         → WsRequest<{ assetId: string }>
                    → WsResponse<{ asset: Asset }>

"asset:delete"      → WsRequest<{ assetId: string }>
                    → WsResponse<{ success }>

// ==================== preset namespace (预设数据 - 全WS) ====================

"preset:list_tokens"  → WsRequest<{ size?: string; class?: string }>
                      → WsResponse<{ presets: TokenJSON[] }>

"preset:list_weapons" → WsRequest<{ size?: string; damageType?: string }>
                      → WsResponse<{ presets: WeaponJSON[] }>

"preset:get_token"    → WsRequest<{ presetId: string }>
                      → WsResponse<{ token: TokenJSON }>

"preset:get_weapon"   → WsRequest<{ presetId: string }>
                      → WsResponse<{ weapon: WeaponJSON }>

// ==================== game namespace (游戏内操作) ====================

"game:action"       → WsRequest<{
                        action: "move" | "rotate" | "attack" | "shield" | "vent" | 
                                "end_turn" | "advance_phase";
                        tokenId: string;
                        // action 特定参数:
                        forward?: number;      // move
                        strafe?: number;       // move
                        angle?: number;        // rotate
                        allocations?: AttackAllocation[];  // attack
                        active?: boolean;      // shield
                      }>
                    → WsResponse<{ success; result?: ActionResult }>
                    → Broadcast: sync:delta

"game:query"        → WsRequest<{
                        type: "targets" | "movement" | "ownership" | "combat_state";
                        tokenId: string;
                      }>
                    → WsResponse<{ data: QueryResult }>

// ==================== dm namespace (房主特权) ====================

"dm:spawn"          → WsRequest<{ token: TokenJSON; faction: "PLAYER" | "ENEMY" | "NEUTRAL" }>
                    → WsResponse<{ tokenId }>
                    → Broadcast: sync:delta (token_add)

"dm:modify"         → WsRequest<{ tokenId: string; field: string; value: unknown }>
                    → WsResponse<{ success }>
                    → Broadcast: sync:delta

"dm:remove"         → WsRequest<{ tokenId: string }>
                    → WsResponse<{ success }>
                    → Broadcast: sync:delta (token_remove)

"dm:set_modifier"   → WsRequest<{ key: string; value: number; duration?: number }>
                    → WsResponse<{ success }>
                    → Broadcast: sync:delta

"dm:force_end_turn" → WsRequest<{ faction?: string }>
                    → WsResponse<{ success }>
                    → Broadcast: sync:delta (turn_change)

// ==================== sync namespace (状态同步) ====================

"sync:request_full" → WsRequest<{}>
                    → WsResponse<{ state: GameRoomState }>  // 用于重连

// 服务端主动广播:
"sync:full"         → Broadcast (加入房间时)
"sync:delta"        → Broadcast (操作后增量)
"sync:event"        → Broadcast (游戏事件: 战斗日志、特效等)
```

### 2.3 增量同步定义

```typescript
type DeltaType = 
  | "token_update"    // Token运行时字段更新
  | "token_add"       // 新增Token（dm:spawn）
  | "token_remove"    // 移除Token（dm:remove / 摧毁）
  | "token_destroyed" // Token被摧毁
  | "player_update"   // 玩家状态更新（ready/role）
  | "player_join"     // 玩家加入
  | "player_leave"    // 玩家离开
  | "host_change"     // 房主变更
  | "phase_change"    // 游戏阶段变化
  | "turn_change"     // 回合变化
  | "faction_turn"    // 当前行动阵营
  | "modifier_add"    // 全局修正添加
  | "modifier_remove" // 全局修正移除;

interface DeltaChange {
  type: DeltaType;
  id?: string;        // token/player ID
  field?: string;     // 更新的字段名（token_update）
  value?: unknown;    // 新值
  oldValue?: unknown; // 旧值（可选）
}

interface SyncDeltaBroadcast {
  timestamp: number;
  changes: DeltaChange[];
}

// 客户端应用示例
function applyDelta(state: GameRoomState, delta: SyncDeltaBroadcast): GameRoomState {
  for (const change of delta.changes) {
    switch (change.type) {
      case "token_update":
        if (change.id && change.field) {
          const token = state.tokens[change.id];
          if (token?.runtime) {
            token.runtime[change.field] = change.value;
          }
        }
        break;
      case "token_add":
        if (change.id && change.value) {
          state.tokens[change.id] = change.value as TokenJSON;
        }
        break;
      case "token_remove":
        if (change.id) delete state.tokens[change.id];
        break;
      case "player_join":
      case "player_update":
        if (change.id && change.value) {
          state.players[change.id] = change.value as RoomPlayerState;
        }
        break;
      case "player_leave":
        if (change.id) delete state.players[change.id];
        break;
      case "host_change":
        state.ownerId = change.value as string;
        break;
      case "phase_change":
        state.phase = change.value as GamePhase;
        break;
      case "turn_change":
        state.turnCount = change.value as number;
        break;
      case "faction_turn":
        state.activeFaction = change.value as Faction;
        break;
    }
  }
  return state;
}
```

### 2.4 游戏事件广播

```typescript
interface GameEventBroadcast {
  type: "attack_result" | "damage_log" | "token_destroyed" | 
        "flux_critical" | "overloaded" | "shield_break" | "turn_summary";
  timestamp: number;
  payload: {
    // attack_result
    attackerId?: string;
    targetId?: string;
    weaponId?: string;
    result?: DamageResult;
    log?: string;  // 彩色战斗日志公式
    
    // 其他事件类型各自字段
  };
}

// 战斗日志示例
// attack_result.payload.log:
// ========== 战斗日志 ==========
// [玩家A] 使用 主炮 (动能) 攻击 [敌方B]
// 基础伤害: 150.0
// [护盾阶段]
//   对护盾伤害 = 150.0 × shieldMultiplier(2.00) = 300.0
//   硬辐能 = 300.0 × 护盾效率(1.0) = 300.0
//   → 敌方B护盾吸收攻击，产生 300.0 硬辐能
```

## 3. 客户端状态管理

### 3.1 统一状态结构

```typescript
interface ClientState {
  // 连接状态
  connection: {
    status: "disconnected" | "connecting" | "connected" | "reconnecting";
    playerId: string | null;
    playerName: string | null;
    isHost: boolean;  // 是否为房主
  };
  
  // 房间状态（加入房间后）
  room: GameRoomState | null;
  
  // 档案状态（离线/在线都可访问）
  profile: {
    tokens: TokenJSON[];      // 玩家自定义Token
    weapons: WeaponJSON[];    // 玩家自定义武器
    saves: GameSave[];        // 存档列表
    assets: AssetListItem[];  // 资产列表
  };
  
  // 本地UI状态（不同步）
  ui: {
    selectedTokenId: string | null;
    camera: { x: number; y: number; zoom: number };
    showGrid: boolean;
    showWeaponArcs: boolean;
    // ...
  };
}
```

### 3.2 状态更新流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     客户端状态更新                               │
│                                                                  │
│  1. Socket 连接                                                 │
│     socket.on("auth:login", (res) => {                          │
│       state.connection = { status: "connected", ...res.data };  │
│     });                                                          │
│                                                                  │
│  2. 加入房间                                                     │
│     socket.emit("room:join", { requestId, roomId });            │
│     socket.on("sync:full", (state) => {                         │
│       state.room = state;                                        │
│     });                                                          │
│                                                                  │
│  3. 游戏操作                                                     │
│     socket.emit("game:action", { requestId, payload });          │
│     socket.on(WsResponse, (res) => {                             │
│       if (res.requestId === requestId) {                         │
│         // 处理响应                                              │
│       }                                                          │
│     });                                                          │
│     socket.on("sync:delta", (delta) => {                        │
│       state.room = applyDelta(state.room, delta);                │
│     });                                                          │
│                                                                  │
│  4. 档案操作                                                     │
│     socket.emit("token:list", { requestId });                    │
│     socket.on(WsResponse, (res) => {                             │
│       if (res.success) state.profile.tokens = res.data.tokens;  │
│     });                                                          │
│                                                                  │
│  5. 断线重连                                                     │
│     socket.on("reconnect", () => {                               │
│       socket.emit("sync:request_full", { requestId });           │
│       socket.on(WsResponse, (res) => {                           │
│         state.room = res.data.state;                             │
│       });                                                        │
│     });                                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 服务端处理流程

### 4.1 统一处理器结构

```typescript
// packages/server/src/server/socketio/unifiedHandler.ts

export function setupUnifiedHandler(io: IOServer, services: Services) {
  io.on("connection", (socket) => {
    
    // ==================== 认证 ====================
    socket.on("auth:login", async (req: WsRequest, callback) => {
      const result = await services.auth.login(req.payload.playerName);
      if (result.success) {
        socket.data.playerId = result.playerId;
        socket.data.playerName = result.playerName;
      }
      callback?.({ requestId: req.requestId, ...result });
    });

    // ==================== 房间 ====================
    socket.on("room:create", handleRoomCreate);
    socket.on("room:join", handleRoomJoin);
    socket.on("room:leave", handleRoomLeave);
    socket.on("room:action", handleRoomAction);

    // ==================== 档案 ====================
    socket.on("token:list", handleTokenList);
    socket.on("token:create", handleTokenCreate);
    socket.on("token:update", handleTokenUpdate);
    socket.on("token:delete", handleTokenDelete);
    socket.on("token:mount", handleTokenMount);
    
    socket.on("weapon:list", handleWeaponList);
    socket.on("weapon:create", handleWeaponCreate);
    // ...

    socket.on("save:list", handleSaveList);
    socket.on("save:create", handleSaveCreate);
    socket.on("save:load", handleSaveLoad);
    
    // ==================== 游戏 ====================
    socket.on("game:action", handleGameAction);
    socket.on("game:query", handleGameQuery);

    // ==================== DM特权 ====================
    socket.on("dm:spawn", handleDMSpawn);
    socket.on("dm:modify", handleDMModify);
    socket.on("dm:remove", handleDMRemove);
    socket.on("dm:force_end_turn", handleDMForceEndTurn);

    // ==================== 同步 ====================
    socket.on("sync:request_full", handleSyncRequestFull);

    // ==================== 断线重连 ====================
    socket.on("disconnect", () => {
      // 标记玩家离线，但保留房间状态
      // 房主离线时，房间暂停
    });
  });
}

// ==================== 权限检查 ====================

function checkPermission(socket: Socket, action: string): boolean {
  const room = getRoom(socket);
  const playerId = socket.data.playerId;
  const isHost = room?.ownerId === playerId;
  
  switch (action) {
    // 房主专属
    case "dm:spawn":
    case "dm:modify":
    case "dm:remove":
    case "dm:force_end_turn":
    case "room:kick":
    case "room:transfer_host":
      return isHost;
    
    // 玩家专属（非观察者）
    case "game:action":
    case "game:query":
      const player = room?.players[playerId];
      return player?.role !== "OBSERVER";
    
    // 所有人
    case "token:list":
    case "weapon:list":
    case "save:list":
    case "preset:list_tokens":
      return true;
    
    default:
      return false;
  }
}

function checkTokenOwnership(socket: Socket, tokenId: string): boolean {
  const room = getRoom(socket);
  const playerId = socket.data.playerId;
  const isHost = room?.ownerId === playerId;
  
  const token = room?.tokens[tokenId];
  if (!token) return false;
  
  // 房主可控制所有 Token
  if (isHost) return true;
  
  // 玩家只能控制己方且属于自己的 Token
  const runtime = token.runtime;
  return runtime?.faction === "PLAYER" && runtime?.ownerId === playerId;
}
```

## 5. 完整接口清单

### 全WebSocket事件（共35个）

| 命名空间 | 事件 | 权限 | 说明 |
|----------|------|------|------|
| **auth** | `auth:login` | ALL | 登录认证 |
| | `auth:logout` | ALL | 登出 |
| **room** | `room:create` | ALL | 创建房间(成为HOST) |
| | `room:list` | ALL | 房间列表 |
| | `room:join` | ALL | 加入房间 |
| | `room:leave` | ALL | 离开房间 |
| | `room:action` | HOST/PLAYER | ready/start/kick/transfer_host |
| **token** | `token:list` | ALL | 档案Token列表 |
| | `token:get` | ALL | Token详情 |
| | `token:create` | ALL | 创建Token |
| | `token:update` | ALL | 更新Token |
| | `token:delete` | ALL | 删除Token |
| | `token:copy_preset` | ALL | 复制预设 |
| | `token:mount` | ALL | 挂载武器 |
| **weapon** | `weapon:list` | ALL | 档案武器列表 |
| | `weapon:get` | ALL | 武器详情 |
| | `weapon:create` | ALL | 创建武器 |
| | `weapon:update` | ALL | 更新武器 |
| | `weapon:delete` | ALL | 删除武器 |
| | `weapon:copy_preset` | ALL | 复制预设 |
| **save** | `save:list` | ALL | 存档列表 |
| | `save:create` | HOST | 创建存档 |
| | `save:load` | HOST | 加载存档 |
| | `save:delete` | ALL | 删除存档 |
| **asset** | `asset:upload` | ALL | 上传资产 |
| | `asset:list` | ALL | 资产列表 |
| | `asset:get` | ALL | 资产详情 |
| | `asset:delete` | ALL | 删除资产 |
| **preset** | `preset:list_tokens` | ALL | 预设Token |
| | `preset:list_weapons` | ALL | 预设武器 |
| | `preset:get_token` | ALL | 预设详情 |
| | `preset:get_weapon` | ALL | 预设详情 |
| **game** | `game:action` | HOST/PLAYER | 游戏操作 |
| | `game:query` | HOST/PLAYER | 查询状态 |
| **dm** | `dm:spawn` | HOST | 生成Token |
| | `dm:modify` | HOST | 强制修改 |
| | `dm:remove` | HOST | 移除Token |
| | `dm:force_end_turn` | HOST | 强制结束回合 |
| **sync** | `sync:request_full` | ALL | 请求全量同步 |

### 服务端广播事件（3个）

| 事件 | 触发时机 | 内容 |
|------|----------|------|
| `sync:full` | 加入房间/重连 | 完整房间状态 |
| `sync:delta` | 每次操作成功后 | 增量变更 |
| `sync:event` | 游戏事件 | 战斗日志、特效等 |

## 6. 移除冗余代码

1. **移除 Broadcaster.ts** (480行) - Room.callbacks 已足够
2. **移除 REST API** - 全部改用 WebSocket
3. **移除 ActionSchemas.ts 的分散定义** - 统一到 `game:action` 一个入口

## 7. 实施步骤

1. 添加 `requestId` 机制到所有请求/响应
2. 统一事件命名到 `{namespace}:{action}` 格式
3. 实现 `sync:delta` 增量同步（覆盖所有 DeltaType）
4. 实现 `sync:event` 游戏事件广播（战斗日志）
5. 移除 `Broadcaster.ts`
6. 简化权限检查（HOST vs PLAYER）
7. 完善断线重连逻辑