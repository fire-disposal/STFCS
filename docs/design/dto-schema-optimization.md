# DTO 与 Schema 同步优化方案

**日期**: 2026-04-18  
**目标**: 简化数据传输，移除冗余层

---

## 一、当前问题分析

### 1.1 DTO 过度设计

**现状**:
```
schema/types.ts (DTO 类型定义)
  ↓
dto/eventDto.ts (转换函数)
  ↓
dto/roomDto.ts (转换函数)
  ↓
dto/profileDto.ts (转换函数)
  ↓
dto/saveDto.ts (转换函数)
  ↓
dto/healthDto.ts (转换函数)
```

**问题**:
- 6 个 DTO 文件，~20 个转换函数
- 大部分转换函数只是简单的对象构造
- DTO 类型与使用点分离，难以审查

**示例**:
```typescript
// dto/eventDto.ts - 简单对象构造
export const toGameSavedDto = (saveId: string, saveName: string): GameSavedDTO => ({
  saveId,
  saveName,
});

// 使用处
this.broadcast("game_saved", toGameSavedDto(saveId, name));

// 可直接简化为
this.broadcast("game_saved", { saveId, saveName });
```

### 1.2 Schema 同步与消息广播混用

**现状**:
```typescript
// Schema 自动同步（Colyseus）
@type({ map: ShipState }) ships = new MapSchema<ShipState>();

// 同时手动广播
broadcast("phase_change", { phase, turnCount })
broadcast("player_joined", { sessionId, shortId, name, role })
broadcast("game_saved", { saveId, saveName })
```

**问题**:
- 部分状态通过 Schema 同步，部分通过消息
- 客户端需要监听两种数据源
- 可能导致数据不一致

### 1.3 类型定义冗余

**现状**:
```typescript
// schema/types.ts - 170 行
export interface GameSavedDTO { saveId: string; saveName: string; }
export interface GameLoadedDTO { saveId: string; saveName: string; }
export interface PhaseChangeDTO { phase: string; turnCount: number; }
export interface RoomKickedDTO { reason: string; }
// ... 20+ 个 DTO 类型
```

**问题**:
- 简单类型也单独定义，增加维护成本
- 与 `@vt/data` 中的类型重复

---

## 二、优化方案

### 2.1 DTO 层简化（6 文件 → 1 文件）

**方案**: 移除独立的 DTO 转换函数，直接在广播处构造对象

```typescript
// 优化前
// dto/eventDto.ts
export const toPhaseChangeDto = (phase: GamePhaseValue, turnCount: number): PhaseChangeDTO => ({
  phase, turnCount
});

// phaseHandler.ts
import { toPhaseChangeDto } from "../../dto/index.js";
broadcast("phase_change", toPhaseChangeDto(state.currentPhase, state.turnCount));

// 优化后
// phaseHandler.ts - 直接构造
broadcast("phase_change", {
  phase: state.currentPhase,
  turnCount: state.turnCount
});
```

**保留的 DTO 类型**（仅复杂类型）:
```typescript
// types.ts - 简化到 ~50 行
export interface RoomMetadata {
  roomType: string;
  name: string;
  phase: string;
  ownerId: string | null;
  ownerShortId: number | null;
  maxPlayers: number;
  isPrivate: boolean;
  createdAt: number;
  turnCount?: number;
}

export interface RoomListItemDTO {
  roomId: string;
  name: string;
  clients: number;
  maxClients: number;
  roomType: string;
  metadata: RoomMetadata;
}

export interface SaveMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
}
```

### 2.2 消息分类优化

**分类原则**:

| 消息类型 | 传输方式 | 示例 |
|----------|----------|------|
| **状态变更** | Schema 自动同步 | 舰船位置、护盾状态、武器冷却 |
| **事件通知** | 手动广播 | 玩家加入、阶段变更、游戏保存 |
| **查询响应** | 直接响应 | 可攻击目标列表、存档列表 |

**优化后的广播消息**:

```typescript
// 保留的广播消息（事件通知）
"player_joined"      // 玩家加入
"player_left"        // 玩家离开
"owner_left"         // 房主离开
"room_dissolved"     // 房间解散
"phase_change"       // 阶段变更
"game_saved"         // 游戏保存
"game_loaded"        // 游戏加载
"PLAYER_AVATAR"      // 头像更新
"PLAYER_AVATARS"     // 批量头像（新玩家加入时）

// 移除的广播（改为 Schema 同步）
// - 舰船状态变更（Schema 已同步）
// - 武器状态变更（Schema 已同步）
// - 玩家准备状态（Schema 已同步）
```

### 2.3 Schema 同步精简

**当前 Schema 同步的字段**:
```typescript
// GameRoomState
@type("string") currentPhase
@type("number") turnCount
@type({ map: PlayerState }) players
@type({ map: ShipState }) ships
@type("string") activeFaction
@type("number") mapWidth
@type("number") mapHeight
@type("string") creatorSessionId
@type(FireControlCacheSchema) fireControlCache
```

**优化建议**:

1. **移除 `mapWidth`/`mapHeight`**: 固定值或从配置读取
2. **移除 `fireControlCache`**: 火控数据可实时计算，无需缓存
3. **精简 `PlayerState`**: 移除冗余字段

```typescript
// 优化后的 PlayerState
export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("number") shortId: number = 0;
  @type("string") role: PlayerRoleValue = PlayerRole.PLAYER;
  @type("string") name: string = "";
  @type("string") nickname: string = "";
  @type("boolean") isReady: boolean = false;
  @type("boolean") connected: boolean = true;
  @type("number") pingMs: number = -1;
  @type("number") jitterMs: number = 0;
  @type("string") connectionQuality: ConnectionQualityValue = ConnectionQuality.OFFLINE;
  // avatar 通过消息同步，不走 Schema
}
```

---

## 三、实施路线图

### Phase 1: DTO 简化（1 天）

- [ ] 删除 `dto/eventDto.ts` 转换函数
- [ ] 删除 `dto/roomDto.ts` 转换函数
- [ ] 删除 `dto/profileDto.ts` 转换函数
- [ ] 删除 `dto/saveDto.ts` 转换函数
- [ ] 删除 `dto/healthDto.ts` 转换函数
- [ ] 简化 `schema/types.ts` 仅保留复杂类型
- [ ] 更新所有广播调用点

### Phase 2: Schema 精简（1 天）

- [ ] 移除 `GameRoomState.mapWidth`/`mapHeight`
- [ ] 移除 `FireControlCacheSchema`
- [ ] 精简 `PlayerState` 字段
- [ ] 更新客户端同步逻辑

### Phase 3: 消息清理（1 天）

- [ ] 审查所有 `broadcast()` 调用
- [ ] 移除冗余状态广播
- [ ] 统一事件命名规范
- [ ] 编写消息协议文档

---

## 四、预期收益

| 指标 | 优化前 | 优化后 | 减少 |
|------|--------|--------|------|
| DTO 文件 | 6 个 | 0 个 | -100% |
| DTO 转换函数 | ~20 个 | 0 个 | -100% |
| schema/types.ts | 170 行 | ~50 行 | -70% |
| 广播消息类型 | 15+ | 8 | -47% |
| Schema 字段 | ~30 | ~20 | -33% |

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 客户端兼容性 | 高 | 分阶段迁移，保留旧消息别名 |
| Schema 变更导致不同步 | 高 | 充分测试，版本控制 |
| 调试困难 | 中 | 添加消息日志中间件 |
