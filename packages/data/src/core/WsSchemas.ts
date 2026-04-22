/**
 * 统一 WebSocket 事件 Schema
 *
 * 全 WebSocket 方案，所有操作通过 Socket.IO 完成
 * 命名空间格式: {namespace}:{action}
 * 所有请求带 requestId，所有响应匹配 requestId
 */

import { z } from "zod"
import {
  GamePhaseSchema,
  FactionSchema,
  CombatTokenSchema,
  InventoryTokenSchema,
  WeaponJSONSchema,
  GameSaveSchema,
  RoomPlayerStateSchema,
  GameRoomStateSchema,
  PointSchema,
  PlayerProfileSchema,
  AssetListItemSchema,
} from "./GameSchemas.js"

export const WsRequestSchema = z.object({
  requestId: z.string(),
  event: z.string(),
  payload: z.any(),
})
export type WsRequest = z.infer<typeof WsRequestSchema>

export const WsResponseSchema = z.object({
  requestId: z.string(),
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
})
export type WsResponse = z.infer<typeof WsResponseSchema>

export const EmptySchema = z.object({})
export const VoidSchema = z.undefined()

interface WsEventDef<P extends z.ZodTypeAny, R extends z.ZodTypeAny> {
  payload: P
  response: R
}

type ExtractPayload<T> = T extends WsEventDef<infer P, infer _> ? z.infer<P> : never
type ExtractResponse<T> = T extends WsEventDef<infer _, infer R> ? z.infer<R> : never

export const AuthLoginDef = {
  payload: z.object({ playerName: z.string().min(1).max(50) }),
  response: z.object({
    playerId: z.string(),
    playerName: z.string(),
    isHost: z.boolean(),
    role: z.enum(["HOST", "PLAYER"]),
  }),
} as const satisfies WsEventDef<any, any>

export const AuthLogoutDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

const ClientProfileSchema = z.object({
  nickname: z.string(),
  avatar: z.string().nullable(),
  avatarAssetId: z.string().optional(),
})

export const ProfileGetDef = {
  payload: EmptySchema,
  response: z.object({ profile: ClientProfileSchema }),
} as const satisfies WsEventDef<any, any>

export const ProfileUpdateDef = {
  payload: z.object({
    nickname: z.string().optional(),
    avatar: z.string().optional(),
    avatarAssetId: z.string().optional(),
  }),
  response: z.object({ profile: ClientProfileSchema }),
} as const satisfies WsEventDef<any, any>

const RoomInfoSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  playerCount: z.number(),
  maxPlayers: z.number(),
  phase: z.string(),
  turnCount: z.number(),
  ownerId: z.string(),
  createdAt: z.number(),
})
export type RoomInfo = z.infer<typeof RoomInfoSchema>

export const RoomCreateDef = {
  payload: z.object({
    name: z.string().min(1).max(100),
    maxPlayers: z.number().min(1).max(8).optional(),
    mapWidth: z.number().min(500).optional(),
    mapHeight: z.number().min(500).optional(),
  }),
  response: z.object({
    roomId: z.string(),
    roomName: z.string(),
    isHost: z.boolean(),
  }),
} as const satisfies WsEventDef<any, any>

export const RoomListDef = {
  payload: EmptySchema,
  response: z.object({ rooms: z.array(RoomInfoSchema) }),
} as const satisfies WsEventDef<any, any>

export const RoomJoinDef = {
  payload: z.object({ roomId: z.string() }),
  response: z.object({
    roomId: z.string(),
    roomName: z.string(),
    isHost: z.boolean(),
    role: z.enum(["HOST", "PLAYER"]).nullable(),
  }),
} as const satisfies WsEventDef<any, any>

