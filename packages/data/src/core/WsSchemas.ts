/**
 * 统一 WebSocket 事件 Schema
 *
 * 全WebSocket方案，所有操作通过 Socket.IO 完成
 * 命名空间格式: {namespace}:{action}
 * 所有请求带 requestId，所有响应匹配 requestId
 */

import { z } from "zod";
import { 
	GamePhaseSchema, 
	FactionSchema,
	TokenJSONSchema,
	WeaponJSONSchema,
	GameSaveSchema,
	RoomPlayerStateSchema,
	GameRoomStateSchema,
	PointSchema,
} from "./GameSchemas.js";

// ============================================================
// 基础协议
// ============================================================

/** 所有请求必须携带 requestId */
export const WsRequestSchema = z.object({
	requestId: z.string(),
	payload: z.any(),
});
export type WsRequest = z.infer<typeof WsRequestSchema>;

/** 所有响应必须匹配 requestId */
export const WsResponseSchema = z.object({
	requestId: z.string(),
	success: z.boolean(),
	data: z.any().optional(),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}).optional(),
});
export type WsResponse = z.infer<typeof WsResponseSchema>;

/** 服务端广播事件 */
export const WsBroadcastSchema = z.object({
	type: z.string(),
	timestamp: z.number(),
	payload: z.any(),
});
export type WsBroadcast = z.infer<typeof WsBroadcastSchema>;

// ============================================================
// auth namespace
// ============================================================

export const AuthLoginPayloadSchema = z.object({
	playerName: z.string().min(1).max(50),
});
export type AuthLoginPayload = z.infer<typeof AuthLoginPayloadSchema>;

export const AuthLoginResponseSchema = z.object({
	playerId: z.string(),
	playerName: z.string(),
	isHost: z.boolean(),
	role: z.enum(["HOST", "PLAYER"]),
});
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;

// ============================================================
// room namespace
// ============================================================

export const RoomCreatePayloadSchema = z.object({
	name: z.string().min(1).max(100),
	maxPlayers: z.number().min(1).max(8).optional(),
	mapWidth: z.number().min(500).optional(),
	mapHeight: z.number().min(500).optional(),
});
export type RoomCreatePayload = z.infer<typeof RoomCreatePayloadSchema>;

export const RoomJoinPayloadSchema = z.object({
	roomId: z.string(),
});
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

export const RoomActionPayloadSchema = z.object({
	action: z.enum(["ready", "start", "kick", "transfer_host"]),
	targetId: z.string().optional(),
});
export type RoomActionPayload = z.infer<typeof RoomActionPayloadSchema>;

export const RoomInfoSchema = z.object({
	roomId: z.string(),
	name: z.string(),
	playerCount: z.number(),
	maxPlayers: z.number(),
	phase: GamePhaseSchema,
	turnCount: z.number(),
	ownerId: z.string(),
	createdAt: z.number(),
});
export type RoomInfo = z.infer<typeof RoomInfoSchema>;

// ============================================================
// token namespace (档案管理)
// ============================================================

export const TokenListPayloadSchema = z.object({});
export type TokenListPayload = z.infer<typeof TokenListPayloadSchema>;

export const TokenGetPayloadSchema = z.object({
	tokenId: z.string(),
});
export type TokenGetPayload = z.infer<typeof TokenGetPayloadSchema>;

export const TokenCreatePayloadSchema = z.object({
	token: TokenJSONSchema,
});
export type TokenCreatePayload = z.infer<typeof TokenCreatePayloadSchema>;

export const TokenUpdatePayloadSchema = z.object({
	tokenId: z.string(),
	updates: z.record(z.string(), z.any()),
});
export type TokenUpdatePayload = z.infer<typeof TokenUpdatePayloadSchema>;

export const TokenDeletePayloadSchema = z.object({
	tokenId: z.string(),
});
export type TokenDeletePayload = z.infer<typeof TokenDeletePayloadSchema>;

export const TokenCopyPresetPayloadSchema = z.object({
	presetId: z.string(),
});
export type TokenCopyPresetPayload = z.infer<typeof TokenCopyPresetPayloadSchema>;

export const TokenMountPayloadSchema = z.object({
	tokenId: z.string(),
	mountId: z.string(),
	weaponId: z.string().nullable(),
});
export type TokenMountPayload = z.infer<typeof TokenMountPayloadSchema>;

// ============================================================
// weapon namespace
// ============================================================

export const WeaponListPayloadSchema = z.object({});
export type WeaponListPayload = z.infer<typeof WeaponListPayloadSchema>;

