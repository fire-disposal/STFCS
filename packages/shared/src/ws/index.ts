/**
 * WebSocket 消息协议定义（简化版）
 *
 * 保留核心 WS 通信基础设施：
 * 1. 消息类型常量
 * 2. 请求 - 响应消息 schema 和类型
 * 3. 接口定义 (IWSServer, IWSClient)
 * 4. 类型守卫函数
 *
 * 事件消息 schema 已迁移到 protocol/DomainEvents.ts
 */

import { z } from 'zod';
// @ts-ignore - 类型在 WSMessage 联合类型中使用
import type {
  PlayerInfo,
  ShipStatus,
  ShipMovement,
  PlayerCamera,
  TokenInfo,
  MapConfig,
  ArmorQuadrant,
  MapSnapshot,
} from '../types/index.js';
// @ts-ignore - 类型在 schema 中使用
import type {
  PlayerInfoSchema,
  ShipMovementSchema,
  ShipStatusSchema,
  MapConfigSchema,
  TokenInfoSchema,
  PlayerCameraSchema,
  ArmorQuadrantSchema,
  PointSchema,
} from '../core-types.js';
import { FactionIdSchema } from '../core-types.js';

// ==================== 消息类型常量 ====================
export const WS_MESSAGE_TYPES = {
  // 事件消息（广播）
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  SHIP_MOVED: 'SHIP_MOVED',
  SHIP_STATUS_UPDATE: 'SHIP_STATUS_UPDATE',
  EXPLOSION: 'EXPLOSION',
  SHIELD_UPDATE: 'SHIELD_UPDATE',
  FLUX_STATE: 'FLUX_STATE',
  COMBAT_EVENT: 'COMBAT_EVENT',
  MAP_INITIALIZED: 'MAP_INITIALIZED',
  TOKEN_PLACED: 'TOKEN_PLACED',
  TOKEN_MOVED: 'TOKEN_MOVED',
  CAMERA_UPDATED: 'CAMERA_UPDATED',
  WEAPON_FIRED: 'WEAPON_FIRED',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  DRAWING_ADD: 'DRAWING_ADD',
  DRAWING_CLEAR: 'DRAWING_CLEAR',
  DRAWING_SYNC: 'DRAWING_SYNC',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  ERROR: 'ERROR',

  // 请求 - 响应消息
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',

  // 连接控制消息
  PING: 'PING',
  PONG: 'PONG',
  ROOM_UPDATE: 'ROOM_UPDATE',

  // DM 模式
  DM_TOGGLE: 'DM_TOGGLE',
  DM_STATUS_UPDATE: 'DM_STATUS_UPDATE',

  // 选择系统
  OBJECT_SELECTED: 'OBJECT_SELECTED',
  OBJECT_DESELECTED: 'OBJECT_DESELECTED',
  SELECTION_UPDATE: 'SELECTION_UPDATE',

  // Token 拖拽
  TOKEN_DRAG_START: 'TOKEN_DRAG_START',
  TOKEN_DRAGGING: 'TOKEN_DRAGGING',
  TOKEN_DRAG_END: 'TOKEN_DRAG_END',

  // 阵营回合系统
  FACTION_SELECTED: 'FACTION_SELECTED',
  FACTION_TURN_START: 'FACTION_TURN_START',
  FACTION_TURN_END: 'FACTION_TURN_END',
  PLAYER_END_TURN: 'PLAYER_END_TURN',
  PLAYER_CANCEL_END_TURN: 'PLAYER_CANCEL_END_TURN',
  ROUND_START: 'ROUND_START',
  FACTION_ORDER_DETERMINED: 'FACTION_ORDER_DETERMINED',

  // 游戏流程控制
  GAME_PHASE_CHANGED: 'GAME_PHASE_CHANGED',
  GAME_STATE_SYNC: 'GAME_STATE_SYNC',
  GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',
  DEPLOYMENT_START: 'DEPLOYMENT_START',
  DEPLOYMENT_TOKEN_PLACED: 'DEPLOYMENT_TOKEN_PLACED',
  DEPLOYMENT_READY: 'DEPLOYMENT_READY',
  DEPLOYMENT_COMPLETE: 'DEPLOYMENT_COMPLETE',
  TURN_PHASE_CHANGED: 'TURN_PHASE_CHANGED',

  // 房间状态
  ROOM_STATE_UPDATE: 'ROOM_STATE_UPDATE',
  TURN_RESOLUTION: 'TURN_RESOLUTION',

  // 行动系统
  SHIP_ACTION: 'SHIP_ACTION',
  SHIP_ACTION_RESULT: 'SHIP_ACTION_RESULT',
  SHIP_ACTION_STATE_UPDATE: 'SHIP_ACTION_STATE_UPDATE',
  OVERLOAD_RESET_AVAILABLE: 'OVERLOAD_RESET_AVAILABLE',

  // 三阶段移动系统
  MOVEMENT_PHASE_START: 'MOVEMENT_PHASE_START',
  MOVEMENT_PHASE_UPDATE: 'MOVEMENT_PHASE_UPDATE',
  MOVEMENT_PHASE_COMPLETE: 'MOVEMENT_PHASE_COMPLETE',
  MOVEMENT_PREVIEW: 'MOVEMENT_PREVIEW',
  MOVEMENT_COMMIT: 'MOVEMENT_COMMIT',
  MOVEMENT_CANCEL: 'MOVEMENT_CANCEL',

  // 战斗交互系统
  TARGET_SELECTED: 'TARGET_SELECTED',
  WEAPON_SELECTED: 'WEAPON_SELECTED',
  QUADRANT_SELECTED: 'QUADRANT_SELECTED',
  ATTACK_PREVIEW: 'ATTACK_PREVIEW',
  ATTACK_CONFIRMED: 'ATTACK_CONFIRMED',
  OVERLOAD_TRIGGERED: 'OVERLOAD_TRIGGERED',
  OVERLOAD_RECOVERED: 'OVERLOAD_RECOVERED',
  SHIP_DESTROYED: 'SHIP_DESTROYED',

  // 引导系统
  GUIDE_TIP_SHOWN: 'GUIDE_TIP_SHOWN',
  GUIDE_TIP_DISMISSED: 'GUIDE_TIP_DISMISSED',
  GUIDE_PROGRESS_UPDATE: 'GUIDE_PROGRESS_UPDATE',
} as const;

