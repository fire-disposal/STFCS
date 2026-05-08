/**
 * GameSchemas - 核心游戏业务 Zod Schema 定义
 *
 * 统一存放所有相互关联的游戏模型定义：
 * - 通用类型（Common）
 * - 枚举（Enums）
 * - 武器（Weapon）
 * - 舰船（Ship）
 * - 地图（Map）
 * - 房间/玩家状态（Room / PlayerState）
 * - 存档（Save）
 * - 玩家信息（PlayerInfo）
 * - 资产（Asset）
 *
 * 设计原则：
 * 1. 单一文件维护核心模型，避免跨文件依赖碎片化
 * 2. Zod Schema 即类型定义，从 Schema 推导 TypeScript 类型
 * 3. 枚举直接在 Zod 中定义，通过 .enum 提供运行时值对象
 * 4. 业务必填字段不设 .optional()，运行时默认值用 .default()
 */

import { z } from "zod";

// ============================================================
// 基础几何类型
// ============================================================

export const PointSchema = z.object({
	x: z.number(),
	y: z.number(),
});
export type Point = z.infer<typeof PointSchema>;

// ============================================================
// 通用枚举（Zod 内联定义 + 值对象导出）
// ============================================================

export const DamageTypeSchema = z.enum(["KINETIC", "HIGH_EXPLOSIVE", "ENERGY", "FRAGMENTATION"]);
export const DamageType = DamageTypeSchema.enum;
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const WeaponSlotSizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);
export const WeaponSlotSize = WeaponSlotSizeSchema.enum;
export type WeaponSlotSize = z.infer<typeof WeaponSlotSizeSchema>;

export const WeaponTagValues = ["EMP", "PD"] as const;
export const WeaponTagSchema = z.enum(WeaponTagValues);
export type WeaponTag = z.infer<typeof WeaponTagSchema>;

export const HullSizeSchema = z.enum(["FRIGATE", "DESTROYER", "CRUISER", "CAPITAL"]);
export const HullSize = HullSizeSchema.enum;
export type HullSize = z.infer<typeof HullSizeSchema>;

export const ShipClassSchema = z.enum(["STRIKE", "ASSAULT", "COMBAT", "SUPPORT", "HEAVY", "CARRIER", "BATTLESHIP"]);
export const ShipClass = ShipClassSchema.enum;
export type ShipClass = z.infer<typeof ShipClassSchema>;

export const WeaponStateSchema = z.enum(["READY", "COOLDOWN", "DISABLED", "FIRED"]);
export const WeaponState = WeaponStateSchema.enum;
export type WeaponState = z.infer<typeof WeaponStateSchema>;

export const ArmorQuadrantSchema = z.enum(["RF", "RR", "RB", "LB", "LL", "LF"]);
export const ArmorQuadrant = ArmorQuadrantSchema.enum;
export type ArmorQuadrant = z.infer<typeof ArmorQuadrantSchema>;

/**
 * 游戏阶段（GamePhase）- 顶层状态
 *
 * Phase ↔ activeFaction 对应规则：
 * - DEPLOYMENT: activeFaction = undefined（部署阶段不区分派系）
 * - PLAYER_ACTION: activeFaction 由 TURN_ORDER 决定（派系轮流行动）
 *
 * Phase 转换流程：
 * 1. DEPLOYMENT → PLAYER_ACTION（所有玩家准备好后，游戏开始）
 * 2. PLAYER_ACTION 内：TURN_ORDER 中的派系依次行动
 * 3. 最后一个派系行动完毕后 turn++，回到第一个派系
 *
 * 注意：phase 和 activeFaction 存在固定对应关系，
 * 修改 phase 时应同步更新 activeFaction。
 */
export const GamePhaseSchema = z.enum(["DEPLOYMENT", "PLAYER_ACTION", "FACTION_ACTION", "SETTLEMENT"]);
export const GamePhase = GamePhaseSchema.enum;
export type GamePhase = z.infer<typeof GamePhaseSchema>;

