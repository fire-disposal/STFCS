# STFCS 架构分析与接口设计

## 1. 数据结构层次分析

### 1.1 核心数据结构层次

```
┌─────────────────────────────────────────────────────────────────┐
│                    PlayerProfile (玩家档案)                      │
│  - 与房间解耦，持久化存储                                         │
│  - tokens: TokenJSON[] (自定义舰船/空间站)                        │
│  - weapons: WeaponJSON[] (自定义武器)                             │
│  - saveIds: string[] (存档引用)                                   │
│  - stats: 游戏统计                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TokenJSON (舰船/空间站定义)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TokenSpec (规格 - 非运行时，静态定义)                      │  │
│  │  - size/class: 舰船类型                                    │  │
│  │  - maxHitPoints/armorMaxPerQuadrant: 固有属性              │  │
│  │  - fluxCapacity/fluxDissipation: 辐能参数                  │  │
│  │  - maxSpeed/maxTurnRate: 机动参数                          │  │
│  │  - mounts: 挂载点定义 (武器槽位)                            │  │
│  │  - shield: 护盾规格                                        │  │
│  │  - texture: 贴图配置                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TokenRuntime (运行时 - 游戏中动态变化)                      │  │
│  │  - position/heading: 当前位置和朝向                         │  │
│  │  - hull: 当前结构值                                        │  │
│  │  - armor[6]: 六象限护甲当前值                               │  │
│  │  - fluxSoft/fluxHard: 软/硬辐能                            │  │
│  │  - overloaded/overloadTime: 过载状态                        │  │
│  │  - destroyed: 是否摧毁                                     │  │
│  │  - movement: 移动阶段状态                                  │  │
│  │  - hasFired: 本回合是否开火                                │  │
│  │  - weapons: 武器运行时状态                                 │  │
│  │  - modifiers: 当前激活的修正                               │  │
│  │  - faction/ownerId: 所属阵营和玩家                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Metadata (元数据 - 半静态)                                 │  │
│  │  - name/description: 名称和描述                            │  │
│  │  - author/createdAt/updatedAt: 作者和时间                   │  │
│  │  - tags: 标签                                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GameRoomState (房间运行时状态)                  │
│  - roomId/ownerId: 房间标识                                      │
│  - phase/turnCount: 游戏阶段和回合                               │
│  - activeFaction: 当前行动阵营                                   │
│  - players: Record<sessionId, RoomPlayerState>                   │
│  - tokens: Record<tokenId, TokenJSON> (房间内的Token实例)        │
│  - map: GameMap (地图配置)                                       │
│  - globalModifiers: 全局修正                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 运行时/非运行时划分合理性分析

| 字段类别 | 存储位置 | 变化频率 | 设计合理性 |
|---------|---------|---------|-----------|
| **TokenSpec (规格)** | TokenJSON.ship | 创建时设定，极少变化 | ✓ 合理 - 定义舰船固有属性 |
| **TokenRuntime** | TokenJSON.runtime | 每回合变化 | ✓ 合理 - 游戏过程中的动态状态 |
| **Metadata** | TokenJSON.metadata | 编辑时变化 | ✓ 合理 - 半静态的描述信息 |
| **WeaponSpec** | WeaponJSON.weapon | 创建时设定 | ✓ 合理 - 武器固有属性 |
| **WeaponRuntime** | WeaponRuntime | 每回合变化 | ✓ 合理 - 冷却、状态等 |

**问题识别：**

1. **TokenSpec 中的 mounts[].weapon**: 当前设计为可选的 WeaponJSON 或 string引用
   - 问题：武器挂载应该是运行时配置，不应混入规格
   - 建议：分离为 `mounts: MountSpec[]` (规格定义槽位) + `runtime.weaponAssignments` (运行时挂载配置)

2. **faction/ownerId 在 runtime**: 
   - 问题：归属关系应该是稳定的，不应在运行时
   - 建议：移至 Metadata 或新增 `ownership` 字段

3. **movement 状态**:
   - 问题：每回合重置，与 hull/flux 持久性不同
   - 建议：可保留在 runtime，但需区分"回合内状态"和"持久状态"

## 2. 多玩家+DM联机流程设计

### 2.1 角色划分

```
┌─────────────────────────────────────────────────────────────────┐
│                          Room                                    │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   OWNER     │  │   PLAYER    │  │  OBSERVER   │              │
│  │  (主持人)   │  │  (玩家)     │  │  (观察者)   │              │
│  │             │  │             │  │             │              │
│  │ - 房间管理  │  │ - 控制己方  │  │ - 仅观看   │              │
│  │ - DM操作   │  │ - Token     │  │ - 无操作   │              │
│  │ - 全局权限  │  │ - 准备/行动 │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Faction: PLAYER ─────────────── Faction: ENEMY                 │
│  (玩家阵营)                      (敌方阵营 - DM控制)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 游戏流程