export type WSMessageType = (typeof WS_MESSAGE_TYPES)[keyof typeof WS_MESSAGE_TYPES];

// ==================== 基础 Schema ====================
const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ==================== 请求 - 响应消息 Schema（核心业务） ====================
export const RequestOperationSchema = z.enum([
  'player.join',
  'player.leave',
  'player.list',
  'room.list',
  'room.create',
  'room.kick',
  'room.setOwner',
  'ship.move',
  'ship.toggleShield',
  'ship.vent',
  'ship.getStatus',
  'dm.toggle',
  'dm.getStatus',
  'camera.update',
  'map.snapshot.get',
  'map.snapshot.save',
  'map.token.move',
  'room.state.get',
  // DM专属操作
  'game.pause',
  'game.resume',
  'game.end',
  'game.advancePhase',
  'game.controlEnemy',
  // 三阶段移动操作
  'movement.start',
  'movement.preview',
  'movement.commit',
  'movement.cancel',
  // 战斗交互操作
  'combat.selectTarget',
  'combat.clearTarget',
  'combat.selectWeapon',
  'combat.clearWeapon',
  'combat.selectQuadrant',
  'combat.clearQuadrant',
  'combat.attackPreview',
  'combat.confirmAttack',
  // 部署操作
  'deployment.deployShip',
  'deployment.removeShip',
  'deployment.setReady',
  'deployment.getState',
]);

export type RequestOperation = z.infer<typeof RequestOperationSchema>;

// 请求负载 Schema
export const PlayerJoinRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  roomId: z.string().optional(),
  faction: FactionIdSchema.optional(),
});

export const PlayerLeaveRequestSchema = z.object({
  playerId: z.string(),
  roomId: z.string(),
});

export const PlayerListRequestSchema = z.object({
  roomId: z.string(),
});

export const RoomListRequestSchema = z.object({});

export const RoomCreateRequestSchema = z.object({
  roomId: z.string(),
  name: z.string().optional(),
  maxPlayers: z.number().optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().optional(),
});