export const FactionSchema = z.enum(["PLAYER_ALLIANCE", "FATE_GRIP"]);
export const Faction = FactionSchema.enum;
export type Faction = z.infer<typeof FactionSchema>;

/**
 * 派系主题色映射（legacy，已由 FactionDef.color 替代）
 */
export const FactionColors: Record<Faction, number> = {
	[Faction.PLAYER_ALLIANCE]: 0x4a9eff,
	[Faction.FATE_GRIP]: 0xff4a4a,
};

export const PlayerRoleSchema = z.enum(["HOST", "PLAYER"]);
export const PlayerRole = PlayerRoleSchema.enum;
export type PlayerRole = z.infer<typeof PlayerRoleSchema>;

export const MovementPhaseSchema = z.enum(["A", "B", "C", "DONE"]);
export const MovementPhase = MovementPhaseSchema.enum;
export type MovementPhase = z.infer<typeof MovementPhaseSchema>;

// ============================================================
// 通用类型
// ============================================================



export const TextureSchema = z.object({
	assetId: z.string().optional(),
	offsetX: z.number().optional(),
	offsetY: z.number().optional(),
	scale: z.number().optional(),
});
export type Texture = z.infer<typeof TextureSchema>;

export const MetadataSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	author: z.string().optional(),
	createdAt: z.number().optional(),
	updatedAt: z.number().optional(),
	tags: z.array(z.string()).optional(),
	owner: z.string().optional(),
	isPresetCopy: z.boolean().optional(),
	originalPresetId: z.string().optional(),
});
export type Metadata = z.infer<typeof MetadataSchema>;

// ============================================================
// 派系定义（实体化，替代硬编码枚举）
// ============================================================

export const FactionDefSchema = z.object({
	$id: z.string(),
	name: z.string(),
	color: z.string(),
	flagAssetId: z.string().optional(),
});
export type FactionDef = z.infer<typeof FactionDefSchema>;

// ============================================================
// 武器类型
// ============================================================

export const StatusEffectSchema = z.object({
	id: z.string(),
	type: z.string(),
	source: z.string().optional(),
	duration: z.number().optional(),
	stackCount: z.number().optional(),
	data: z.record(z.string(), z.unknown()).optional(),
});
export type StatusEffect = z.infer<typeof StatusEffectSchema>;

export const WeaponSpecSchema = z.object({
	damageType: DamageTypeSchema,
	size: WeaponSlotSizeSchema,
	damage: z.number().default(0),
	emp: z.number().optional(),
	projectilesPerShot: z.number().optional(),
	range: z.number(),
	minRange: z.number().optional(),
	cooldown: z.number().optional(),
	fluxCostPerShot: z.number(),
	allowsMultipleTargets: z.boolean().optional(),
	burstCount: z.number().optional(),
	opCost: z.number().optional(),
	tags: z.array(WeaponTagSchema).optional(),
	texture: TextureSchema.optional(),
});
export type WeaponSpec = z.infer<typeof WeaponSpecSchema>;

export const WeaponRuntimeSchema = z.object({
	mountId: z.string(),
	state: WeaponStateSchema,
	cooldownRemaining: z.number().optional(),
	currentHeading: z.number().optional(),
	statusEffects: z.array(StatusEffectSchema).optional(),
});
export type WeaponRuntime = z.infer<typeof WeaponRuntimeSchema>;

export const WeaponJSONSchema = z.object({
	$id: z.string(),
	spec: WeaponSpecSchema,
	runtime: WeaponRuntimeSchema.optional(),
	metadata: MetadataSchema.optional(),
});
export type WeaponJSON = z.infer<typeof WeaponJSONSchema>;

// ============================================================
// 舰船类型
// ============================================================

