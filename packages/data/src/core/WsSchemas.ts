/**
 * 统一 WebSocket 事件 Schema - 重构版
 *
 * 接口合并优化：
 * - customize: 存档操作（InventoryToken/WeaponJSON）
 * - edit: 实例编辑（CombatToken，广播BattleLogEdit）
 * - game: 战斗操作（使用 GameActionDef）
 * - sync: Patch 同步（替代 Delta）
 */

import { z } from "zod"
import {
  FactionSchema,
  CombatTokenSchema,
  InventoryTokenSchema,
  WeaponJSONSchema,
  GameRoomStateSchema,
  PointSchema,
  AssetListItemSchema,
  BattleLogEventSchema,
  MapTerrainSchema,
} from "./GameSchemas.js"
import {
  WorldMapSchema,
  WorldNodeSchema,
  WorldEdgeSchema,
  TimelineEventSchema,
} from "./WorldSchemas.js"
import type { BattleLogEvent } from "./GameSchemas.js"

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

export interface EditLogContext {
  playerId: string
  playerName: string
  reason?: string
}

interface WsEventDef<P extends z.ZodTypeAny, R extends z.ZodTypeAny> {
  payload: P
  response: R
}

type ExtractPayload<T> = T extends WsEventDef<infer P, infer _> ? z.infer<P> : never
type ExtractResponse<T> = T extends WsEventDef<infer _, infer R> ? z.infer<R> : never

// ============================================================
// auth 命名空间
// ============================================================

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

// ============================================================
// profile 命名空间
// ============================================================

const ClientProfileSchema = z.object({
  playerId: z.string(),
  nickname: z.string(),
  avatar: z.string().nullable(),
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

// ============================================================
// room 命名空间
// ============================================================

const RoomInfoSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  playerCount: z.number(),
  maxPlayers: z.number(),
  phase: z.string(),
  turnCount: z.number(),
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
    ownerId: z.string(),
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
    ownerId: z.string(),
    isHost: z.boolean(),
    role: z.enum(["HOST", "PLAYER"]).nullable(),
    state: GameRoomStateSchema,
  }),
} as const satisfies WsEventDef<any, any>

