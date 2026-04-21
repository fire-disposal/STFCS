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
 * - 玩家档案（PlayerProfile）
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

export const WeaponTagSchema = z.enum([
	"ANTI_SHIP",
	"PD",
	"GUIDED",
	"BALLISTIC",
	"ENERGY",
	"HE",
	"BEAM",
	"SUPPRESSION",
]);
export const WeaponTag = WeaponTagSchema.enum;
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

export const GamePhaseSchema = z.enum(["DEPLOYMENT", "PLAYER_ACTION", "DM_ACTION", "TURN_END"]);
export const GamePhase = GamePhaseSchema.enum;
export type GamePhase = z.infer<typeof GamePhaseSchema>;

export const FactionSchema = z.enum(["PLAYER", "ENEMY", "NEUTRAL"]);
export const Faction = FactionSchema.enum;
export type Faction = z.infer<typeof FactionSchema>;

export const PlayerRoleSchema = z.enum(["HOST", "PLAYER"]);
export const PlayerRole = PlayerRoleSchema.enum;
export type PlayerRole = z.infer<typeof PlayerRoleSchema>;

export const FluxStateSchema = z.enum(["NORMAL", "HIGH", "OVERLOADED", "VENTING"]);
export const FluxState = FluxStateSchema.enum;
export type FluxState = z.infer<typeof FluxStateSchema>;

export const ShieldTypeSchema = z.enum(["OMNI", "FRONT", "NONE"]);
export const ShieldType = ShieldTypeSchema.enum;
export type ShieldType = z.infer<typeof ShieldTypeSchema>;

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
// 武器类型
// ============================================================

export const StatusEffectSchema = z.object({
	id: z.string(),
	type: z.string(),
	source: z.string().optional(),
	duration: z.number().optional(),
	stackCount: z.number().optional(),
	data: z.record(z.string(), z.any()).optional(),
});
export type StatusEffect = z.infer<typeof StatusEffectSchema>;

export const WeaponSpecSchema = z.object({
	damageType: DamageTypeSchema,
	size: WeaponSlotSizeSchema,
	damage: z.number(),
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
	currentHeading: z.number().optional(),  // 当前指向角度（渲染用，开火时更新）
	statusEffects: z.array(StatusEffectSchema).optional(),
	weapon: WeaponSpecSchema.optional(),
});
export type WeaponRuntime = z.infer<typeof WeaponRuntimeSchema>;

export const WeaponJSONSchema = z.object({
	$schema: z.literal("weapon-v2"),
	$id: z.string(),
	weapon: WeaponSpecSchema,
	runtime: WeaponRuntimeSchema.optional(),
	metadata: MetadataSchema.optional(),
});
export type WeaponJSON = z.infer<typeof WeaponJSONSchema>;

// ============================================================
// 舰船类型
// ============================================================

export const ShieldSpecSchema = z.object({
	type: ShieldTypeSchema,
	arc: z.number().min(0).max(360),
	direction: z.number().min(0).max(360).default(0),
	radius: z.number().min(0),
	efficiency: z.number().min(0).default(1.0),
	upkeep: z.number().min(0).default(0),
});
export type ShieldSpec = z.infer<typeof ShieldSpecSchema>;

export const MountSpecSchema = z.object({
	id: z.string(),
	displayName: z.string().optional(),
	position: PointSchema,
	/** 射界中心方向（度），0 = 船头正前方 */
	facing: z.number().optional(),
	/** 射界角度（度）。360 = 全向炮塔，20 = 固定挂载（左右各10°） */
	arc: z.number().min(0).max(360).default(360),
	size: WeaponSlotSizeSchema,
	weapon: z.union([WeaponJSONSchema, z.string()]).optional(),
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
/** @deprecated 使用 TokenSpec */
export type ShipSpec = TokenSpec;

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
	metadata: z.record(z.string(), z.any()).optional(),
});
export type TokenModifier = z.infer<typeof TokenModifierSchema>;
/** @deprecated 使用 TokenModifier */
export type ShipModifier = TokenModifier;

// ============================================================
// 预定义修正模板（工厂函数）
// ============================================================

/** 创建增伤修正（造成伤害倍率） */
export function createDamageBoostModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `damageBoost_${Date.now()}`,
		source,
		stat: "damageDealt",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "damageDealt",
	};
}

/** 创建减伤修正（受到伤害倍率） */
export function createDamageReductionModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `damageReduction_${Date.now()}`,
		source,
		stat: "damageTaken",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "damageTaken",
	};
}

/** 创建易伤修正（受到伤害增加） */
export function createVulnerabilityModifier(percent: number, duration: number, source = "system"): TokenModifier {
	return {
		id: `vulnerability_${Date.now()}`,
		source,
		stat: "damageTaken",
		value: 1 + percent / 100, // percent=50 → value=1.5
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "vulnerability",
	};
}

/** 创建航速修正 */
export function createSpeedModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `speed_${Date.now()}`,
		source,
		stat: "speed",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "speed",
	};
}