export const ShieldSpecSchema = z.object({
	arc: z.number().min(0).max(360),
	radius: z.number().min(0),
	efficiency: z.number().min(0).default(1.0),
	upkeep: z.number().min(0).default(0),
	fixed: z.boolean().optional(),
});
export type ShieldSpec = z.infer<typeof ShieldSpecSchema>;

export const MountSpecSchema = z.object({
	id: z.string(),
	displayName: z.string().optional(),
	position: PointSchema,
	facing: z.number().optional(),
	arc: z.number().min(0).max(360).default(360),
	size: WeaponSlotSizeSchema,
	weapon: WeaponJSONSchema.optional(),
	group: z.string().optional(),
});
export type MountSpec = z.infer<typeof MountSpecSchema>;

export const PluginSlotSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
});
export type PluginSlot = z.infer<typeof PluginSlotSchema>;

export const TokenSpecSchema = z.object({
	size: HullSizeSchema,
	class: ShipClassSchema,
	width: z.number().min(10).optional(),
	length: z.number().min(10).optional(),
	maxHitPoints: z.number().min(0),
	armorMaxPerQuadrant: z.number().min(0),
	armorMinReduction: z.number().min(0).max(1).default(0.1),
	armorMaxReduction: z.number().min(0).max(1).default(0.85),
	fluxCapacity: z.number().min(0).optional(),
	fluxDissipation: z.number().min(0).optional(),
	shield: ShieldSpecSchema.optional(),
	maxSpeed: z.number().min(0),
	maxTurnRate: z.number().min(0),
	mounts: z.array(MountSpecSchema).optional(),
	plugins: z.array(PluginSlotSchema).optional(),
	rangeModifier: z.number().default(1.0),
	texture: TextureSchema.optional(),
});
export type TokenSpec = z.infer<typeof TokenSpecSchema>;

export const TranslationLockSchema = z.enum(["FORWARD_BACKWARD", "LEFT_RIGHT"]).nullable();
export type TranslationLock = z.infer<typeof TranslationLockSchema>;

export const MovementStateSchema = z.object({
	currentPhase: MovementPhaseSchema.optional(),
	phaseAUsed: z.number().min(0).optional(),
	turnAngleUsed: z.number().min(0).optional(),
	phaseCUsed: z.number().min(0).optional(),
	phaseALock: TranslationLockSchema.optional(),
	phaseCLock: TranslationLockSchema.optional(),
	hasMoved: z.boolean().optional(),
});
export type MovementState = z.infer<typeof MovementStateSchema>;