```
┌──────────────────────────────────────────────────────────────────┐
│                        游戏回合流程                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Phase: DEPLOYMENT (部署阶段)                                ││
│  │  - OWNER 创建房间，邀请玩家                                  ││
│  │  - 玩家加入，选择阵营                                        ││
│  │  - OWNER/DM 部署敌方 Token                                   ││
│  │  - 玩家部署己方 Token (从档案中选择)                         ││
│  │  - 所有玩家 READY → 开始游戏                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Phase: PLAYER_ACTION (玩家行动阶段)                         ││
│  │  For each player in PLAYER faction:                         ││
│  │    - 移动 (A→B→C阶段)                                       ││
│  │    - 开火 (武器攻击)                                        ││
│  │    - 护盾开关                                               ││
│  │    - 主动排散                                               ││
│  │    - 结束回合                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Phase: DM_ACTION (DM行动阶段)                               ││
│  │  - DM控制 ENEMY faction Token                               ││
│  │  - 同样的移动/攻击/护盾操作                                  ││
│  │  - 可动态调整敌方状态                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Phase: TURN_END (回合结束)                                  ││
│  │  - 辐能自然消散                                             ││
│  │  - 过载结束检查                                             ││
│  │  - 武器冷却更新                                             ││
│  │  - 移动状态重置                                             ││
│  │  -Modifiers 持续回合递减                                    ││
│  │  - 进入下一回合                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│                    (循环或游戏结束)                               │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 实时同步机制

```
┌─────────────────────────────────────────────────────────────────┐
│                    实时同步架构                                  │
│                                                                  │
│  Client                    Server                    Clients     │
│    │                         │                          │       │
│    │──── game:move ─────────▶│                          │       │
│    │                         │── broadcast ────────────▶│       │
│    │                         │    MOVE_EXECUTED         │       │
│    │                         │                          │       │
│    │──── game:attack ───────▶│                          │       │
│    │                         │── process damage ───────▶│       │
│    │                         │── broadcast ────────────▶│       │
│    │                         │    ATTACK_RESULT         │       │
│    │                         │    (含战斗日志公式)       │       │
│    │                         │                          │       │
│    │─── game:modify_token ──▶│                          │       │
│    │    (DM专属)             │── validate permission ──▶│       │
│    │                         │── update token ─────────▶│       │
│    │                         │── broadcast ────────────▶│       │
│    │                         │    TOKEN_UPDATED         │       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 动态实时修改机制

### 3.1 修改权限分级

| 权限级别 | 角色 | 可修改内容 |
|---------|------|-----------|
| **OWNER** | 房间创建者 | 房间配置、全局参数、强制修改任意Token |
| **DM** | 主持人 | ENEMY阵营Token、动态添加/移除Token、全局Modifiers |
| **PLAYER** | 玩家 | 己方Token的运行时状态(移动/开火/护盾) |
| **OBSERVER** | 观察者 | 无修改权限 |

### 3.2 修改类型分类

```typescript
// 修改操作类型
type ModificationType = 
  // 运行时操作 (游戏Action)
  | "MOVE"          // 移动指令
  | "ROTATE"        // 旋转指令  
  | "ATTACK"        // 开火指令
  | "TOGGLE_SHIELD" // 护盾开关
  | "VENT_FLUX"     // 主动排散
  | "ADVANCE_PHASE" // 推进移动阶段
  
  // DM特权操作
  | "SPAWN_TOKEN"   // 动态生成Token
  | "REMOVE_TOKEN"  // 移除Token
  | "MODIFY_RUNTIME"// 强制修改运行时(hull/flux/armor等)
  | "SET_MODIFIER"  // 设置全局Modifiers
  
  // Owner特权操作  
  | "TRANSFER_OWNERSHIP" // 转移Token所有权
  | "KICK_PLAYER"       // 移除玩家
  | "CHANGE_PHASE"      // 强制切换阶段
```