/** 创建转向速度修正 */
export function createTurnRateModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `turnRate_${Date.now()}`,
		source,
		stat: "turnRate",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "turnRate",
	};
}

/** 创建护盾效率修正 */
export function createShieldEfficiencyModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `shieldEfficiency_${Date.now()}`,
		source,
		stat: "shieldEfficiency",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "shieldEfficiency",
	};
}

/** 创建辐散修正 */
export function createFluxDissipationModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `fluxDissipation_${Date.now()}`,
		source,
		stat: "fluxDissipation",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "fluxDissipation",
	};
}

/** 创建射程修正 */
export function createRangeModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `range_${Date.now()}`,
		source,
		stat: "range",
		value,
		operation: "multiply",
		duration,
		stacks: false,
		stackKey: "range",
	};
}

/** 创建命中率修正（加法） */
export function createAccuracyModifier(value: number, duration = 999, source = "system"): TokenModifier {
	return {
		id: `accuracy_${Date.now()}`,
		source,
		stat: "accuracy",
		value,
		operation: "add",
		duration,
		stacks: true, // 命中率修正可叠加
	};
}

/** 预定义修正模板常量 */
export const MODIFIER_TEMPLATES = {
	DAMAGE_BOOST_50: () => createDamageBoostModifier(1.5),
	DAMAGE_BOOST_100: () => createDamageBoostModifier(2.0),
	DAMAGE_REDUCTION_25: () => createDamageReductionModifier(0.75),
	DAMAGE_REDUCTION_50: () => createDamageReductionModifier(0.5),
	VULNERABILITY_50_3TURNS: () => createVulnerabilityModifier(50, 3),
	SPEED_HALVED: () => createSpeedModifier(0.5),
	SPEED_DOUBLE: () => createSpeedModifier(2.0),
	TURN_RATE_HALVED: () => createTurnRateModifier(0.5),
	RANGE_BOOST_30: () => createRangeModifier(1.3),
	FLUX_DISSIPATION_BOOST_50: () => createFluxDissipationModifier(1.5),
	ACCURACY_BOOST_20: () => createAccuracyModifier(0.2),
} as const;

export const TokenRuntimeSchema = z.object({
	position: PointSchema,
	heading: z.number(),
	hull: z.number().min(0),
	armor: z.array(z.number().min(0)).length(6),
	fluxSoft: z.number().min(0).optional(),
	fluxHard: z.number().min(0).optional(),
	shield: z.object({ active: z.boolean(), value: z.number().min(0) }).optional(),
	overloaded: z.boolean().default(false),
	overloadTime: z.number().min(0).default(1),
	destroyed: z.boolean().default(false),
	movement: MovementStateSchema.optional(),
	hasFired: z.boolean().optional(),
	weapons: z.array(WeaponRuntimeSchema).optional(),
	/** 当前激活的修正（BUFF/倍率） */
	modifiers: z.array(TokenModifierSchema).optional(),
	faction: FactionSchema.optional(),
	ownerId: z.string().optional(),
	venting: z.boolean().optional(),
});
export type TokenRuntime = z.infer<typeof TokenRuntimeSchema>;
/** @deprecated 使用 TokenRuntime */
export type ShipRuntime = TokenRuntime;

export const TokenJSONSchema = z.object({
	$schema: z.literal("token-v2"),
	$id: z.string(),
	$presetRef: z.string().optional(),
	token: TokenSpecSchema,
	runtime: TokenRuntimeSchema.optional(),
	metadata: MetadataSchema,
});
export type TokenJSON = z.infer<typeof TokenJSONSchema>;
/** @deprecated 使用 TokenJSON */
export type ShipJSON = TokenJSON;

/** @deprecated 使用 TokenSpecSchema */
export const ShipSpecSchema = TokenSpecSchema;
/** @deprecated 使用 TokenRuntimeSchema */
export const ShipRuntimeSchema = TokenRuntimeSchema;
/** @deprecated 使用 TokenJSONSchema */
export const ShipJSONSchema = TokenJSONSchema;
/** @deprecated 使用 TokenModifierSchema */
export const ShipModifierSchema = TokenModifierSchema;

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
	metadata: z.record(z.string(), z.any()).optional(),
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
	faction: FactionSchema.optional(),
	isReady: z.boolean().default(false),
	connected: z.boolean().default(true),
	tokenIds: z.array(z.string()).optional(),
});
export type RoomPlayerState = z.infer<typeof RoomPlayerStateSchema>;

export const GameRoomStateSchema = z.object({
	roomId: z.string(),
	name: z.string().optional(),
	ownerId: z.string(),
	phase: GamePhaseSchema,
	turnCount: z.number().default(0),
	activeFaction: FactionSchema.optional(),
	players: z.record(z.string(), RoomPlayerStateSchema),
	tokens: z.record(z.string(), TokenJSONSchema),
	map: GameMapSchema.optional(),
	globalModifiers: z.record(z.string(), z.number()).optional(),
	createdAt: z.number(),
});
export type GameRoomState = z.infer<typeof GameRoomStateSchema>;