export const WeaponGetPayloadSchema = z.object({
	weaponId: z.string(),
});
export type WeaponGetPayload = z.infer<typeof WeaponGetPayloadSchema>;

export const WeaponCreatePayloadSchema = z.object({
	weapon: WeaponJSONSchema,
});
export type WeaponCreatePayload = z.infer<typeof WeaponCreatePayloadSchema>;

export const WeaponUpdatePayloadSchema = z.object({
	weaponId: z.string(),
	updates: z.record(z.string(), z.any()),
});
export type WeaponUpdatePayload = z.infer<typeof WeaponUpdatePayloadSchema>;

export const WeaponDeletePayloadSchema = z.object({
	weaponId: z.string(),
});
export type WeaponDeletePayload = z.infer<typeof WeaponDeletePayloadSchema>;

export const WeaponCopyPresetPayloadSchema = z.object({
	presetId: z.string(),
});
export type WeaponCopyPresetPayload = z.infer<typeof WeaponCopyPresetPayloadSchema>;

// ============================================================
// save namespace
// ============================================================

export const SaveListPayloadSchema = z.object({});
export type SaveListPayload = z.infer<typeof SaveListPayloadSchema>;

export const SaveCreatePayloadSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
});
export type SaveCreatePayload = z.infer<typeof SaveCreatePayloadSchema>;

export const SaveLoadPayloadSchema = z.object({
	saveId: z.string(),
});
export type SaveLoadPayload = z.infer<typeof SaveLoadPayloadSchema>;

export const SaveDeletePayloadSchema = z.object({
	saveId: z.string(),
});
export type SaveDeletePayload = z.infer<typeof SaveDeletePayloadSchema>;

// ============================================================
// asset namespace - 资产管理（头像、舰船贴图、武器贴图，全部公开）
// ============================================================

export const AssetUploadPayloadSchema = z.object({
	type: z.enum(["avatar", "ship_texture", "weapon_texture"]),
	filename: z.string().min(1).max(255),
	mimeType: z.string(), // 具体验证在服务端根据类型进行
	data: z.string(), // base64 encoded
	name: z.string().optional(),
	description: z.string().optional(),
});
export type AssetUploadPayload = z.infer<typeof AssetUploadPayloadSchema>;

export const AssetListPayloadSchema = z.object({
	type: z.enum(["avatar", "ship_texture", "weapon_texture"]).optional(),
	ownerId: z.string().optional(), // 留空则返回所有公开资产
});
export type AssetListPayload = z.infer<typeof AssetListPayloadSchema>;

export const AssetBatchGetPayloadSchema = z.object({
	assetIds: z.array(z.string()).min(1),
	includeData: z.boolean().optional(),
});
export type AssetBatchGetPayload = z.infer<typeof AssetBatchGetPayloadSchema>;

export const AssetDeletePayloadSchema = z.object({
	assetId: z.string(),
});
export type AssetDeletePayload = z.infer<typeof AssetDeletePayloadSchema>;

export const RoomGetAssetsPayloadSchema = z.object({
	includeData: z.boolean().optional(),
});
export type RoomGetAssetsPayload = z.infer<typeof RoomGetAssetsPayloadSchema>;

// ============================================================
// preset namespace
// ============================================================

export const PresetListTokensPayloadSchema = z.object({
	size: z.string().optional(),
	class: z.string().optional(),
});
export type PresetListTokensPayload = z.infer<typeof PresetListTokensPayloadSchema>;

export const PresetListWeaponsPayloadSchema = z.object({
	size: z.string().optional(),
	damageType: z.string().optional(),
});
export type PresetListWeaponsPayload = z.infer<typeof PresetListWeaponsPayloadSchema>;

export const PresetGetPayloadSchema = z.object({
	presetId: z.string(),
});
export type PresetGetPayload = z.infer<typeof PresetGetPayloadSchema>;

// ============================================================
// game namespace
// ============================================================

export const GameActionPayloadSchema = z.object({
	action: z.enum([
		"move", "rotate", "attack", "shield", 
		"vent", "end_turn", "advance_phase"
	]),
	tokenId: z.string(),
	// action-specific fields
	forward: z.number().optional(),
	strafe: z.number().optional(),
	angle: z.number().optional(),
	active: z.boolean().optional(),
	allocations: z.array(z.object({
		mountId: z.string(),
		targets: z.array(z.object({
			targetId: z.string(),
			shots: z.number(),
			quadrant: z.number().optional(),
		})),
	})).optional(),
});
export type GameActionPayload = z.infer<typeof GameActionPayloadSchema>;