### 3.3 数据修改验证流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    修改请求处理流程                              │
│                                                                  │
│  1. 接收修改请求                                                 │
│     ├── Socket event: game:modify_token                         │
│     └── Payload: { tokenId, field, value, reason }              │
│                                                                  │
│  2. 权限验证                                                     │
│     ├── 检查玩家角色 (OWNER/DM/PLAYER)                           │
│     ├── 检查目标Token所有权                                       │
│     └── 检查游戏阶段是否允许该操作                                │
│                                                                  │
│  3. Schema验证                                                   │
│     ├── 使用Zod Schema验证新值类型                               │
│     └── 检查值范围约束 (如 hull >= 0)                            │
│                                                                  │
│  4. 业务规则验证                                                 │
│     ├── 检查操作是否合法 (如过载时不能移动)                       │
│     └── 检查资源约束 (如移动力是否足够)                           │
│                                                                  │
│  5. 执行修改                                                     │
│     ├── 更新 TokenJSON.runtime                                   │
│     ├── 记录修改日志                                             │
│     └── 广播 TOKEN_UPDATED 事件                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 接口体系设计

### 4.1 接口分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    接口分层设计                                  │
│                                                                  │
│  Layer 1: Transport (传输层)                                    │
│  ├── Socket.IO (实时游戏操作)                                   │
│  └── REST API (资源管理、档案操作)                              │
│                                                                  │
│  Layer 2: Handler (处理层)                                      │
│  ├── ActionHandler (游戏Action处理)                             │
│  ├── RoomHandler (房间操作处理)                                  │
│  ├── ProfileHandler (档案操作处理)                               │
│  └── AssetHandler (资产操作处理)                                 │
│                                                                  │
│  Layer 3: Service (服务层)                                      │
│  ├── PlayerProfileService (玩家档案)                            │
│  ├── RoomService (房间管理)                                      │
│  ├── TokenService (舰船管理)                                    │
│  ├── WeaponService (武器管理)                                    │
│  ├── AssetService (资产管理)                                    │
│                                                                  │
│  Layer 4: Engine (引擎层)                                       │
│  ├── GameStateManager (状态管理)                                 │
│  ├── RuleEngine (规则计算)                                       │
│  │   ├── damage.ts (伤害计算)                                   │
│  │   ├── movement.ts (移动计算)                                 │
│  │   ├── targeting.ts (目标获取)                                │
│  │   ├── flux.ts (辐能计算)                                     │
│  │   └── weapon.ts (武器规则)                                   │
│                                                                  │
│  Layer 5: Persistence (持久层)                                  │
│  ├── MemoryRepository (内存存储)                                │
│  ├── MongoRepository (数据库存储)                               │
│  ├── FileRepository (文件存储)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Socket.IO 事件定义