export const ShipMoveRequestSchema = z.object({
  shipId: z.string(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

export const ShipToggleShieldRequestSchema = z.object({
  shipId: z.string(),
});

export const ShipVentRequestSchema = z.object({
  shipId: z.string(),
});

export const ShipGetStatusRequestSchema = z.object({
  shipId: z.string(),
});

export const DMToggleRequestSchema = z.object({
  enable: z.boolean(),
  playerId: z.string(),
});

export const DMGetStatusRequestSchema = z.object({});

export const CameraUpdateRequestSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const MapSnapshotGetRequestSchema = z.object({
  roomId: z.string().optional(),
});

export const MapSnapshotSaveRequestSchema = z.object({
  roomId: z.string().optional(),
  snapshot: z.unknown(),
});

export const MapTokenMoveRequestSchema = z.object({
  roomId: z.string().optional(),
  tokenId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  heading: z.number(),
  ownerId: z.string().optional(),
  type: z.enum(['ship', 'station', 'asteroid']).optional(),
  size: z.number().optional(),
});

export const RoomStateGetRequestSchema = z.object({
  roomId: z.string().optional(),
});

// 房间管理请求
export const RoomKickRequestSchema = z.object({
  roomId: z.string(),
  playerId: z.string(),
});

export const RoomSetOwnerRequestSchema = z.object({
  roomId: z.string(),
  newOwnerId: z.string(),
});

// DM专属操作请求
export const GamePauseRequestSchema = z.object({
  roomId: z.string(),
});

export const GameResumeRequestSchema = z.object({
  roomId: z.string(),
});

export const GameEndRequestSchema = z.object({
  roomId: z.string(),
  winner: FactionIdSchema.optional(),
});

export const GameAdvancePhaseRequestSchema = z.object({
  roomId: z.string(),
});

export const GameControlEnemyRequestSchema = z.object({
  roomId: z.string(),
  enemyTokenId: z.string(),
  action: z.enum(['move', 'attack', 'ability']),
  targetId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

// ====== 三阶段移动请求 Schema ======

/** 移动阶段开始请求 */
export const MovementStartRequestSchema = z.object({
  shipId: z.string(),
  phase: z.enum(['translate_a', 'rotate', 'translate_b']),
});

/** 移动预览请求 */
export const MovementPreviewRequestSchema = z.object({
  shipId: z.string(),
  phase: z.enum(['translate_a', 'rotate', 'translate_b']),
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

/** 移动提交请求 */
export const MovementCommitRequestSchema = z.object({
  shipId: z.string(),
  phase: z.enum(['translate_a', 'rotate', 'translate_b']),
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
  finalPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  finalHeading: z.number().optional(),
});

/** 移动取消请求 */
export const MovementCancelRequestSchema = z.object({
  shipId: z.string(),
});

// ====== 战斗交互请求 Schema ======

/** 选择目标请求 */
export const CombatSelectTargetRequestSchema = z.object({
  attackerId: z.string(),
  targetId: z.string(),
});

/** 清除目标请求 */
export const CombatClearTargetRequestSchema = z.object({
  attackerId: z.string(),
});

/** 选择武器请求 */
export const CombatSelectWeaponRequestSchema = z.object({
  shipId: z.string(),
  weaponInstanceId: z.string(),
});

/** 清除武器请求 */
export const CombatClearWeaponRequestSchema = z.object({
  shipId: z.string(),
});

/** 选择象限请求 */
export const CombatSelectQuadrantRequestSchema = z.object({
  attackerId: z.string(),
  targetId: z.string(),
  quadrant: z.enum(['front', 'rear', 'left', 'right']),
});

/** 清除象限请求 */
export const CombatClearQuadrantRequestSchema = z.object({
  attackerId: z.string(),
});

/** 攻击预览请求 */
export const CombatAttackPreviewRequestSchema = z.object({
  attackerId: z.string(),
  targetId: z.string(),
  weaponInstanceId: z.string(),
  targetQuadrant: z.enum(['front', 'rear', 'left', 'right']).optional(),
});

/** 确认攻击请求 */
export const CombatConfirmAttackRequestSchema = z.object({
  attackerId: z.string(),
  targetId: z.string(),
  weaponInstanceId: z.string(),
  targetQuadrant: z.enum(['front', 'rear', 'left', 'right']).optional(),
});

// ====== 部署请求 Schema ======

/** 部署舰船请求 */
export const DeploymentDeployShipRequestSchema = z.object({
  shipDefinitionId: z.string(),
  ownerId: z.string(),
  faction: FactionIdSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  heading: z.number(),
  shipName: z.string().optional(),
});

/** 移除已部署舰船请求 */
export const DeploymentRemoveShipRequestSchema = z.object({
  tokenId: z.string(),
});

/** 设置部署就绪请求 */
export const DeploymentSetReadyRequestSchema = z.object({
  faction: FactionIdSchema,
  playerId: z.string(),
  ready: z.boolean(),
});

/** 获取部署状态请求 */
export const DeploymentGetStateRequestSchema = z.object({
  roomId: z.string().optional(),
});

// 请求负载联合 Schema
export const RequestPayloadSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('player.join'), data: PlayerJoinRequestSchema }),
  z.object({ operation: z.literal('player.leave'), data: PlayerLeaveRequestSchema }),
  z.object({ operation: z.literal('player.list'), data: PlayerListRequestSchema }),
  z.object({ operation: z.literal('room.list'), data: RoomListRequestSchema }),
  z.object({ operation: z.literal('room.create'), data: RoomCreateRequestSchema }),
  z.object({ operation: z.literal('room.kick'), data: RoomKickRequestSchema }),
  z.object({ operation: z.literal('room.setOwner'), data: RoomSetOwnerRequestSchema }),
  z.object({ operation: z.literal('ship.move'), data: ShipMoveRequestSchema }),
  z.object({ operation: z.literal('ship.toggleShield'), data: ShipToggleShieldRequestSchema }),
  z.object({ operation: z.literal('ship.vent'), data: ShipVentRequestSchema }),
  z.object({ operation: z.literal('ship.getStatus'), data: ShipGetStatusRequestSchema }),
  z.object({ operation: z.literal('dm.toggle'), data: DMToggleRequestSchema }),
  z.object({ operation: z.literal('dm.getStatus'), data: DMGetStatusRequestSchema }),
  z.object({ operation: z.literal('camera.update'), data: CameraUpdateRequestSchema }),
  z.object({ operation: z.literal('map.snapshot.get'), data: MapSnapshotGetRequestSchema }),
  z.object({ operation: z.literal('map.snapshot.save'), data: MapSnapshotSaveRequestSchema }),
  z.object({ operation: z.literal('map.token.move'), data: MapTokenMoveRequestSchema }),
  z.object({ operation: z.literal('room.state.get'), data: RoomStateGetRequestSchema }),
  // DM专属操作
  z.object({ operation: z.literal('game.pause'), data: GamePauseRequestSchema }),
  z.object({ operation: z.literal('game.resume'), data: GameResumeRequestSchema }),
  z.object({ operation: z.literal('game.end'), data: GameEndRequestSchema }),
  z.object({ operation: z.literal('game.advancePhase'), data: GameAdvancePhaseRequestSchema }),
  z.object({ operation: z.literal('game.controlEnemy'), data: GameControlEnemyRequestSchema }),
  // 三阶段移动操作
  z.object({ operation: z.literal('movement.start'), data: MovementStartRequestSchema }),
  z.object({ operation: z.literal('movement.preview'), data: MovementPreviewRequestSchema }),
  z.object({ operation: z.literal('movement.commit'), data: MovementCommitRequestSchema }),
  z.object({ operation: z.literal('movement.cancel'), data: MovementCancelRequestSchema }),
  // 战斗交互操作
  z.object({ operation: z.literal('combat.selectTarget'), data: CombatSelectTargetRequestSchema }),
  z.object({ operation: z.literal('combat.clearTarget'), data: CombatClearTargetRequestSchema }),
  z.object({ operation: z.literal('combat.selectWeapon'), data: CombatSelectWeaponRequestSchema }),
  z.object({ operation: z.literal('combat.clearWeapon'), data: CombatClearWeaponRequestSchema }),
  z.object({ operation: z.literal('combat.selectQuadrant'), data: CombatSelectQuadrantRequestSchema }),
  z.object({ operation: z.literal('combat.clearQuadrant'), data: CombatClearQuadrantRequestSchema }),
  z.object({ operation: z.literal('combat.attackPreview'), data: CombatAttackPreviewRequestSchema }),
  z.object({ operation: z.literal('combat.confirmAttack'), data: CombatConfirmAttackRequestSchema }),
  // 部署操作
  z.object({ operation: z.literal('deployment.deployShip'), data: DeploymentDeployShipRequestSchema }),
  z.object({ operation: z.literal('deployment.removeShip'), data: DeploymentRemoveShipRequestSchema }),
  z.object({ operation: z.literal('deployment.setReady'), data: DeploymentSetReadyRequestSchema }),
  z.object({ operation: z.literal('deployment.getState'), data: DeploymentGetStateRequestSchema }),
]);

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// 响应负载 Schema
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  operation: RequestOperationSchema,
  data: z.unknown(),
  timestamp: z.number(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  operation: RequestOperationSchema,
  error: ErrorPayloadSchema,
  timestamp: z.number(),
});

export const ResponsePayloadSchema = z.discriminatedUnion('success', [
  SuccessResponseSchema,
  ErrorResponseSchema,
]);

// 请求消息
export const RequestMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.REQUEST),
  payload: z.object({
    requestId: z.string(),
  }).and(RequestPayloadSchema),
});