export const GameQueryPayloadSchema = z.object({
	type: z.enum(["targets", "movement", "ownership", "combat_state"]),
	tokenId: z.string(),
});
export type GameQueryPayload = z.infer<typeof GameQueryPayloadSchema>;

// ============================================================
// dm namespace (房主特权)
// ============================================================

export const DmSpawnPayloadSchema = z.object({
	token: TokenJSONSchema,
	faction: FactionSchema,
	position: PointSchema.optional(),
});
export type DmSpawnPayload = z.infer<typeof DmSpawnPayloadSchema>;

export const DmModifyPayloadSchema = z.object({
	tokenId: z.string(),
	field: z.string(),
	value: z.any(),
});
export type DmModifyPayload = z.infer<typeof DmModifyPayloadSchema>;

export const DmRemovePayloadSchema = z.object({
	tokenId: z.string(),
});
export type DmRemovePayload = z.infer<typeof DmRemovePayloadSchema>;

export const DmSetModifierPayloadSchema = z.object({
	key: z.string(),
	value: z.number(),
	duration: z.number().optional(),
});
export type DmSetModifierPayload = z.infer<typeof DmSetModifierPayloadSchema>;

export const DmForceEndTurnPayloadSchema = z.object({
	faction: FactionSchema.optional(),
});
export type DmForceEndTurnPayload = z.infer<typeof DmForceEndTurnPayloadSchema>;

// ============================================================
// sync namespace
// ============================================================

export const SyncRequestFullPayloadSchema = z.object({});
export type SyncRequestFullPayload = z.infer<typeof SyncRequestFullPayloadSchema>;

// ============================================================
// 增量同步类型
// ============================================================

export const DeltaTypeSchema = z.enum([
	"token_update",
	"token_add",
	"token_remove",
	"token_destroyed",
	"player_update",
	"player_join",
	"player_leave",
	"host_change",
	"phase_change",
	"turn_change",
	"faction_turn",
	"modifier_add",
	"modifier_remove",
]);
export type DeltaType = z.infer<typeof DeltaTypeSchema>;

export const DeltaChangeSchema = z.object({
	type: DeltaTypeSchema,
	id: z.string().optional(),
	field: z.string().optional(),
	value: z.any().optional(),
	oldValue: z.any().optional(),
});
export type DeltaChange = z.infer<typeof DeltaChangeSchema>;

export const SyncDeltaPayloadSchema = z.object({
	timestamp: z.number(),
	changes: z.array(DeltaChangeSchema),
});
export type SyncDeltaPayload = z.infer<typeof SyncDeltaPayloadSchema>;

// ============================================================
// 游戏事件广播
// ============================================================

export const GameEventTypeSchema = z.enum([
	"attack_result",
	"damage_log",
	"token_destroyed",
	"flux_critical",
	"overloaded",
	"shield_break",
	"turn_summary",
]);
export type GameEventType = z.infer<typeof GameEventTypeSchema>;

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
});
export type SyncEventPayload = z.infer<typeof SyncEventPayloadSchema>;

// ============================================================
// profile namespace
// ============================================================

export const ProfileUpdatePayloadSchema = z.object({
	nickname: z.string().optional(),
	avatar: z.string().optional(),
});
export type ProfileUpdatePayload = z.infer<typeof ProfileUpdatePayloadSchema>;

// ============================================================
// 事件Schema映射（用于验证）
// ============================================================