```typescript
// ==================== 房间操作 ====================
interface RoomEvents {
  // 创建/加入/离开
  "room:create": { roomName: string; maxPlayers?: number; isPrivate?: boolean };
  "room:join": { roomId: string; password?: string };
  "room:leave": {};
  "room:list": {}; // 获取房间列表
  
  // 房间管理 (Owner专属)
  "room:invite": { targetPlayerId: string }; // 邀请玩家
  "room:kick": { playerId: string }; // 移除玩家
  "room:transfer_owner": { newOwnerId: string }; // 转移主持人
  "room:set_config": { maxPlayers?: number; mapSize?: { width: number; height: number } };
  
  // 游戏流程
  "room:start_game": {};
  "room:toggle_ready": {};
}

// ==================== 游戏操作 ====================
interface GameEvents {
  // 移动
  "game:move": { tokenId: string; forwardDistance?: number; strafeDistance?: number };
  "game:rotate": { tokenId: string; angle: number };
  "game:advance_phase": { tokenId: string };
  
  // 战斗
  "game:attack": AttackActionPayload;
  "game:get_targets": { tokenId: string }; // 获取可行目标
  
  // 系统
  "game:toggle_shield": { tokenId: string; active: boolean };
  "game:vent_flux": { tokenId: string };
  "game:end_turn": {};
  
  // DM特权
  "game:spawn_token": { tokenJson: TokenJSON; faction: Faction };
  "game:remove_token": { tokenId: string };
  "game:modify_token": { tokenId: string; field: string; value: any };
  "game:set_global_modifier": { key: string; value: number };
}

// ==================== 档案操作 ====================
interface ProfileEvents {
  // 玩家信息
  "profile:get": {};
  "profile:update": { nickname?: string; avatar?: string };
  
  // Token管理
  "profile:list_tokens": {};
  "profile:get_token": { tokenId: string };
  "profile:create_token": { tokenJson: TokenJSON };
  "profile:update_token": { tokenId: string; updates: Partial<TokenJSON> };
  "profile:delete_token": { tokenId: string };
  "profile:copy_preset_token": { presetId: string };
  
  // 武器管理  
  "profile:list_weapons": {};
  "profile:get_weapon": { weaponId: string };
  "profile:create_weapon": { weaponJson: WeaponJSON };
  "profile:update_weapon": { weaponId: string; updates: Partial<WeaponJSON> };
  "profile:delete_weapon": { weaponId: string };
  
  // 武器挂载
  "profile:mount_weapon": { tokenId: string; mountId: string; weaponId: string };
  "profile:unmount_weapon": { tokenId: string; mountId: string };
  
  // 存档
  "profile:list_saves": {};
  "profile:create_save": { name: string; tokens: TokenJSON[] };
  "profile:load_save": { saveId: string };
  "profile:delete_save": { saveId: string };
  
  // 资产
  "profile:upload_avatar": { file: File };
  "profile:upload_texture": { type: "ship" | "weapon"; file: File };
}

// ==================== 服务端响应 ====================
interface ServerEvents {
  // 成功响应
  "room:created": { roomId: string; roomInfo: RoomInfo };
  "room:joined": { roomId: string; roomInfo: RoomInfo; gameState: GameRoomState };
  "room:updated": { roomInfo: RoomInfo };
  "game:action_success": { actionType: string; result: any };
  "profile:updated": { profile: PlayerProfile };
  
  // 广播事件
  "player_joined": { playerId: string; playerName: string };
  "player_left": { playerId: string };
  "token_spawned": { tokenId: string; tokenJson: TokenJSON };
  "token_removed": { tokenId: string };
  "token_updated": { tokenId: string; changes: Partial<TokenRuntime> };
  "phase_changed": { phase: GamePhase; turnCount: number };
  "faction_turn": { faction: Faction };
  "attack_result": { attackerId: string; targetId: string; result: DamageResult; log: string };
  
  // 错误
  "error": { code: string; message: string; requestId?: string };
}
```

### 4.3 REST API 定义

```yaml
# ==================== 玩家档案 API ====================
GET    /api/profile                    # 获取当前玩家档案
PUT    /api/profile                    # 更新玩家档案
POST   /api/profile/avatar             # 上传头像

# ==================== Token (舰船) API ====================
GET    /api/tokens                     # 获取玩家Token列表
POST   /api/tokens                     # 创建新Token
GET    /api/tokens/:id                 # 获取Token详情
PUT    /api/tokens/:id                 # 更新Token规格
DELETE /api/tokens/:id                 # 删除Token
POST   /api/tokens/:id/copy            # 复制Token

# ==================== 武器 API ====================
GET    /api/weapons                    # 获取玩家武器列表  
POST   /api/weapons                    # 创建新武器
GET    /api/weapons/:id                # 获取武器详情
PUT    /api/weapons/:id                # 更新武器规格
DELETE /api/weapons/:id                # 删除武器

# ==================== 挂载 API ====================
PUT    /api/tokens/:id/mounts/:mountId # 挂载武器到指定槽位
DELETE /api/tokens/:id/mounts/:mountId # 移除挂载

# ==================== 存档 API ====================
GET    /api/saves                      # 获取存档列表
POST   /api/saves                      # 创建存档
GET    /api/saves/:id                  # 获取存档详情
DELETE /api/saves/:id                  # 删除存档

# ==================== 预设 API ====================
GET    /api/presets/tokens             # 获取预设Token列表
GET    /api/presets/weapons            # 获取预设武器列表
GET    /api/presets/all                # 获取所有预设

# ==================== 资产 API ====================
GET    /api/assets                     # 获取资产列表
POST   /api/assets                     # 上传资产
GET    /api/assets/:id                 # 获取资产详情
DELETE /api/assets/:id                 # 删除资产
GET    /api/assets/:id/data            # 获取资产数据(图片等)

# ==================== 房间 API (HTTP备用) ====================
GET    /api/rooms                      # 获取公开房间列表
GET    /api/rooms/:id                  # 获取房间信息
POST   /api/rooms                      # 创建房间(HTTP方式)
```