// 响应消息
export const ResponseMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.RESPONSE),
  payload: z.object({
    requestId: z.string(),
  }).and(ResponsePayloadSchema),
});

// ==================== 请求/响应类型 ====================
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

// 请求负载类型别名
export type PlayerJoinRequestPayload = z.infer<typeof PlayerJoinRequestSchema>;
export type PlayerLeaveRequestPayload = z.infer<typeof PlayerLeaveRequestSchema>;
export type PlayerListRequestPayload = z.infer<typeof PlayerListRequestSchema>;
export type RoomListRequestPayload = z.infer<typeof RoomListRequestSchema>;
export type RoomCreateRequestPayload = z.infer<typeof RoomCreateRequestSchema>;
export type ShipMoveRequestPayload = z.infer<typeof ShipMoveRequestSchema>;
export type ShipToggleShieldRequestPayload = z.infer<typeof ShipToggleShieldRequestSchema>;
export type ShipVentRequestPayload = z.infer<typeof ShipVentRequestSchema>;
export type ShipGetStatusRequestPayload = z.infer<typeof ShipGetStatusRequestSchema>;
export type DMToggleRequestPayload = z.infer<typeof DMToggleRequestSchema>;
export type DMGetStatusRequestPayload = z.infer<typeof DMGetStatusRequestSchema>;
export type CameraUpdateRequestPayload = z.infer<typeof CameraUpdateRequestSchema>;
export type MapSnapshotGetRequestPayload = z.infer<typeof MapSnapshotGetRequestSchema>;
export type MapSnapshotSaveRequestPayload = z.infer<typeof MapSnapshotSaveRequestSchema>;
export type MapTokenMoveRequestPayload = z.infer<typeof MapTokenMoveRequestSchema>;
export type RoomStateGetRequestPayload = z.infer<typeof RoomStateGetRequestSchema>;
export type RoomKickRequestPayload = z.infer<typeof RoomKickRequestSchema>;
export type RoomSetOwnerRequestPayload = z.infer<typeof RoomSetOwnerRequestSchema>;
export type GamePauseRequestPayload = z.infer<typeof GamePauseRequestSchema>;
export type GameResumeRequestPayload = z.infer<typeof GameResumeRequestSchema>;
export type GameEndRequestPayload = z.infer<typeof GameEndRequestSchema>;
export type GameAdvancePhaseRequestPayload = z.infer<typeof GameAdvancePhaseRequestSchema>;
export type GameControlEnemyRequestPayload = z.infer<typeof GameControlEnemyRequestSchema>;

// 三阶段移动请求类型
export type MovementStartRequestPayload = z.infer<typeof MovementStartRequestSchema>;
export type MovementPreviewRequestPayload = z.infer<typeof MovementPreviewRequestSchema>;
export type MovementCommitRequestPayload = z.infer<typeof MovementCommitRequestSchema>;
export type MovementCancelRequestPayload = z.infer<typeof MovementCancelRequestSchema>;

// 战斗交互请求类型
export type CombatSelectTargetRequestPayload = z.infer<typeof CombatSelectTargetRequestSchema>;
export type CombatClearTargetRequestPayload = z.infer<typeof CombatClearTargetRequestSchema>;
export type CombatSelectWeaponRequestPayload = z.infer<typeof CombatSelectWeaponRequestSchema>;
export type CombatClearWeaponRequestPayload = z.infer<typeof CombatClearWeaponRequestSchema>;
export type CombatSelectQuadrantRequestPayload = z.infer<typeof CombatSelectQuadrantRequestSchema>;
export type CombatClearQuadrantRequestPayload = z.infer<typeof CombatClearQuadrantRequestSchema>;
export type CombatAttackPreviewRequestPayload = z.infer<typeof CombatAttackPreviewRequestSchema>;
export type CombatConfirmAttackRequestPayload = z.infer<typeof CombatConfirmAttackRequestSchema>;

// 部署请求类型
export type DeploymentDeployShipRequestPayload = z.infer<typeof DeploymentDeployShipRequestSchema>;
export type DeploymentRemoveShipRequestPayload = z.infer<typeof DeploymentRemoveShipRequestSchema>;
export type DeploymentSetReadyRequestPayload = z.infer<typeof DeploymentSetReadyRequestSchema>;
export type DeploymentGetStateRequestPayload = z.infer<typeof DeploymentGetStateRequestSchema>;

// 响应负载类型
export type PlayerJoinResponsePayload = PlayerInfo;
export type PlayerLeaveResponsePayload = void;
export type PlayerListResponsePayload = PlayerInfo[];
export type RoomListResponsePayload = {
  rooms: Array<{ roomId: string; playerCount: number; maxPlayers: number; createdAt: number }>;
};
export type RoomCreateResponsePayload = { roomId: string };
export type RoomKickResponsePayload = { success: boolean };
export type RoomSetOwnerResponsePayload = { success: boolean };
export type ShipMoveResponsePayload = ShipStatus | null;
export type ShipToggleShieldResponsePayload = ShipStatus | null;
export type ShipVentResponsePayload = ShipStatus | null;
export type ShipGetStatusResponsePayload = ShipStatus | null;
export type DMToggleResponsePayload = PlayerInfo;
export type DMGetStatusResponsePayload = { isDMMode: boolean; players: Array<{ id: string; name: string; isDMMode: boolean }> };
export type CameraUpdateResponsePayload = void;
export type MapSnapshotGetResponsePayload = { roomId: string; snapshot: MapSnapshot };
export type MapSnapshotSaveResponsePayload = { roomId: string; snapshot: MapSnapshot };
export type MapTokenMoveResponsePayload = { roomId: string; token: TokenInfo };
export type RoomStateGetResponsePayload = {
  roomId: string;
  players: PlayerInfo[];
  dm: { isDMMode: boolean; players: Array<{ id: string; name: string; isDMMode: boolean }> };
  snapshot: MapSnapshot;
};
export type GamePauseResponsePayload = { success: boolean };
export type GameResumeResponsePayload = { success: boolean };
export type GameEndResponsePayload = { success: boolean; winner?: string };
export type GameAdvancePhaseResponsePayload = { success: boolean; newPhase: string };
export type GameControlEnemyResponsePayload = { success: boolean; enemyTokenId: string };