export const WsEventMap = {
	// auth
	"auth:login": AuthLoginPayloadSchema,
	"auth:logout": z.object({}),
	
	// profile
	"profile:get": z.object({}),
	"profile:update": ProfileUpdatePayloadSchema,
	
	// room
	"room:create": RoomCreatePayloadSchema,
	"room:list": z.object({}),
	"room:join": RoomJoinPayloadSchema,
	"room:leave": z.object({}),
	"room:action": RoomActionPayloadSchema,
	
	// token
	"token:list": TokenListPayloadSchema,
	"token:get": TokenGetPayloadSchema,
	"token:create": TokenCreatePayloadSchema,
	"token:update": TokenUpdatePayloadSchema,
	"token:delete": TokenDeletePayloadSchema,
	"token:copy_preset": TokenCopyPresetPayloadSchema,
	"token:mount": TokenMountPayloadSchema,
	
	// weapon
	"weapon:list": WeaponListPayloadSchema,
	"weapon:get": WeaponGetPayloadSchema,
	"weapon:create": WeaponCreatePayloadSchema,
	"weapon:update": WeaponUpdatePayloadSchema,
	"weapon:delete": WeaponDeletePayloadSchema,
	"weapon:copy_preset": WeaponCopyPresetPayloadSchema,
	
	// save
	"save:list": SaveListPayloadSchema,
	"save:create": SaveCreatePayloadSchema,
	"save:load": SaveLoadPayloadSchema,
	"save:delete": SaveDeletePayloadSchema,
	
	// asset
	"asset:upload": AssetUploadPayloadSchema,
	"asset:list": AssetListPayloadSchema,
	"asset:batch_get": AssetBatchGetPayloadSchema,
	"asset:delete": AssetDeletePayloadSchema,
	
	// room
	"room:get_assets": RoomGetAssetsPayloadSchema,
	
	// preset
	"preset:list_tokens": PresetListTokensPayloadSchema,
	"preset:list_weapons": PresetListWeaponsPayloadSchema,
	"preset:get_token": PresetGetPayloadSchema,
	"preset:get_weapon": PresetGetPayloadSchema,
	
	// game
	"game:action": GameActionPayloadSchema,
	"game:query": GameQueryPayloadSchema,
	
	// dm
	"dm:spawn": DmSpawnPayloadSchema,
	"dm:modify": DmModifyPayloadSchema,
	"dm:remove": DmRemovePayloadSchema,
	"dm:set_modifier": DmSetModifierPayloadSchema,
	"dm:force_end_turn": DmForceEndTurnPayloadSchema,
	
	// sync
	"sync:request_full": SyncRequestFullPayloadSchema,
} as const;

export type WsEventName = keyof typeof WsEventMap;

// ============================================================
// 验证函数
// ============================================================

export function validateWsPayload(
	event: WsEventName,
	payload: unknown
): { success: true; data: unknown } | { success: false; error: string } {
	const schema = WsEventMap[event];
	if (!schema) {
		return { success: false, error: `Unknown event: ${event}` };
	}
	
	const result = schema.safeParse(payload);
	if (result.success) {
		return { success: true, data: result.data };
	} else {
		return { success: false, error: result.error.message };
	}
}

export function createWsResponse<T>(
	requestId: string,
	success: boolean,
	data?: T,
	error?: { code: string; message: string }
): WsResponse {
	return { requestId, success, data, error };
}

export function createWsBroadcast(
	type: string,
	payload: unknown
): WsBroadcast {
	return { type, timestamp: Date.now(), payload };
}

export function createSyncDelta(
	changes: DeltaChange[]
): SyncDeltaPayload {
	return { timestamp: Date.now(), changes };
}

// ============================================================
// 增量变更构建器
// ============================================================

export function deltaTokenUpdate(tokenId: string, field: string, value: unknown, oldValue?: unknown): DeltaChange {
	return { type: "token_update", id: tokenId, field, value, oldValue };
}

export function deltaTokenAdd(tokenId: string, token: unknown): DeltaChange {
	return { type: "token_add", id: tokenId, value: token };
}

export function deltaTokenRemove(tokenId: string): DeltaChange {
	return { type: "token_remove", id: tokenId };
}

export function deltaTokenDestroyed(tokenId: string): DeltaChange {
	return { type: "token_destroyed", id: tokenId };
}

export function deltaPlayerUpdate(playerId: string, player: unknown): DeltaChange {
	return { type: "player_update", id: playerId, value: player };
}

export function deltaPlayerJoin(playerId: string, player: unknown): DeltaChange {
	return { type: "player_join", id: playerId, value: player };
}

export function deltaPlayerLeave(playerId: string): DeltaChange {
	return { type: "player_leave", id: playerId };
}

export function deltaHostChange(newOwnerId: string): DeltaChange {
	return { type: "host_change", value: newOwnerId };
}

export function deltaPhaseChange(phase: string): DeltaChange {
	return { type: "phase_change", value: phase };
}

export function deltaTurnChange(turn: number): DeltaChange {
	return { type: "turn_change", value: turn };
}

export function deltaFactionTurn(faction: string): DeltaChange {
	return { type: "faction_turn", value: faction };
}

export function deltaModifierAdd(key: string, value: number): DeltaChange {
	return { type: "modifier_add", field: key, value };
}

export function deltaModifierRemove(key: string): DeltaChange {
	return { type: "modifier_remove", field: key };
}