## 5. 具体功能设计

### 5.1 火控目标查询

```typescript
// 请求
interface GetTargetsRequest {
  tokenId: string;
}

// 响应  
interface GetTargetsResponse {
  tokenId: string;
  weapons: {
    mountId: string;
    weaponName: string;
    validTargets: {
      targetId: string;
      targetName: string;
      distance: number;
      inRange: boolean;
      inArc: boolean;
      hitAngle: number;
      targetQuadrant: number; // 命中哪个护甲象限
    }[];
    uiStatus: "FIRED" | "UNAVAILABLE" | "READY" | "READY_WITH_TARGETS";
  }[];
}

// 后端处理流程
function calculateTargets(combatToken: CombatToken, allTokens: Token[]): GetTargetsResponse {
  // 1. 检查Token是否可开火 (非过载、非摧毁)
  // 2. 遍历每个挂载点武器
  // 3. 对每个潜在目标计算:
  //    - 距离是否在 minRange ~ maxRange 范围内
  //    - 目标是否在射界内 (考虑 mount.arc, mount.facing)
  //    - 计算命中角度和护甲象限
  // 4. 返回可行目标列表
}
```

### 5.2 移动资源查询

```typescript
interface MovementStatusResponse {
  tokenId: string;
  canMove: boolean;
  reason?: string; // 不能移动的原因
  currentPhase: MovementPhase;
  budget: {
    maxSpeed: number;
    maxTurnRate: number;
    forwardMultiplier: number; // 来自配置
    backwardMultiplier: number;
    strafeMultiplier: number;
    turnMultiplier: number;
  };
  used: {
    phaseAUsed: number;
    turnAngleUsed: number;
    phaseCUsed: number;
  };
  available: {
    phaseAAvailable: number;
    phaseCAvailable: number;
    turnAngleAvailable: number;
  };
  phaseALock: TranslationLock | null;
  phaseCLock: TranslationLock | null;
}
```

### 5.3 Token所有权管理

```typescript
// 查询所有权
interface OwnershipQueryResponse {
  tokenId: string;
  ownerId: string | null;
  faction: Faction;
  canControl: boolean; // 当前玩家是否可控制
}

// 转移所有权 (Owner/DM特权)
interface TransferOwnershipRequest {
  tokenId: string;
  newOwnerId: string;
}

// 验证逻辑
function validateOwnership(playerId: string, token: Token, action: string): boolean {
  // 1. OWNER角色: 全部权限
  // 2. DM角色: ENEMY阵营Token权限
  // 3. PLAYER角色: ownerId === playerId 且 faction === PLAYER
  // 4. OBSERVER角色: 无权限
}
```

### 5.4 Token自定义系统

```typescript
// Token规格修改 (离线编辑)
interface CustomizeTokenRequest {
  tokenId: string;
  specUpdates: Partial<TokenSpec>;
  metadataUpdates?: Partial<Metadata>;
}

// 验证规则
function validateTokenSpecUpdate(spec: TokenSpec): ValidationResult {
  // 1. hullSize/class: 必须是有效枚举值
  // 2. maxHitPoints: > 0
  // 3. armorMaxPerQuadrant: >= 0
  // 4. mounts[].arc: 0-360
  // 5. shield.arc: 0-360
  // 6. 不能修改运行时状态
}

// 武器挂载修改
interface MountWeaponRequest {
  tokenId: string;
  mountId: string;
  weaponId: string | null; // null表示卸载
}

// 挂载验证
function validateWeaponMount(mount: MountSpec, weapon: WeaponSpec): ValidationResult {
  // 1. 武器size必须兼容 mount.size (使用 SIZE_COMPATIBILITY)
  // 2. 同一武器不能挂载到多个槽位
  // 3. 挂载后更新 TokenJSON.spec.mounts[].weapon
}
```

### 5.5 玩家头像更新

```typescript
// Socket方式
socket.emit("profile:update", { avatar: avatarAssetId });

// REST方式
POST /api/profile/avatar
Content-Type: multipart/form-data
Body: { file: <binary> }

// 响应
{
  success: true,
  avatarAssetId: "avatar:player_xxx_123",
  avatarUrl: "/api/assets/avatar:player_xxx_123/data"
}

// 存储逻辑
async function uploadAvatar(userId: string, buffer: Buffer, filename: string, mimeType: string) {
  // 1. 验证文件类型 (image/png, image/jpeg, image/gif)
  // 2. 验证文件大小 (max 2MB)
  // 3. 生成唯一 assetId
  // 4. 存储到 AssetService
  // 5. 更新 PlayerProfile.avatarAssetId
  // 6. 返回 assetId 和访问URL
}
```