// 三阶段移动响应类型
export type MovementStartResponsePayload = { success: boolean; phase: string; shipId: string };
export type MovementPreviewResponsePayload = {
  success: boolean;
  shipId: string;
  phase: string;
  preview: {
    startPosition: { x: number; y: number };
    endPosition: { x: number; y: number };
    startHeading: number;
    endHeading: number;
    path: Array<{ x: number; y: number }>;
    isValid: boolean;
    invalidReason?: string;
  };
};
export type MovementCommitResponsePayload = { success: boolean; shipId: string; newPosition: { x: number; y: number }; newHeading: number };
export type MovementCancelResponsePayload = { success: boolean; shipId: string };

// 战斗交互响应类型
export type CombatSelectTargetResponsePayload = {
  success: boolean;
  attackerId: string;
  targetId: string;
  targetInfo?: {
    id: string;
    name?: string;
    hullSize?: string;
    position: { x: number; y: number };
    heading: number;
    distance: number;
  };
};
export type CombatClearTargetResponsePayload = { success: boolean; attackerId: string };
export type CombatSelectWeaponResponsePayload = {
  success: boolean;
  shipId: string;
  weaponInstanceId: string;
  weaponInfo?: {
    instanceId: string;
    weaponId: string;
    name: string;
    damageType: string;
    baseDamage: number;
    range: number;
    arc: number;
    state: string;
    canFire: boolean;
  };
};
export type CombatClearWeaponResponsePayload = { success: boolean; shipId: string };
export type CombatSelectQuadrantResponsePayload = {
  success: boolean;
  attackerId: string;
  targetId: string;
  quadrant: string;
  quadrantInfo?: {
    quadrant: string;
    currentArmor: number;
    maxArmor: number;
    armorPercent: number;
  };
};
export type CombatClearQuadrantResponsePayload = { success: boolean; attackerId: string };
export type CombatAttackPreviewResponsePayload = {
  success: boolean;
  attackerId: string;
  targetId: string;
  weaponInstanceId: string;
  canAttack: boolean;
  preview?: {
    baseDamage: number;
    estimatedShieldAbsorb: number;
    estimatedArmorReduction: number;
    estimatedHullDamage: number;
    hitQuadrant: string;
    fluxCost: number;
    willGenerateHardFlux: boolean;
  };
  blockReason?: string;
};
export type CombatConfirmAttackResponsePayload = {
  success: boolean;
  attackerId: string;
  targetId: string;
  weaponInstanceId: string;
  damage?: {
    hit: boolean;
    baseDamage: number;
    shieldAbsorbed: number;
    armorReduced: number;
    hullDamage: number;
    hitQuadrant?: string;
  };
  targetState?: {
    shieldChange?: number;
    hullChange?: number;
    destroyed?: boolean;
  };
};

// 部署响应类型
export type DeploymentDeployShipResponsePayload = {
  success: boolean;
  token?: {
    id: string;
    type: string;
    position: { x: number; y: number };
    heading: number;
    ownerId: string;
    faction: string;
  };
  error?: string;
};
export type DeploymentRemoveShipResponsePayload = { success: boolean; tokenId?: string; error?: string };
export type DeploymentSetReadyResponsePayload = { success: boolean; faction: string; ready: boolean };
export type DeploymentGetStateResponsePayload = {
  isDeploymentPhase: boolean;
  deployedShips: Record<string, Array<{
    id: string;
    position: { x: number; y: number };
    heading: number;
    ownerId: string;
  }>>;
  readyStatus: Record<string, boolean>;
};

// 响应数据联合类型
export type ResponseData =
  | { operation: 'player.join'; data: PlayerJoinResponsePayload }
  | { operation: 'player.leave'; data: PlayerLeaveResponsePayload }
  | { operation: 'player.list'; data: PlayerListResponsePayload }
  | { operation: 'room.list'; data: RoomListResponsePayload }
  | { operation: 'room.create'; data: RoomCreateResponsePayload }
  | { operation: 'room.kick'; data: RoomKickResponsePayload }
  | { operation: 'room.setOwner'; data: RoomSetOwnerResponsePayload }
  | { operation: 'ship.move'; data: ShipMoveResponsePayload }
  | { operation: 'ship.toggleShield'; data: ShipToggleShieldResponsePayload }
  | { operation: 'ship.vent'; data: ShipVentResponsePayload }
  | { operation: 'ship.getStatus'; data: ShipGetStatusResponsePayload }
  | { operation: 'dm.toggle'; data: DMToggleResponsePayload }
  | { operation: 'dm.getStatus'; data: DMGetStatusResponsePayload }
  | { operation: 'camera.update'; data: CameraUpdateResponsePayload }
  | { operation: 'map.snapshot.get'; data: MapSnapshotGetResponsePayload }
  | { operation: 'map.snapshot.save'; data: MapSnapshotSaveResponsePayload }
  | { operation: 'map.token.move'; data: MapTokenMoveResponsePayload }
  | { operation: 'room.state.get'; data: RoomStateGetResponsePayload }
  | { operation: 'game.pause'; data: GamePauseResponsePayload }
  | { operation: 'game.resume'; data: GameResumeResponsePayload }
  | { operation: 'game.end'; data: GameEndResponsePayload }
  | { operation: 'game.advancePhase'; data: GameAdvancePhaseResponsePayload }
  | { operation: 'game.controlEnemy'; data: GameControlEnemyResponsePayload }
  // 三阶段移动
  | { operation: 'movement.start'; data: MovementStartResponsePayload }
  | { operation: 'movement.preview'; data: MovementPreviewResponsePayload }
  | { operation: 'movement.commit'; data: MovementCommitResponsePayload }
  | { operation: 'movement.cancel'; data: MovementCancelResponsePayload }
  // 战斗交互
  | { operation: 'combat.selectTarget'; data: CombatSelectTargetResponsePayload }
  | { operation: 'combat.clearTarget'; data: CombatClearTargetResponsePayload }
  | { operation: 'combat.selectWeapon'; data: CombatSelectWeaponResponsePayload }
  | { operation: 'combat.clearWeapon'; data: CombatClearWeaponResponsePayload }
  | { operation: 'combat.selectQuadrant'; data: CombatSelectQuadrantResponsePayload }
  | { operation: 'combat.clearQuadrant'; data: CombatClearQuadrantResponsePayload }
  | { operation: 'combat.attackPreview'; data: CombatAttackPreviewResponsePayload }
  | { operation: 'combat.confirmAttack'; data: CombatConfirmAttackResponsePayload }
  // 部署
  | { operation: 'deployment.deployShip'; data: DeploymentDeployShipResponsePayload }
  | { operation: 'deployment.removeShip'; data: DeploymentRemoveShipResponsePayload }
  | { operation: 'deployment.setReady'; data: DeploymentSetReadyResponsePayload }
  | { operation: 'deployment.getState'; data: DeploymentGetStateResponsePayload };