// Token修正（BUFF/倍率）
export const TokenModifierSchema = z.object({
	id: z.string(),
	source: z.string(), // 来源标识
	stat: z.enum([
		"damageTaken",      // 受到伤害倍率（易伤/减伤）
		"damageDealt",      // 造成伤害倍率（增伤/减伤）
		"speed",            // 航速倍率
		"turnRate",         // 转向速度倍率
		"shieldEfficiency", // 护盾效率倍率
		"fluxDissipation",  // 辐散倍率
		"armorEffectiveness",// 护甲效能倍率
		"range",            // 武器射程倍率
		"accuracy",         // 命中率修正（加法）
	]),
	value: z.number(),    // 倍率值。1.0 = 无变化，1.5 = +50%，0.5 = -50%
	operation: z.enum(["multiply", "add"]).default("multiply"),
	stacks: z.boolean().default(false),
	stackKey: z.string().optional(), // 不可叠加时的标识键
	/** 持续回合数。999 = 永久，具体数值 = 限时 */
	duration: z.number().default(999),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TokenModifier = z.infer<typeof TokenModifierSchema>;

export const TokenRuntimeSchema = z.object({
	position: PointSchema,
	heading: z.number(),
	hull: z.number().min(0),
	armor: z.array(z.number().min(0)).length(6),
	fluxSoft: z.number().min(0).optional(),
	fluxHard: z.number().min(0).optional(),
	shield: z.object({ active: z.boolean(), direction: z.number().min(0).max(360).optional() }).optional(),
	overloaded: z.boolean().default(false),
	overloadTime: z.number().min(0).default(1),
	destroyed: z.boolean().default(false),
	movement: MovementStateSchema.optional(),
	hasFired: z.boolean().optional(),
	weapons: z.array(WeaponRuntimeSchema).optional(),
	modifiers: z.array(TokenModifierSchema).optional(),
	actionSequence: z.number().default(0),
	faction: z.string().optional(),
	ownerId: z.string().optional(),
	venting: z.boolean().optional(),
	displayName: z.string().optional(),
});
export type TokenRuntime = z.infer<typeof TokenRuntimeSchema>;

// ============================================================
// Token分层：库存配置 vs 战斗实例
// ============================================================

/**
 * 库存Token - 用户保存的舰船配置
 * 不含runtime，持久化到数据库时只保存这部分
 */
const TokenBaseSchema = z.object({
	$id: z.string(),
	$presetRef: z.string().optional(),
	spec: TokenSpecSchema,
	metadata: MetadataSchema,
});

export const InventoryTokenSchema = TokenBaseSchema;
export type InventoryToken = z.infer<typeof InventoryTokenSchema>;

export const CombatTokenSchema = TokenBaseSchema.extend({
	runtime: TokenRuntimeSchema,
});
export type CombatToken = z.infer<typeof CombatTokenSchema>;

// ============================================================
// 地图类型
// ============================================================

export const MapSizeSchema = z.object({
	width: z.number(),
	height: z.number(),
});
export type MapSize = z.infer<typeof MapSizeSchema>;

export const MapTerrainSchema = z.object({
	id: z.string(),
	type: z.enum(["asteroid", "nebula", "station", "debris"]),
	position: PointSchema,
	size: z.number(),
	rotation: z.number().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type MapTerrain = z.infer<typeof MapTerrainSchema>;

export const GameMapSchema = z.object({
	$id: z.string(),
	name: z.string(),
	size: MapSizeSchema,
	terrain: z.array(MapTerrainSchema).optional(),
	background: z.string().optional(),
	metadata: MetadataSchema,
});
export type GameMap = z.infer<typeof GameMapSchema>;

// ============================================================
// 房间 / 玩家状态（新增，用于前后端共享房间模型）
// ============================================================

export const RoomPlayerStateSchema = z.object({
	sessionId: z.string(),
	shortId: z.number().optional(),
	nickname: z.string(),
	role: PlayerRoleSchema,
	faction: z.string().optional(),
	isReady: z.boolean().default(false),
	connected: z.boolean().default(true),
	tokenIds: z.array(z.string()).optional(),
	avatar: z.string().optional(),
	avatarAssetId: z.string().optional(),
});
export type RoomPlayerState = z.infer<typeof RoomPlayerStateSchema>;

// ============================================================
// 战斗日志
// ============================================================

export const BattleLogEventSchema = z.object({
	type: z.string(),
	timestamp: z.number(),
	data: z.record(z.string(), z.unknown()).default({}),
});
export type BattleLogEvent = z.infer<typeof BattleLogEventSchema>;

/**
 * 游戏房间状态
 *
 * 重要：phase 和 activeFaction 存在固定对应关系
 * 修改 phase 时必须同步更新 activeFaction：
 * - phase="DEPLOYMENT" → activeFaction=undefined
 * - phase="PLAYER_ACTION" → activeFaction 由 TURN_ORDER 决定（派系轮流行动）
 */
export const GameRoomStateSchema = z.object({
	roomId: z.string(),
	name: z.string().optional(),
	ownerId: z.string(),
	phase: GamePhaseSchema,
	turnCount: z.number().default(0),
	activeFaction: z.string().optional(),
	factions: z.record(z.string(), FactionDefSchema).optional(),
	initiativeOrder: z.array(z.string()).optional(),
	initiativeIndex: z.number().optional(),
	players: z.record(z.string(), RoomPlayerStateSchema),
	tokens: z.record(z.string(), CombatTokenSchema),
	map: GameMapSchema.optional(),
	globalModifiers: z.record(z.string(), z.number()).optional(),
	logs: z.array(BattleLogEventSchema).default([]),
	createdAt: z.number(),
});
export type GameRoomState = z.infer<typeof GameRoomStateSchema>;

// ============================================================
// 玩家信息
// ============================================================

export const PlayerInfoSchema = z.object({
	playerId: z.string(),
	username: z.string(),
	displayName: z.string(),
	avatar: z.string().nullable(),
	stats: z.object({
		gamesPlayed: z.number(),
		wins: z.number(),
		totalDamage: z.number(),
	}),
	createdAt: z.number(),
	updatedAt: z.number(),
	lastLogin: z.number().optional(),
});
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
export const validatePlayerInfo = (data: unknown): PlayerInfo => PlayerInfoSchema.parse(data);

// ============================================================
// 存档类型
// ============================================================

export const SaveMetadataSchema = MetadataSchema.pick({
	name: true,
	description: true,
	tags: true,
	createdAt: true,
	updatedAt: true,
}).extend({
	version: z.string().optional(),
	thumbnail: z.string().optional(),
	roomId: z.string().optional(),
});
export type SaveMetadata = z.infer<typeof SaveMetadataSchema>;

export const GameSaveSchema = z.object({
	$id: z.string(),
	metadata: SaveMetadataSchema,
	snapshot: GameRoomStateSchema,
	createdAt: z.number(),
	updatedAt: z.number().optional(),
});
export type GameSave = z.infer<typeof GameSaveSchema>;

// ============================================================
// 资产类型（简化：所有资产公开）
// ============================================================

export const AssetTypeSchema = z.enum(["ship_texture", "weapon_texture", "faction_flag"]);
export const AssetType = AssetTypeSchema.enum;
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
	$id: z.string(),
	type: AssetTypeSchema,
	filename: z.string(),
	mimeType: z.string(),
	size: z.number(),
	metadata: z.object({
		name: z.string().optional(),
		description: z.string().optional(),
		tags: z.array(z.string()).optional(),
		width: z.number().optional(),
		height: z.number().optional(),
	}).optional(),
	ownerId: z.string(),
	uploadedAt: z.number(),
	updatedAt: z.number().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetListItemSchema = AssetSchema; // 语义别名：列表项与完整资产结构相同
export type AssetListItem = z.infer<typeof AssetListItemSchema>;

export const AssetFilterSchema = z.object({
	type: z.union([AssetTypeSchema, z.array(AssetTypeSchema)]).optional(),
	ownerId: z.string().optional(),
	tags: z.array(z.string()).optional(),
	search: z.string().optional(),
	sharedWith: z.string().optional(),
	sortBy: z.enum(["uploadedAt", "updatedAt", "filename", "size"]).optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
});
export type AssetFilter = z.infer<typeof AssetFilterSchema>;

export const RoomArchiveMetadataSchema = z.object({
	roomId: z.string(),
	roomName: z.string(),
	mapWidth: z.number(),
	mapHeight: z.number(),
	maxPlayers: z.number(),
	playerCount: z.number(),
	totalTurns: z.number(),
	winnerFaction: z.string().optional(),
	gameDuration: z.number(),
});
export type RoomArchiveMetadata = z.infer<typeof RoomArchiveMetadataSchema>;

export const RoomArchiveSchema = z.object({
	$id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	saveJson: GameSaveSchema,
	metadata: RoomArchiveMetadataSchema,
	playerIds: z.array(z.string()),
	isAutoSave: z.boolean(),
	tags: z.array(z.string()),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type RoomArchive = z.infer<typeof RoomArchiveSchema>;