### 5.6 房间邀请系统

```typescript
// 邀请玩家
interface InvitePlayerRequest {
  roomId: string;
  targetPlayerId: string; // 或 targetPlayerName
  role?: PlayerRole; // 指定角色 (PLAYER/OBSERVER)
}

// 邀请响应
interface InviteResponse {
  success: boolean;
  inviteId: string; // 邀请码
  inviteUrl: string; // 可分享的邀请链接
  expiresAt: number; // 邀请过期时间
}

// 接受邀请
interface AcceptInviteRequest {
  inviteId: string;
}

// 流程
// 1. Owner 发出邀请 → 生成 inviteId
// 2. 目标玩家收到通知 (若在线) 或通过邀请链接加入
// 3. 目标玩家 accept → 加入房间
// 4. 广播 PLAYER_JOINED 事件

// 邀请码存储 (可使用 MemoryRepository)
interface RoomInvite {
  id: string;
  roomId: string;
  inviterId: string;
  targetPlayerId?: string; // 特定玩家邀请
  role: PlayerRole;
  createdAt: number;
  expiresAt: number;
}
```

## 6. 扩充方法建议

### 6.1 Schema扩展

```typescript
// 新增房间邀请Schema
export const RoomInviteSchema = z.object({
  $schema: z.literal("invite-v1"),
  $id: z.string(),
  roomId: z.string(),
  inviterId: z.string(),
  targetPlayerId: z.string().optional(),
  role: PlayerRoleSchema,
  createdAt: z.number(),
  expiresAt: z.number(),
  maxUses: z.number().default(1),
  usedCount: z.number().default(0),
});
```

### 6.2 新增Service层

```typescript
// InviteService
class InviteService {
  async createInvite(roomId: string, inviterId: string, options: InviteOptions): Promise<RoomInvite>;
  async getInvite(inviteId: string): Promise<RoomInvite | null>;
  async acceptInvite(inviteId: string, playerId: string): Promise<{ success: boolean; roomId: string }>;
  async revokeInvite(inviteId: string): Promise<boolean>;
  async listRoomInvites(roomId: string): Promise<RoomInvite[]>;
}

// TokenOwnershipService
class TokenOwnershipService {
  async getTokenOwner(tokenId: string): Promise<{ ownerId: string; faction: Faction }>;
  async transferOwnership(tokenId: string, newOwnerId: string): Promise<boolean>;
  async validateControl(playerId: string, tokenId: string): Promise<boolean>;
}
```

### 6.3 新增Handler层

```typescript
// InviteHandler (Socket)
socket.on("room:create_invite", async (data, callback) => {
  const invite = await inviteService.createInvite(...);
  callback({ success: true, invite });
});

socket.on("room:accept_invite", async (data, callback) => {
  const result = await inviteService.acceptInvite(...);
  if (result.success) {
    await room.joinRoom(socket.data.playerId, result.roomId);
  }
  callback(result);
});
```

## 7. 设计问题总结

### 7.1 当前问题

1. **TokenJSON.spec.mounts[].weapon 混入运行时配置**: 建议分离
2. **faction/ownerId 在 runtime**: 建议移至更稳定的位置
3. **缺少房间邀请系统**: 需新增 InviteSchema 和 InviteService
4. **缺少所有权查询/转移接口**: 需新增相关API
5. **缺少完整的REST API定义**: Socket.IO 覆盖实时操作，但资源管理需REST补充
6. **缺少离线编辑验证**: Token规格修改应有完整验证流程

### 7.2 建议改进方向

1. **分离规格和运行时**: 确保 spec 完全静态，runtime 完全动态
2. **完善权限体系**: 明确 OWNER/DM/PLAYER/OBSERVER 各角色权限边界
3. **统一接口命名**: Socket.IO 和 REST API 使用一致的命名规范
4. **增加审计日志**: 所有修改操作应有日志记录
5. **增加操作回滚**: 支持撤销最近的操作 (如移动撤销)
6. **增加批量操作**: 支持批量修改Token属性