export const RoomLeaveDef = {
  payload: EmptySchema,
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const RoomRejoinDef = {
  payload: z.object({ roomId: z.string() }),
  response: z.object({
    success: z.boolean(),
    state: GameRoomStateSchema.optional(),
    role: z.enum(["HOST", "PLAYER"]).optional(),
  }),
} as const satisfies WsEventDef<any, any>

export const RoomActionDef = {
  payload: z.object({
    action: z.enum(["ready", "start", "kick", "transfer_host"]),
    targetId: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>
export type RoomActionPayload = z.infer<typeof RoomActionDef.payload>

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

export const RoomDeleteDef = {
  payload: z.object({ roomId: z.string() }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>

export const CustomizeTokenDef = {
  payload: z.object({
    action: z.enum(["list", "get", "upsert", "delete", "copy_preset"]),
    tokenId: z.string().optional(),
    token: InventoryTokenSchema.optional(),
    presetId: z.string().optional(),
  }),
  response: z.union([
    z.object({ ships: z.array(InventoryTokenSchema) }),
    z.object({ ship: InventoryTokenSchema }),
    VoidSchema,
  ]),
} as const satisfies WsEventDef<any, any>
export type CustomizeTokenPayload = z.infer<typeof CustomizeTokenDef.payload>

export const CustomizeWeaponDef = {
  payload: z.object({
    action: z.enum(["list", "get", "upsert", "delete", "copy_preset"]),
    weaponId: z.string().optional(),
    weapon: WeaponJSONSchema.optional(),
    presetId: z.string().optional(),
  }),
  response: z.union([
    z.object({ weapons: z.array(WeaponJSONSchema) }),
    z.object({ weapon: WeaponJSONSchema }),
    VoidSchema,
  ]),
} as const satisfies WsEventDef<any, any>
export type CustomizeWeaponPayload = z.infer<typeof CustomizeWeaponDef.payload>

// ============================================================
// save 命名空间
// ============================================================

const SaveBuildSchema = z.object({
  $id: z.string(),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  snapshot: GameRoomStateSchema,
  createdAt: z.number(),
  updatedAt: z.number().optional(),
})
export type SaveBuild = z.infer<typeof SaveBuildSchema>

export const SaveActionDef = {
  payload: z.object({
    action: z.enum(["list", "create", "load", "delete"]),
    saveId: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  response: z.union([
    z.object({ saves: z.array(SaveBuildSchema) }),
    z.object({ save: SaveBuildSchema }),
    VoidSchema,
  ]),
} as const satisfies WsEventDef<any, any>
export type SaveActionPayload = z.infer<typeof SaveActionDef.payload>

// ============================================================
// asset 命名空间
// ============================================================

export const AssetUploadDef = {
  payload: z.object({
    type: z.enum(["ship_texture", "weapon_texture"]),
    filename: z.string().min(1).max(255),
    mimeType: z.string(),
    data: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  response: z.object({ assetId: z.string() }),
} as const satisfies WsEventDef<any, any>

export const AssetActionDef = {
  payload: z.object({
    action: z.enum(["list", "batch_get", "delete"]),
    assetIds: z.array(z.string()).optional(),
    assetId: z.string().optional(),
    type: z.enum(["ship_texture", "weapon_texture"]).optional(),
    ownerId: z.string().optional(),
    includeData: z.boolean().optional(),
  }),
  response: z.union([
    z.object({ assets: z.array(AssetListItemSchema) }),
    z.object({
      results: z.array(z.object({
        assetId: z.string(),
        info: AssetListItemSchema.nullable(),
        data: z.string().optional(),
      }))
    }),
    VoidSchema,
  ]),
} as const satisfies WsEventDef<any, any>
export type AssetActionPayload = z.infer<typeof AssetActionDef.payload>

// ============================================================
// preset 命名空间
// ============================================================

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

// ============================================================
// game 命名空间
// ============================================================

/**
 * 游戏 Action 名称枚举 — 单一起源
 * 同时用于：
 * 1. Zod schema 验证（网络层）
 * 2. 服务端 ACTION_HANDLERS 类型约束
 * 3. 客户端可用 action 类型
 */
export const GAME_ACTION_NAMES = [
  "move", "rotate", "attack", "deviation",
  "shield_toggle", "shield_rotate", "vent",
  "end_turn", "advance_phase",
] as const;

export type GameActionName = typeof GAME_ACTION_NAMES[number];

export const GameActionDef = {
  payload: z.object({
    action: z.enum(GAME_ACTION_NAMES),
    tokenId: z.string(),
    forward: z.number().optional(),
    strafe: z.number().optional(),
    angle: z.number().optional(),
    active: z.boolean().optional(),
    direction: z.number().optional(),
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

export const GameQueryDef = {
  payload: z.object({
    type: z.enum(["targets", "movement", "ownership", "combat_state", "weapon_state"]),
    tokenId: z.string(),
    mountId: z.string().optional(),
  }),
  response: z.object({ result: z.any() }),
} as const satisfies WsEventDef<any, any>
export type GameQueryPayload = z.infer<typeof GameQueryDef.payload>

// ============================================================
// edit 命名空间（实例编辑，广播BattleLogEdit）
// ============================================================

export const EditTokenDef = {
  payload: z.object({
    action: z.enum(["modify", "remove", "heal", "damage", "restore", "reset", "rename"]),
    tokenId: z.string().optional(),
    token: CombatTokenSchema.optional(),
    path: z.string().optional(),
    value: z.any().optional(),
    amount: z.number().optional(),
    faction: FactionSchema.optional(),
    position: PointSchema.optional(),
    heading: z.number().optional(),
    reason: z.string().optional(),
    displayName: z.string().optional(),
  }),
  response: z.union([
    z.object({ tokenId: z.string(), displayName: z.string().optional() }),
    VoidSchema,
  ]),
} as const satisfies WsEventDef<any, any>
export type EditTokenPayload = z.infer<typeof EditTokenDef.payload>

export const EditRoomDef = {
  payload: z.object({
    action: z.enum(["set_modifier", "remove_modifier", "force_end_turn", "set_phase", "set_turn", "set_faction", "return_to_world"]),
    key: z.string().optional(),
    value: z.number().optional(),
    duration: z.number().optional(),
    faction: FactionSchema.optional(),
    phase: z.string().optional(),
    turn: z.number().optional(),
    playerId: z.string().optional(),
  }),
  response: VoidSchema,
} as const satisfies WsEventDef<any, any>
export type EditRoomPayload = z.infer<typeof EditRoomDef.payload>

// ============================================================
// deploy 命名空间（舰船部署，从预设创建实例）
// ============================================================

export const DeployTokenDef = {
  payload: z.object({
    preset: InventoryTokenSchema,
    position: PointSchema,
    heading: z.number().optional(),
    faction: FactionSchema.optional(),
  }),
  response: z.object({ tokenId: z.string(), displayName: z.string() }),
} as const satisfies WsEventDef<any, any>
export type DeployTokenPayload = z.infer<typeof DeployTokenDef.payload>

// ============================================================
// sync 命名空间（Patch 格式）
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

export const SyncRequestFullDef = {
  payload: EmptySchema,
  response: GameRoomStateSchema,
} as const satisfies WsEventDef<any, any>

// ============================================================
// BattleLog（战斗日志）
// ============================================================

export const BattleLogPayloadSchema = z.object({
  log: BattleLogEventSchema,
})
export type BattleLogPayload = z.infer<typeof BattleLogPayloadSchema>

// ============================================================
// world 命名空间（世界观地图操作）
// ============================================================

export const WorldTravelDef = {
  payload: z.object({ toNodeId: z.string() }),
  response: z.object({
    success: z.boolean(),
    worldMap: WorldMapSchema,
    currentNode: WorldNodeSchema.optional(),
    encounterTriggered: z.boolean().optional(),
    terrain: z.array(MapTerrainSchema).optional(),
    logEvent: TimelineEventSchema.optional(),
  }),
} as const satisfies WsEventDef<any, any>

export const WorldExploreDef = {
  payload: z.object({ nodeId: z.string() }),
  response: z.object({ success: z.boolean(), node: WorldNodeSchema }),
} as const satisfies WsEventDef<any, any>

export const WorldQueryDef = {
  payload: z.object({}),
  response: z.object({ worldMap: WorldMapSchema, stats: z.any() }),
} as const satisfies WsEventDef<any, any>

export const WorldManageDef = {
  payload: z.object({
    action: z.enum(["add_node", "remove_node", "update_node", "add_edge", "remove_edge", "update_edge"]),
    node: WorldNodeSchema.optional(),
    edge: WorldEdgeSchema.optional(),
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
  }),
  response: z.object({ success: z.boolean() }),
} as const satisfies WsEventDef<any, any>

// ============================================================
// WsEventDefinitions（合并后的接口）
// ============================================================

export const WsEventDefinitions = {
  "auth:login": AuthLoginDef,
  "auth:logout": AuthLogoutDef,
  "profile:get": ProfileGetDef,
  "profile:update": ProfileUpdateDef,
  "room:create": RoomCreateDef,
  "room:list": RoomListDef,
  "room:join": RoomJoinDef,
  "room:leave": RoomLeaveDef,
  "room:rejoin": RoomRejoinDef,
  "room:action": RoomActionDef,
  "room:get_assets": RoomGetAssetsDef,
  "room:delete": RoomDeleteDef,
  "customize:token": CustomizeTokenDef,
  "customize:weapon": CustomizeWeaponDef,
  "save:action": SaveActionDef,
  "asset:upload": AssetUploadDef,
  "asset:action": AssetActionDef,
  "preset:list_tokens": PresetListTokensDef,
  "preset:list_weapons": PresetListWeaponsDef,
  "preset:get_token": PresetGetTokenDef,
  "preset:get_weapon": PresetGetWeaponDef,
  "game:action": GameActionDef,
  "game:query": GameQueryDef,
  "edit:token": EditTokenDef,
  "edit:room": EditRoomDef,
  "deploy:token": DeployTokenDef,
  "world:travel": WorldTravelDef,
  "world:explore": WorldExploreDef,
  "world:query": WorldQueryDef,
  "world:manage": WorldManageDef,
  "sync:request_full": SyncRequestFullDef,
} as const satisfies Record<string, WsEventDef<any, any>>

export type WsEventName = keyof typeof WsEventDefinitions
export type WsPayload<E extends WsEventName> = ExtractPayload<(typeof WsEventDefinitions)[E]>
export type WsResponseData<E extends WsEventName> = ExtractResponse<(typeof WsEventDefinitions)[E]>

// ============================================================
// 辅助函数
// ============================================================

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

// Patch 工具函数
export function createPatch(op: PatchOp, path: (string | number)[], value?: unknown, old?: unknown): StatePatch {
  return { op, path, value, old }
}

export function createPatchPayload(patches: StatePatch[]): StatePatchPayload {
  return { patches, timestamp: Date.now() }
}

// ============================================================
// BattleLog 工具函数
// ============================================================

/**
 * 创建战斗日志事件。
 * 后端只存纯结构化数据，前端按 event type 匹配规则着色。
 * @param type 事件类型
 * @param data 结构化数据
 * @param timestamp 时间戳（默认当前时间）
 */
export function createBattleLogEvent(
  type: string,
  data: Record<string, unknown> = {},
  timestamp?: number
): BattleLogEvent {
  return { type, data, timestamp: timestamp ?? Date.now() }
}

// ============================================================
// 预设颜色常量
// ============================================================

export const LOG_COLORS = {
  ATTACK: "#e74c3c",
  ATTACK_ACCENT: "#ff6b6b",
  DEVIATION: "#f39c12",
  MOVE: "#3498db",
  SHIELD: "#2ecc71",
  SHIELD_ACCENT: "#27ae60",
  VENT: "#f1c40f",
  OVERLOAD: "#e74c3c",
  OVERLOAD_ACCENT: "#ff4444",
  DESTROYED: "#c0392b",
  PHASE: "#9b59b6",
  FACTION: "#9b59b6",
  SYSTEM: "#4fc3ff",
  SYSTEM_ACCENT: "#6b8aaa",
  EDIT: "#6b8aaa",
  DEPLOY: "#4fc3ff",
  PLAYER: "#4fc3ff",
  SHIP_NAME: "#ffffff",
  FACTION_PA: "#4a9eff",
  FACTION_FG: "#ff4a4a",
  GRAY: "#667788",
  WHITE: "#ffffff",
} as const

/** @deprecated 使用 createBattleLogEvent */
export function createBattleLogEdit(
  playerId: string,
  playerName: string,
  tokenId: string,
  tokenName: string,
  path: string,
  oldValue: unknown,
  newValue: unknown,
  reason?: string
): BattleLogEvent {
  return createBattleLogEvent("edit", {
    playerId, playerName, tokenId, tokenName, path, oldValue, newValue, reason,
  })
}