// ============================================================
// 存档类型（精简为单一权威定义）
// ============================================================

export const SaveMetadataSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
	version: z.string().optional(),
	thumbnail: z.string().optional(),
	createdAt: z.number().optional(),
	updatedAt: z.number().optional(),
	roomId: z.string().optional(),
});
export type SaveMetadata = z.infer<typeof SaveMetadataSchema>;

export const GameSaveSchema = z.object({
	$schema: z.literal("save-v1"),
	$id: z.string(),
	metadata: SaveMetadataSchema,
	room: GameRoomStateSchema.optional(),
	tokens: z.array(TokenJSONSchema),
	createdAt: z.number(),
	updatedAt: z.number().optional(),
});
export type GameSave = z.infer<typeof GameSaveSchema>;

// ============================================================
// 玩家档案类型
// ============================================================

export const PlayerProfileSchema = z.object({
	$schema: z.literal("player-v1"),
	$id: z.string(),
	username: z.string(),
	displayName: z.string(),
	avatarAssetId: z.string().optional(),
	tokens: z.array(TokenJSONSchema),
	weapons: z.array(WeaponJSONSchema),
	saveIds: z.array(z.string()).optional(),
	stats: z.object({
		gamesPlayed: z.number(),
		wins: z.number(),
		totalDamage: z.number(),
	}),
	createdAt: z.number(),
	updatedAt: z.number(),
	lastLogin: z.number().optional(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

// ============================================================
// 资产类型（简化：所有资产公开）
// ============================================================

export const AssetTypeSchema = z.enum(["avatar", "ship_texture", "weapon_texture"]);
export const AssetType = AssetTypeSchema.enum;
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
	$schema: z.literal("asset-v1"),
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

export const AssetUploadRequestSchema = z.object({
	type: AssetTypeSchema,
	filename: z.string(),
	mimeType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
	buffer: z.custom<Uint8Array>(
		(val): val is Uint8Array => val instanceof Uint8Array,
		{ message: "Expected Uint8Array or Buffer" }
	),
	metadata: AssetSchema.shape.metadata.optional(),
});
export type AssetUploadRequest = z.infer<typeof AssetUploadRequestSchema>;

export const AssetListItemSchema = z.object({
	$id: z.string(),
	type: AssetTypeSchema,
	filename: z.string(),
	mimeType: z.string(),
	size: z.number(),
	metadata: AssetSchema.shape.metadata.optional(),
	ownerId: z.string(),
	uploadedAt: z.number(),
	updatedAt: z.number().optional(),
});
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

export const AssetStatsSchema = z.object({
	total: z.number(),
	byType: z.record(AssetTypeSchema, z.number()),
	byVisibility: z.record(z.string(), z.number()),
	totalSize: z.number(),
	oldest: z.date().nullable(),
	newest: z.date().nullable(),
});
export type AssetStats = z.infer<typeof AssetStatsSchema>;

// ============================================================
// 导出 / 序列化辅助类型
// ============================================================

export const ExportJSONSchema = z.object({
	$schema: z.string(),
	$type: z.enum(["TOKEN", "WEAPON", "FLEET"]),
	$exportedAt: z.string(),
	token: TokenJSONSchema.optional(),
	weapon: WeaponJSONSchema.optional(),
	fleet: z.object({
		name: z.string(),
		description: z.string().optional(),
		tokens: z.array(TokenJSONSchema),
	}).optional(),
});
export type ExportJSON = z.infer<typeof ExportJSONSchema>;

// ============================================================
// 验证函数工厂
// ============================================================

/** 创建严格验证函数（parse 模式） */
function createValidator<T>(schema: z.ZodTypeAny): (data: unknown) => T {
	return (data: unknown): T => schema.parse(data) as T;
}

/** 创建宽松类型守卫（safeParse 模式） */
function createTypeGuard<T>(schema: z.ZodTypeAny): (data: unknown) => data is T {
	return (data: unknown): data is T => schema.safeParse(data).success;
}

// ============================================================
// 验证函数导出（由工厂生成）
// ============================================================

export const validateTokenJSON = createValidator<TokenJSON>(TokenJSONSchema);
export const validateWeaponJSON = createValidator<WeaponJSON>(WeaponJSONSchema);
export const validatePlayerProfile = createValidator<PlayerProfile>(PlayerProfileSchema);
export const validateGameSave = createValidator<GameSave>(GameSaveSchema);
export const validateGameMap = createValidator<GameMap>(GameMapSchema);
export const validateGameRoomState = createValidator<GameRoomState>(GameRoomStateSchema);

export const isValidTokenJSON = createTypeGuard<TokenJSON>(TokenJSONSchema);
export const isValidWeaponJSON = createTypeGuard<WeaponJSON>(WeaponJSONSchema);

/** @deprecated 使用 validateTokenJSON */
export const validateShipJSON = validateTokenJSON;
/** @deprecated 使用 isValidTokenJSON */
export const isValidShipJSON = isValidTokenJSON;