export type ResponsePayload<T extends RequestOperation = RequestOperation> =
  | z.infer<typeof SuccessResponseSchema> & { operation: T }
  | z.infer<typeof ErrorResponseSchema>;

export type SuccessResponse<T extends RequestOperation = RequestOperation> = Extract<
  ResponsePayload<T>,
  { success: true }
>;

export type ErrorResponse = Extract<ResponsePayload, { success: false }>;

// 工具类型
export type ResponseForOperation<T extends RequestOperation> = Extract<
  ResponseData,
  { operation: T }
>['data'];

export type OperationHandler<O extends RequestOperation> = (
  clientId: string,
  data: Extract<RequestPayload, { operation: O }>['data']
) => Promise<ResponseForOperation<O>>;

export type RequestHandlers = {
  [O in RequestOperation]?: OperationHandler<O>;
};

// ==================== 事件消息类型（从 DomainEvents 导入） ====================
// 注意：事件消息的完整 schema 定义在 protocol/DomainEvents.ts
// 这里只定义 WS 消息包装类型

/** 绘图元素 Schema（本地使用） */
const DrawingElementSchema = z.object({
  type: z.enum(['path', 'line', 'arrow', 'rect', 'circle']),
  color: z.string(),
  lineWidth: z.number(),
  path: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  cx: z.number().optional(),
  cy: z.number().optional(),
  radius: z.number().optional(),
});

export type DrawingElement = z.infer<typeof DrawingElementSchema>;

// ==================== WS 消息联合类型 ====================
/**
 * WS 消息联合类型
 * 
 * 包含：
 * 1. 请求 - 响应消息（完整定义）
 * 2. 事件消息（简化，使用 payload 类型）
 */