export const RoomLeaveDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomActionDef = {
  payload: z.object({
    action: z.enum(["ready", "start", "kick", "transfer_host"]),
    targetId: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>
export type RoomActionPayload = z.infer<typeof RoomActionDef.payload>

export const RoomReadyDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomStartDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomKickDef = {
  payload: z.object({ targetId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomTransferHostDef = {
  payload: z.object({ targetId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomGetAssetsDef = {
  payload: z.object({ includeData: z.boolean().optional() }),
  response: z.object({
    assets: z.array(z.object({
      assetId: z.string(),
      info: AssetListItemSchema.nullable(),
      data: z.string().optional(),
    })),
  }),
} as const satisfies WsEventDef<any, any>

const ShipBuildSchema = z.object({
  id: z.string(),
  data: InventoryTokenSchema,
  ownerId: z.string(),
  isPreset: z.boolean(),
  tags: z.array(z.string()),
  usageCount: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type ShipBuild = z.infer<typeof ShipBuildSchema>

const WeaponBuildSchema = z.object({
  id: z.string(),
  data: WeaponJSONSchema,
  ownerId: z.string(),
  isPreset: z.boolean(),
  tags: z.array(z.string()),
  usageCount: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type WeaponBuild = z.infer<typeof WeaponBuildSchema>

export const TokenListDef = {
  payload: EmptySchema,
  response: z.object({ ships: z.array(ShipBuildSchema) }),
} as const satisfies WsEventDef<any, any>

export const TokenGetDef = {
  payload: z.object({ tokenId: z.string() }),
  response: z.object({ ship: ShipBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const TokenCreateDef = {
  payload: z.object({ token: InventoryTokenSchema }),
  response: z.object({ ship: ShipBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const TokenUpdateDef = {
  payload: z.object({
    tokenId: z.string(),
    updates: z.record(z.string(), z.any()),
  }),
  response: z.object({ ship: ShipBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const TokenDeleteDef = {
  payload: z.object({ tokenId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const TokenCopyPresetDef = {
  payload: z.object({ presetId: z.string() }),
  response: z.object({ ship: ShipBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const TokenMountDef = {
  payload: z.object({
    tokenId: z.string(),
    mountId: z.string(),
    weaponId: z.string().nullable(),
  }),
  response: z.object({ ship: ShipBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const WeaponListDef = {
  payload: EmptySchema,
  response: z.object({ weapons: z.array(WeaponBuildSchema) }),
} as const satisfies WsEventDef<any, any>

export const WeaponGetDef = {
  payload: z.object({ weaponId: z.string() }),
  response: z.object({ weapon: WeaponBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const WeaponCreateDef = {
  payload: z.object({ weapon: WeaponJSONSchema }),
  response: z.object({ weapon: WeaponBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const WeaponUpdateDef = {
  payload: z.object({
    weaponId: z.string(),
    updates: z.record(z.string(), z.any()),
  }),
  response: z.object({ weapon: WeaponBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const WeaponDeleteDef = {
  payload: z.object({ weaponId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const WeaponCopyPresetDef = {
  payload: z.object({ presetId: z.string() }),
  response: z.object({ weapon: WeaponBuildSchema }),
} as const satisfies WsEventDef<any, any>

const SaveBuildSchema = z.object({
  $id: z.string(),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  tokens: z.array(CombatTokenSchema),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
})

export const SaveListDef = {
  payload: EmptySchema,
  response: z.object({ saves: z.array(SaveBuildSchema) }),
} as const satisfies WsEventDef<any, any>

export const SaveCreateDef = {
  payload: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  }),
  response: z.object({ save: SaveBuildSchema }),
} as const satisfies WsEventDef<any, any>

export const SaveLoadDef = {
  payload: z.object({ saveId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const SaveDeleteDef = {
  payload: z.object({ saveId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const AssetUploadDef = {
  payload: z.object({
    type: z.enum(["avatar", "ship_texture", "weapon_texture"]),
    filename: z.string().min(1).max(255),
    mimeType: z.string(),
    data: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  response: z.object({ assetId: z.string() }),
} as const satisfies WsEventDef<any, any>

export const AssetListDef = {
  payload: z.object({
    type: z.enum(["avatar", "ship_texture", "weapon_texture"]).optional(),
    ownerId: z.string().optional(),
  }),
  response: z.object({ assets: z.array(AssetListItemSchema) }),
} as const satisfies WsEventDef<any, any>

export const AssetBatchGetDef = {
  payload: z.object({
    assetIds: z.array(z.string()).min(1),
    includeData: z.boolean().optional(),
  }),
  response: z.object({
    results: z.array(z.object({
      assetId: z.string(),
      info: AssetListItemSchema.nullable(),
      data: z.string().optional(),
    })),
  }),
} as const satisfies WsEventDef<any, any>

export const AssetDeleteDef = {
  payload: z.object({ assetId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const PresetListTokensDef = {
  payload: z.object({
    size: z.string().optional(),
    class: z.string().optional(),
  }),
  response: z.object({ presets: z.array(InventoryTokenSchema) }),
} as const satisfies WsEventDef<any, any>

export const PresetListWeaponsDef = {
  payload: z.object({
    size: z.string().optional(),
    damageType: z.string().optional(),
  }),
  response: z.object({ presets: z.array(WeaponJSONSchema) }),
} as const satisfies WsEventDef<any, any>

export const PresetGetTokenDef = {
  payload: z.object({ presetId: z.string() }),
  response: z.object({ preset: InventoryTokenSchema }),
} as const satisfies WsEventDef<any, any>

export const PresetGetWeaponDef = {
  payload: z.object({ presetId: z.string() }),
  response: z.object({ preset: WeaponJSONSchema }),
} as const satisfies WsEventDef<any, any>

export const GameActionDef = {
  payload: z.object({
    action: z.enum(["move", "rotate", "attack", "shield", "vent", "end_turn", "advance_phase"]),
    tokenId: z.string(),
    forward: z.number().optional(),
    strafe: z.number().optional(),
    angle: z.number().optional(),
    active: z.boolean().optional(),
    direction: z.number().min(0).max(360).optional(),
    allocations: z.array(z.object({
      mountId: z.string(),
      targets: z.array(z.object({
        targetId: z.string(),
        shots: z.number(),
        quadrant: z.number().optional(),
      })),
    })).optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>
export type GameActionPayload = z.infer<typeof GameActionDef.payload>

export const GameMoveDef = {
  payload: z.object({
    tokenId: z.string(),
    forward: z.number().optional(),
    strafe: z.number().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameRotateDef = {
  payload: z.object({
    tokenId: z.string(),
    angle: z.number(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameAttackDef = {
  payload: z.object({
    tokenId: z.string(),
    allocations: z.array(z.object({
      mountId: z.string(),
      targets: z.array(z.object({
        targetId: z.string(),
        shots: z.number(),
        quadrant: z.number().optional(),
      })),
    })),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameShieldDef = {
  payload: z.object({
    tokenId: z.string(),
    active: z.boolean(),
    direction: z.number().min(0).max(360).optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameVentDef = {
  payload: z.object({
    tokenId: z.string(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameEndTurnDef = {
  payload: z.object({
    tokenId: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameAdvancePhaseDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const GameQueryDef = {
  payload: z.object({
    type: z.enum(["targets", "movement", "ownership", "combat_state"]),
    tokenId: z.string(),
  }),
  response: z.object({ result: z.any() }),
} as const satisfies WsEventDef<any, any>
export type GameQueryPayload = z.infer<typeof GameQueryDef.payload>

export const GameQueryTargetsDef = {
  payload: z.object({ tokenId: z.string() }),
  response: z.object({ targets: z.any() }),
} as const satisfies WsEventDef<any, any>

export const GameQueryMovementDef = {
  payload: z.object({ tokenId: z.string() }),
  response: z.object({ movement: z.any() }),
} as const satisfies WsEventDef<any, any>

export const GameQueryOwnershipDef = {
  payload: z.object({ tokenId: z.string() }),
  response: z.object({ ownerId: z.string().nullable(), faction: z.string().nullable() }),
} as const satisfies WsEventDef<any, any>

export const GameQueryCombatStateDef = {
  payload: z.object({ tokenId: z.string() }),
  response: z.object({
    hull: z.number().nullable(),
    flux: z.number().nullable(),
    overloaded: z.boolean().nullable(),
  }),
} as const satisfies WsEventDef<any, any>

export const DmSpawnDef = {
  payload: z.object({
    token: CombatTokenSchema,
    faction: FactionSchema,
    position: PointSchema.optional(),
  }),
  response: z.object({ tokenId: z.string() }),
} as const satisfies WsEventDef<any, any>

export const DmModifyDef = {
  payload: z.object({
    tokenId: z.string(),
    field: z.string(),
    value: z.any(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const DmRemoveDef = {
  payload: z.object({ tokenId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const DmSetModifierDef = {
  payload: z.object({
    key: z.string(),
    value: z.number(),
    duration: z.number().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const DmForceEndTurnDef = {
  payload: z.object({
    faction: FactionSchema.optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

// ============================================================
// 通用编辑接口（非DM专属，需日志广播）
// ============================================================

export const EditTokenDef = {
  payload: z.object({
    tokenId: z.string(),
    path: z.string(),
    value: z.any(),
    reason: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>
export type EditTokenPayload = z.infer<typeof EditTokenDef.payload>

export const EditTokenBatchDef = {
  payload: z.object({
    edits: z.array(z.object({
      tokenId: z.string(),
      path: z.string(),
      value: z.any(),
    })),
    reason: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

// ============================================================
// 状态同步：Patch格式（替代Delta）
// ============================================================

export const PatchOpSchema = z.enum(["add", "remove", "replace", "move", "copy", "test"])
export type PatchOp = z.infer<typeof PatchOpSchema>

export const StatePatchSchema = z.object({
  op: PatchOpSchema,
  path: z.array(z.union([z.string(), z.number()])),
  value: z.any().optional(),
  old: z.any().optional(),
})
export type StatePatch = z.infer<typeof StatePatchSchema>

export const StatePatchPayloadSchema = z.object({
  patches: z.array(StatePatchSchema),
  timestamp: z.number(),
})
export type StatePatchPayload = z.infer<typeof StatePatchPayloadSchema>

// ============================================================
// 战斗日志事件（编辑操作日志）
// ============================================================

export const BattleLogEditSchema = z.object({
  type: z.literal("edit"),
  playerId: z.string(),
  playerName: z.string(),
  tokenId: z.string(),
  tokenName: z.string(),
  path: z.string(),
  oldValue: z.any(),
  newValue: z.any(),
  reason: z.string().optional(),
  timestamp: z.number(),
})
export type BattleLogEdit = z.infer<typeof BattleLogEditSchema>

export const BattleLogEventSchema = z.discriminatedUnion("type", [
  BattleLogEditSchema,
  z.object({
    type: z.literal("attack"),
    attackerId: z.string(),
    targetId: z.string(),
    weaponId: z.string().optional(),
    damage: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("destroyed"),
    tokenId: z.string(),
    tokenName: z.string(),
    timestamp: z.number(),
  }),
])
export type BattleLogEvent = z.infer<typeof BattleLogEventSchema>

export const BattleLogPayloadSchema = z.object({
  log: BattleLogEventSchema,
})
export type BattleLogPayload = z.infer<typeof BattleLogPayloadSchema>

export const SyncRequestFullDef = {
  payload: EmptySchema,
  response: GameRoomStateSchema,
} as const satisfies WsEventDef<any, any>

export const WsEventDefinitions = {
  "auth:login": AuthLoginDef,
  "auth:logout": AuthLogoutDef,
  "profile:get": ProfileGetDef,
  "profile:update": ProfileUpdateDef,
  "room:create": RoomCreateDef,
  "room:list": RoomListDef,
  "room:join": RoomJoinDef,
  "room:leave": RoomLeaveDef,
  "room:action": RoomActionDef,
  "room:ready": RoomReadyDef,
  "room:start": RoomStartDef,
  "room:kick": RoomKickDef,
  "room:transfer_host": RoomTransferHostDef,
  "room:get_assets": RoomGetAssetsDef,
  "token:list": TokenListDef,
  "token:get": TokenGetDef,
  "token:create": TokenCreateDef,
  "token:update": TokenUpdateDef,
  "token:delete": TokenDeleteDef,
  "token:copy_preset": TokenCopyPresetDef,
  "token:mount": TokenMountDef,
  "weapon:list": WeaponListDef,
  "weapon:get": WeaponGetDef,
  "weapon:create": WeaponCreateDef,
  "weapon:update": WeaponUpdateDef,
  "weapon:delete": WeaponDeleteDef,
  "weapon:copy_preset": WeaponCopyPresetDef,
  "save:list": SaveListDef,
  "save:create": SaveCreateDef,
  "save:load": SaveLoadDef,
  "save:delete": SaveDeleteDef,
  "asset:upload": AssetUploadDef,
  "asset:list": AssetListDef,
  "asset:batch_get": AssetBatchGetDef,
  "asset:delete": AssetDeleteDef,
  "preset:list_tokens": PresetListTokensDef,
  "preset:list_weapons": PresetListWeaponsDef,
  "preset:get_token": PresetGetTokenDef,
  "preset:get_weapon": PresetGetWeaponDef,
  "game:action": GameActionDef,
  "game:move": GameMoveDef,
  "game:rotate": GameRotateDef,
  "game:attack": GameAttackDef,
  "game:shield": GameShieldDef,
  "game:vent": GameVentDef,
  "game:end_turn": GameEndTurnDef,
  "game:advance_phase": GameAdvancePhaseDef,
  "game:query": GameQueryDef,
  "game:query_targets": GameQueryTargetsDef,
  "game:query_movement": GameQueryMovementDef,
  "game:query_ownership": GameQueryOwnershipDef,
  "game:query_combat_state": GameQueryCombatStateDef,
  "dm:spawn": DmSpawnDef,
  "dm:modify": DmModifyDef,
  "dm:remove": DmRemoveDef,
  "dm:set_modifier": DmSetModifierDef,
  "dm:force_end_turn": DmForceEndTurnDef,
  "edit:token": EditTokenDef,
  "edit:token_batch": EditTokenBatchDef,
  "sync:request_full": SyncRequestFullDef,
} as const satisfies Record<string, WsEventDef<any, any>>

export type WsEventName = keyof typeof WsEventDefinitions
export type WsPayload<E extends WsEventName> = ExtractPayload<(typeof WsEventDefinitions)[E]>
export type WsResponseData<E extends WsEventName> = ExtractResponse<(typeof WsEventDefinitions)[E]>

export function validateWsPayload<E extends WsEventName>(
  event: E,
  payload: unknown
): { success: true; data: WsPayload<E> } | { success: false; error: string } {
  const schema = WsEventDefinitions[event]?.payload
  if (!schema) return { success: false, error: `Unknown event: ${event}` }
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data as WsPayload<E> }
  return { success: false, error: result.error.message }
}

export function validateWsResponse<E extends WsEventName>(
  event: E,
  data: unknown
): { success: true; data: WsResponseData<E> } | { success: false; error: string } {
  const schema = WsEventDefinitions[event]?.response
  if (!schema) return { success: false, error: `Unknown event: ${event}` }
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data as WsResponseData<E> }
  return { success: false, error: result.error.message }
}

export function createWsResponse<T>(
  requestId: string,
  success: boolean,
  data?: T,
  error?: { code: string; message: string }
): WsResponse {
  return { requestId, success, data, error }
}

export function createWsBroadcast(type: string, payload: unknown): { type: string; timestamp: number; payload: unknown } {
  return { type, timestamp: Date.now(), payload }
}

export const DeltaTypeSchema = z.enum([
  "token_update", "token_add", "token_remove", "token_destroyed",
  "player_update", "player_join", "player_leave", "host_change",
  "phase_change", "turn_change", "faction_turn",
  "modifier_add", "modifier_remove",
])
export type DeltaType = z.infer<typeof DeltaTypeSchema>

export const DeltaChangeSchema = z.object({
  type: DeltaTypeSchema,
  id: z.string().optional(),
  field: z.string().optional(),
  value: z.any().optional(),
  oldValue: z.any().optional(),
})
export type DeltaChange = z.infer<typeof DeltaChangeSchema>

export const SyncDeltaPayloadSchema = z.object({
  timestamp: z.number(),
  changes: z.array(DeltaChangeSchema),
})
export type SyncDeltaPayload = z.infer<typeof SyncDeltaPayloadSchema>

export function createSyncDelta(changes: DeltaChange[]): SyncDeltaPayload {
  return { timestamp: Date.now(), changes }
}

export const GameEventTypeSchema = z.enum([
  "attack_result", "damage_log", "token_destroyed",
  "flux_critical", "overloaded", "shield_break", "turn_summary",
])
export type GameEventType = z.infer<typeof GameEventTypeSchema>

export const SyncEventPayloadSchema = z.object({
  type: GameEventTypeSchema,
  timestamp: z.number(),
  payload: z.object({
    attackerId: z.string().optional(),
    targetId: z.string().optional(),
    weaponId: z.string().optional(),
    tokenId: z.string().optional(),
    result: z.any().optional(),
    log: z.string().optional(),
    faction: z.string().optional(),
  }),
})
export type SyncEventPayload = z.infer<typeof SyncEventPayloadSchema>

export function deltaTokenUpdate(tokenId: string, field: string, value: unknown, oldValue?: unknown): DeltaChange {
  return { type: "token_update", id: tokenId, field, value, oldValue }
}

export function deltaTokenAdd(tokenId: string, token: unknown): DeltaChange {
  return { type: "token_add", id: tokenId, value: token }
}

export function deltaTokenRemove(tokenId: string): DeltaChange {
  return { type: "token_remove", id: tokenId }
}

export function deltaTokenDestroyed(tokenId: string): DeltaChange {
  return { type: "token_destroyed", id: tokenId }
}

export function deltaPlayerUpdate(playerId: string, player: unknown): DeltaChange {
  return { type: "player_update", id: playerId, value: player }
}

export function deltaPlayerJoin(playerId: string, player: unknown): DeltaChange {
  return { type: "player_join", id: playerId, value: player }
}

export function deltaPlayerLeave(playerId: string): DeltaChange {
  return { type: "player_leave", id: playerId }
}

export function deltaHostChange(newOwnerId: string): DeltaChange {
  return { type: "host_change", value: newOwnerId }
}

export function deltaPhaseChange(phase: string): DeltaChange {
  return { type: "phase_change", value: phase }
}

export function deltaTurnChange(turn: number): DeltaChange {
  return { type: "turn_change", value: turn }
}

export function deltaFactionTurn(faction: string): DeltaChange {
  return { type: "faction_turn", value: faction }
}

export function deltaModifierAdd(key: string, value: number): DeltaChange {
  return { type: "modifier_add", field: key, value }
}

export function deltaModifierRemove(key: string): DeltaChange {
  return { type: "modifier_remove", field: key }
}