export type WSMessage =
  // 请求 - 响应
  | RequestMessage
  | ResponseMessage
  // 事件消息（简化定义，完整 schema 在 DomainEvents）
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED; payload: PlayerInfo }
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_LEFT; payload: { playerId: string; reason?: string } }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED; payload: ShipMovement }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE; payload: ShipStatus }
  | { type: typeof WS_MESSAGE_TYPES.SHIELD_UPDATE; payload: { shipId: string; active: boolean; type: 'front' | 'full'; coverageAngle: number } }
  | { type: typeof WS_MESSAGE_TYPES.FLUX_STATE; payload: { shipId: string; fluxState: 'normal' | 'venting' | 'overloaded'; currentFlux: number; softFlux: number; hardFlux: number } }
  | { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED; payload: PlayerCamera }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_MOVED; payload: { tokenId: string; previousPosition: { x: number; y: number }; newPosition: { x: number; y: number }; previousHeading: number; newHeading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_PLACED; payload: TokenInfo }
  | { type: typeof WS_MESSAGE_TYPES.MAP_INITIALIZED; payload: MapConfig & { tokens: TokenInfo[] } }
  | { type: typeof WS_MESSAGE_TYPES.OBJECT_SELECTED; payload: { playerId: string; playerName: string; tokenId: string; timestamp: number; forceOverride?: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.OBJECT_DESELECTED; payload: { playerId: string; tokenId: string; timestamp: number; reason?: 'manual' | 'override' | 'released' } }
  | { type: typeof WS_MESSAGE_TYPES.SELECTION_UPDATE; payload: { selections: Array<{ tokenId: string; selectedBy: { id: string; name: string; isDMMode: boolean } | null; timestamp: number }> } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_START; payload: { tokenId: string; playerId: string; playerName: string; position: { x: number; y: number }; heading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAGGING; payload: { tokenId: string; playerId: string; playerName: string; position: { x: number; y: number }; heading: number; timestamp: number; isDragging: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_END; payload: { tokenId: string; playerId: string; finalPosition: { x: number; y: number }; finalHeading: number; timestamp: number; committed: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.DM_STATUS_UPDATE; payload: { players: Array<{ id: string; name: string; isDMMode: boolean }> } }
  | { type: typeof WS_MESSAGE_TYPES.DM_TOGGLE; payload: { playerId: string; playerName: string; enable: boolean; timestamp: number } }
  // 阵营回合系统消息
  | { type: typeof WS_MESSAGE_TYPES.FACTION_SELECTED; payload: { playerId: string; playerName: string; faction: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.FACTION_TURN_START; payload: { faction: string; roundNumber: number; playerEndStatus: Array<{ playerId: string; playerName: string; faction: string; hasEndedTurn: boolean; endedAt?: number }>; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.FACTION_TURN_END; payload: { faction: string; roundNumber: number; endedPlayers: string[]; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_END_TURN; payload: { playerId: string; playerName: string; faction: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_CANCEL_END_TURN; payload: { playerId: string; playerName: string; faction: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.ROUND_START; payload: { roundNumber: number; factionOrder: string[]; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.FACTION_ORDER_DETERMINED; payload: { roundNumber: number; factionOrder: string[]; timestamp: number } }
  // 游戏流程控制消息
  | { type: typeof WS_MESSAGE_TYPES.GAME_PHASE_CHANGED; payload: { previousPhase: string; newPhase: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.GAME_STATE_SYNC; payload: { phase: string; turnPhase: string; roundNumber: number; currentFaction?: string; deploymentReady: Record<string, boolean>; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_START; payload: { factions: string[]; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_TOKEN_PLACED; payload: { tokenId: string; playerId: string; faction: string; position: { x: number; y: number }; heading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_READY; payload: { faction: string; playerId: string; ready: boolean; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_COMPLETE; payload: { timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TURN_PHASE_CHANGED; payload: { previousPhase: string; newPhase: string; roundNumber: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TURN_RESOLUTION; payload: { roundNumber: number; fluxDissipation: Array<{ shipId: string; previousFlux: number; newFlux: number }>; overloadResets: string[]; ventCompletions: string[]; timestamp: number } }
  // 行动系统消息
  | { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION; payload: { shipId: string; actionType: string; actionData?: Record<string, unknown>; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION_RESULT; payload: { success: boolean; shipId: string; actionType: string; error?: string; restrictionReason?: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION_STATE_UPDATE; payload: { shipId: string; hasMoved: boolean; hasRotated: boolean; hasFired: boolean; hasToggledShield: boolean; hasVented: boolean; isOverloaded: boolean; overloadResetAvailable: boolean; remainingActions: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.OVERLOAD_RESET_AVAILABLE; payload: { shipId: string; available: boolean; timestamp: number } }
  // 三阶段移动消息
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_PHASE_START; payload: { shipId: string; phase: 'translate_a' | 'rotate' | 'translate_b'; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_PHASE_UPDATE; payload: { shipId: string; phase: 'translate_a' | 'rotate' | 'translate_b'; previewPosition: { x: number; y: number }; previewHeading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_PHASE_COMPLETE; payload: { shipId: string; phase: 'translate_a' | 'rotate' | 'translate_b'; finalPosition: { x: number; y: number }; finalHeading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_PREVIEW; payload: { shipId: string; path: Array<{ x: number; y: number }>; isValid: boolean; invalidReason?: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_COMMIT; payload: { shipId: string; newPosition: { x: number; y: number }; newHeading: number; movementUsed: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.MOVEMENT_CANCEL; payload: { shipId: string; timestamp: number } }
  // 战斗交互消息
  | { type: typeof WS_MESSAGE_TYPES.TARGET_SELECTED; payload: { attackerId: string; targetId: string; targetInfo?: { id: string; name?: string; hullSize?: string; position: { x: number; y: number }; heading: number; distance: number }; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.WEAPON_SELECTED; payload: { shipId: string; weaponInstanceId: string; weaponInfo?: { instanceId: string; weaponId: string; name: string; damageType: string; baseDamage: number; range: number; arc: number; state: string; canFire: boolean }; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.QUADRANT_SELECTED; payload: { attackerId: string; targetId: string; quadrant: string; quadrantInfo?: { quadrant: string; currentArmor: number; maxArmor: number; armorPercent: number }; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.ATTACK_PREVIEW; payload: { attackerId: string; targetId: string; weaponInstanceId: string; canAttack: boolean; preview?: { baseDamage: number; estimatedShieldAbsorb: number; estimatedArmorReduction: number; estimatedHullDamage: number; hitQuadrant: string; fluxCost: number }; blockReason?: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.ATTACK_CONFIRMED; payload: { attackerId: string; targetId: string; weaponInstanceId: string; damage?: { hit: boolean; baseDamage: number; shieldAbsorbed: number; armorReduced: number; hullDamage: number; hitQuadrant?: string }; targetState?: { shieldChange?: number; hullChange?: number; destroyed?: boolean }; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.OVERLOAD_TRIGGERED; payload: { shipId: string; fluxAtOverload: number; overloadDuration: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.OVERLOAD_RECOVERED; payload: { shipId: string; fluxAfterRecovery: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_DESTROYED; payload: { tokenId: string; killerId?: string; killerFaction?: string; reason: string; finalBlow?: { weaponId: string; damageType: string; damage: number }; timestamp: number } }
  // 引导系统消息
  | { type: typeof WS_MESSAGE_TYPES.GUIDE_TIP_SHOWN; payload: { playerId: string; tipId: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.GUIDE_TIP_DISMISSED; payload: { playerId: string; tipId: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.GUIDE_PROGRESS_UPDATE; payload: { playerId: string; completedTips: string[]; currentStep: string; timestamp: number } }
  // 战斗消息
  | { type: typeof WS_MESSAGE_TYPES.WEAPON_FIRED; payload: { sourceShipId: string; targetShipId: string; weaponId: string; mountId: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DAMAGE_DEALT; payload: { sourceShipId: string; targetShipId: string; hit: boolean; damage?: number; shieldAbsorbed: number; armorReduced: number; hullDamage: number; hitQuadrant?: ArmorQuadrant; softFluxGenerated: number; hardFluxGenerated: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.EXPLOSION; payload: { id: string; position: { x: number; y: number }; radius: number; damage: number; sourceShipId?: string; targetShipId?: string; hitQuadrant?: ArmorQuadrant; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.COMBAT_EVENT; payload: { sourceShipId: string; targetShipId: string; weaponId: string; hit: boolean; damage?: number; hitQuadrant?: ArmorQuadrant; timestamp: number } }
  // 绘图消息
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_ADD; payload: { playerId: string; element: DrawingElement } }
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_CLEAR; payload: { playerId: string } }
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_SYNC; payload: { elements: DrawingElement[] } }
  // 聊天消息
  | { type: typeof WS_MESSAGE_TYPES.CHAT_MESSAGE; payload: { senderId: string; senderName: string; content: string; timestamp: number } }
  // 错误消息
  | { type: typeof WS_MESSAGE_TYPES.ERROR; payload: { code: string; message: string; details?: Record<string, unknown> } }
  // 连接控制消息
  | { type: typeof WS_MESSAGE_TYPES.PING; payload: { timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.PONG; payload: { timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE; payload: { roomId: string; players: Array<{ id: string; name: string; isReady: boolean; currentShipId: string | null }> } };

// ==================== 工具类型 ====================
type ExtractPayload<T> = T extends { payload: infer P } ? P : never;

export type WSMessagePayloadMap = {
  [K in WSMessageType]: ExtractPayload<Extract<WSMessage, { type: K }>>;
};

export type WSMessageOf<T extends WSMessageType> = Extract<WSMessage, { type: T }>;

// ==================== 接口定义 ====================
export interface IWSServer {
  broadcast(message: WSMessage, excludeClientId?: string): void;
  sendTo(clientId: string, message: WSMessage): void;
  getConnectedClients(): Set<string>;
  close(): void;
}

export interface IWSClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: WSMessage): void;
  on<T extends WSMessageType>(
    type: T,
    handler: (payload: WSMessagePayloadMap[T]) => void
  ): void;
  off<T extends WSMessageType>(
    type: T,
    handler?: (payload: WSMessagePayloadMap[T]) => void
  ): void;
  isConnected(): boolean;
}

// ==================== 类型守卫函数 ====================
export function isRequestMessage(msg: WSMessage): msg is RequestMessage {
  return msg.type === WS_MESSAGE_TYPES.REQUEST;
}

export function isResponseMessage(msg: WSMessage): msg is ResponseMessage {
  return msg.type === WS_MESSAGE_TYPES.RESPONSE;
}

export function isSuccessResponse<T extends RequestOperation>(
  response: ResponsePayload<T>
): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse<T extends RequestOperation>(
  response: ResponsePayload<T>
): response is ErrorResponse {
  return response.success === false;
}

// 为常用消息类型创建类型守卫
type MessageGuard<T extends WSMessage> = (msg: WSMessage) => msg is T;

export function createMessageGuard<T extends WSMessage>(type: T['type']): MessageGuard<T> {
  return (msg: WSMessage): msg is T => msg.type === type;
}

// 导出常用类型守卫
export const isPlayerJoinedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED }>>(WS_MESSAGE_TYPES.PLAYER_JOINED);
export const isShipMovedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED }>>(WS_MESSAGE_TYPES.SHIP_MOVED);
export const isCameraUpdatedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED }>>(WS_MESSAGE_TYPES.CAMERA_UPDATED);

// ==================== 向后兼容的类型别名 ====================
// 注意：这些类型别名用于向后兼容，新代码应直接使用 WSMessage 联合类型

export type PlayerJoinedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED }>;
export type PlayerLeftMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_LEFT }>;
export type ShipMovedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED }>;
export type ShipStatusUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE }>;
export type ExplosionMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.EXPLOSION }>;
export type ShieldUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIELD_UPDATE }>;
export type FluxStateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FLUX_STATE }>;
export type CombatEventMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.COMBAT_EVENT }>;
export type MapInitializedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.MAP_INITIALIZED }>;
export type TokenPlacedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_PLACED }>;
export type TokenMovedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_MOVED }>;
export type CameraUpdatedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED }>;
export type WeaponFiredMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.WEAPON_FIRED }>;
export type DamageDealtMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DAMAGE_DEALT }>;
export type DrawingAddMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_ADD }>;
export type DrawingClearMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_CLEAR }>;
export type DrawingSyncMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_SYNC }>;
export type ChatMessagePayload = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CHAT_MESSAGE }>;
export type ErrorMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ERROR }>;
export type PingMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PING }>;
export type PongMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PONG }>;
export type RoomUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE }>;
export type RoomPlayerSnapshot = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE }>['payload']['players'][number];
export type DMToggleMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DM_TOGGLE }>;
export type DMStatusUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DM_STATUS_UPDATE }>;
export type ObjectSelectedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.OBJECT_SELECTED }>;
export type ObjectDeselectedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.OBJECT_DESELECTED }>;
export type SelectionUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SELECTION_UPDATE }>;
export type TokenDragStartMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_START }>;
export type TokenDraggingMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAGGING }>;
export type TokenDragEndMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_END }>;
// 阵营回合消息类型别名
export type FactionSelectedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FACTION_SELECTED }>;
export type FactionTurnStartMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FACTION_TURN_START }>;
export type FactionTurnEndMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FACTION_TURN_END }>;
export type PlayerEndTurnMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_END_TURN }>;
export type PlayerCancelEndTurnMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_CANCEL_END_TURN }>;
export type RoundStartMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROUND_START }>;
export type FactionOrderDeterminedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FACTION_ORDER_DETERMINED }>;
// 游戏流程控制消息类型别名
export type GamePhaseChangedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.GAME_PHASE_CHANGED }>;
export type GameStateSyncMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.GAME_STATE_SYNC }>;
export type DeploymentStartMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_START }>;
export type DeploymentTokenPlacedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_TOKEN_PLACED }>;
export type DeploymentReadyMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_READY }>;
export type DeploymentCompleteMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DEPLOYMENT_COMPLETE }>;
export type TurnPhaseChangedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TURN_PHASE_CHANGED }>;
export type TurnResolutionMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TURN_RESOLUTION }>;
// 行动系统消息类型别名
export type ShipActionMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION }>;
export type ShipActionResultMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION_RESULT }>;
export type ShipActionStateUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_ACTION_STATE_UPDATE }>;
export type OverloadResetAvailableMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.OVERLOAD_RESET_AVAILABLE }>;
