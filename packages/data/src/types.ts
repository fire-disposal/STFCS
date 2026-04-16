/**
 * @vt/data 独立类型定义
 *
 * 静态数据包的类型定义，不依赖任何外部包
 */

// ==================== 枚举常量 ====================

export const DamageType = {
	KINETIC: "KINETIC",
	HIGH_EXPLOSIVE: "HIGH_EXPLOSIVE",
	ENERGY: "ENERGY",
	FRAGMENTATION: "FRAGMENTATION",
} as const;

export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType];

export const WeaponCategory = {
	BALLISTIC: "BALLISTIC",
	ENERGY: "ENERGY",
	MISSILE: "MISSILE",
	SYNERGY: "SYNERGY",
} as const;

export type WeaponCategoryValue =
	(typeof WeaponCategory)[keyof typeof WeaponCategory];

export const MountType = {
	FIXED: "FIXED",
	TURRET: "TURRET",
	HIDDEN: "HIDDEN",
} as const;

export type MountTypeValue = (typeof MountType)[keyof typeof MountType];

export const WeaponSlotSize = {
	SMALL: "SMALL",
	MEDIUM: "MEDIUM",
	LARGE: "LARGE",
} as const;

export type WeaponSlotSizeValue =
	(typeof WeaponSlotSize)[keyof typeof WeaponSlotSize];

/** 武器尺寸兼容性规则：大型槽可装中型/小型，中型槽可装小型 */
export const SIZE_COMPATIBILITY: Record<WeaponSlotSizeValue, WeaponSlotSizeValue[]> = {
	SMALL: ["SMALL"],
	MEDIUM: ["SMALL", "MEDIUM"],
	LARGE: ["SMALL", "MEDIUM", "LARGE"],
};

/** 检查武器尺寸是否兼容挂载点 */
export function isWeaponSizeCompatible(
	mountSize: WeaponSlotSizeValue,
	weaponSize: WeaponSlotSizeValue
): boolean {
	return SIZE_COMPATIBILITY[mountSize].includes(weaponSize);
}

// ==================== 武器标签 ====================

export const WeaponTag = {
	PD: "PD",                  // 点防御（反导弹/反战机）
	ANTI_SHIP: "ANTI_SHIP",    // 反舰
	ASSAULT: "ASSAULT",        // 近程突击
	SUPPRESSION: "SUPPRESSION", // 远程压制
	BEAM: "BEAM",              // 光束武器
	BALLISTIC: "BALLISTIC",    // 弹道武器（有弹药）
	GUIDED: "GUIDED",          // 制导武器（追踪）
	EMP: "EMP",                // EMP效果（干扰系统）
	HE: "HE",                  // 高爆强化
	KINETIC: "KINETIC",        // 动能强化
} as const;

export type WeaponTagValue = (typeof WeaponTag)[keyof typeof WeaponTag];

export const ShieldType = {
	FRONT: "FRONT",
	OMNI: "OMNI",
	NONE: "NONE",
} as const;

export type ShieldTypeValue = (typeof ShieldType)[keyof typeof ShieldType];

export const HullSize = {
	FIGHTER: "FIGHTER",
	FRIGATE: "FRIGATE",
	DESTROYER: "DESTROYER",
	CRUISER: "CRUISER",
	CAPITAL: "CAPITAL",
} as const;

export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize];

export const ShipClass = {
	STRIKE: "STRIKE",
	ASSAULT: "ASSAULT",
	COMBAT: "COMBAT",
	SUPPORT: "SUPPORT",
	HEAVY: "HEAVY",
	CARRIER: "CARRIER",
	INTERCEPTOR: "INTERCEPTOR",
	BATTLESHIP: "BATTLESHIP",
} as const;

export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass];

// ==================== 游戏状态枚举 ====================

export const WeaponState = {
	READY: "READY",
	COOLDOWN: "COOLDOWN",
	DISABLED: "DISABLED",
	OUT_OF_AMMO: "OUT_OF_AMMO",
} as const;
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];

/**
 * 护甲象限系统（六边形）
 *
 * 每个象限代表船体六边形的一个边：
 * - FRONT_TOP:    船头顶边（上）
 * - FRONT_BOTTOM: 船头底边（下）
 * - LEFT_TOP:     左侧上边
 * - LEFT_BOTTOM:  左侧下边
 * - RIGHT_TOP:    右侧上边
 * - RIGHT_BOTTOM: 右侧下边
 */
export const ArmorQuadrant = {
	FRONT_TOP: "FRONT_TOP",
	FRONT_BOTTOM: "FRONT_BOTTOM",
	LEFT_TOP: "LEFT_TOP",
	LEFT_BOTTOM: "LEFT_BOTTOM",
	RIGHT_TOP: "RIGHT_TOP",
	RIGHT_BOTTOM: "RIGHT_BOTTOM",
} as const;
export type ArmorQuadrantValue = (typeof ArmorQuadrant)[keyof typeof ArmorQuadrant];
export const ARMOR_QUADRANTS: readonly ArmorQuadrantValue[] = Object.values(ArmorQuadrant);

export const FluxState = {
	NORMAL: "NORMAL",
	VENTING: "VENTING",
	OVERLOADED: "OVERLOADED",
} as const;
export type FluxStateValue = (typeof FluxState)[keyof typeof FluxState];

export const Faction = {
	PLAYER: "PLAYER",
	DM: "DM",
	NEUTRAL: "NEUTRAL",
	HEGEMONY: "hegemony",
	SINDRIAN: "sindrian",
	PERSEAN: "persean",
	TRI_TACHYON: "tri_tachyon",
	PIRATE: "pirate",
	INDEPENDENT: "independent",
} as const;
export type FactionValue = (typeof Faction)[keyof typeof Faction];

export const PlayerRole = {
	DM: "DM",
	PLAYER: "PLAYER",
} as const;
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];

export const ConnectionQuality = {
	EXCELLENT: "EXCELLENT",
	GOOD: "GOOD",
	FAIR: "FAIR",
	POOR: "POOR",
	OFFLINE: "OFFLINE",
} as const;
export type ConnectionQualityValue = (typeof ConnectionQuality)[keyof typeof ConnectionQuality];

export const ChatMessageType = {
	CHAT: "chat",
	SYSTEM: "system",
	COMBAT: "combat",
} as const;
export type ChatMessageTypeValue = (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const GamePhase = {
	DEPLOYMENT: "DEPLOYMENT",
	PLAYER_TURN: "PLAYER_TURN",
	DM_TURN: "DM_TURN",
	END_PHASE: "END_PHASE",
	BATTLE: "BATTLE",
	END: "END",
} as const;
export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];

export const TurnPhase = {
	START: "START",
	MOVEMENT: "MOVEMENT",
	COMBAT: "COMBAT",
	END: "END",
} as const;
export type TurnPhaseValue = (typeof TurnPhase)[keyof typeof TurnPhase];

export const MovePhase = {
	PHASE_A: "PHASE_A",
	PHASE_B: "PHASE_B",
	PHASE_C: "PHASE_C",
} as const;
export type MovePhaseValue = (typeof MovePhase)[keyof typeof MovePhase];

/** 客户端 UI 状态扩展 - 包含 NONE 表示未开始移动 */
export const MovePhaseUI = {
	...MovePhase,
	NONE: "NONE",
} as const;
export type MovePhaseUIValue = (typeof MovePhaseUI)[keyof typeof MovePhaseUI];

export const FactionTurnPhase = {
	DRAW: "DRAW",
	PLAY: "PLAY",
	END: "END",
} as const;
export type FactionTurnPhaseValue = (typeof FactionTurnPhase)[keyof typeof FactionTurnPhase];

export const TokenType = {
	SHIP: "ship",
	STATION: "station",
	ASTEROID: "asteroid",
} as const;
export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

export const TokenTurnState = {
	WAITING: "waiting",
	ACTIVE: "active",
	DONE: "done",
} as const;
export type TokenTurnStateValue = (typeof TokenTurnState)[keyof typeof TokenTurnState];

export const ClientCommand = {
	// 游戏命令
	CMD_MOVE_TOKEN: "CMD_MOVE_TOKEN",
	CMD_TOGGLE_SHIELD: "CMD_TOGGLE_SHIELD",
	CMD_FIRE_WEAPON: "CMD_FIRE_WEAPON",
	CMD_VENT_FLUX: "CMD_VENT_FLUX",
	CMD_ASSIGN_SHIP: "CMD_ASSIGN_SHIP",
	CMD_TOGGLE_READY: "CMD_TOGGLE_READY",
	CMD_NEXT_PHASE: "CMD_NEXT_PHASE",
	CMD_CREATE_OBJECT: "CMD_CREATE_OBJECT",
	CMD_CLEAR_OVERLOAD: "CMD_CLEAR_OVERLOAD",
	CMD_SET_ARMOR: "CMD_SET_ARMOR",
	CMD_ADVANCE_MOVE_PHASE: "CMD_ADVANCE_MOVE_PHASE",

	// 武器配置命令
	CMD_CONFIGURE_WEAPON: "CMD_CONFIGURE_WEAPON",
	CMD_CONFIGURE_VARIANT: "CMD_CONFIGURE_VARIANT",
	CMD_REPAIR_WEAPON: "CMD_REPAIR_WEAPON",

	// 玩家档案命令
	CMD_SAVE_VARIANT: "CMD_SAVE_VARIANT",
	CMD_LOAD_VARIANT: "CMD_LOAD_VARIANT",
	CMD_DELETE_VARIANT: "CMD_DELETE_VARIANT",
	CMD_GET_PROFILE: "CMD_GET_PROFILE",
	CMD_UPDATE_SETTINGS: "CMD_UPDATE_SETTINGS",

	// 存档命令
	CMD_SAVE_GAME: "CMD_SAVE_GAME",
	CMD_LOAD_GAME: "CMD_LOAD_GAME",
	CMD_DELETE_SAVE: "CMD_DELETE_SAVE",
	CMD_LIST_SAVES: "CMD_LIST_SAVES",

	// 房间命令
	CMD_ROOM_DISSOLVE: "CMD_ROOM_DISSOLVE",
	CMD_KICK_PLAYER: "CMD_KICK_PLAYER",
	CMD_UPDATE_PROFILE: "CMD_UPDATE_PROFILE",
} as const;
export type ClientCommandValue = (typeof ClientCommand)[keyof typeof ClientCommand];

// ==================== 基础类型 ====================

export interface Point {
	x: number;
	y: number;
}

// ==================== 武器规格 ====================

export interface WeaponSpec {
	// 基础标识
	id: string;
	name: string;
	description?: string;

	// 分类属性
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;
	size: WeaponSlotSizeValue;         // 武器尺寸（必填）

	// 战斗属性
	damage: number;                    // 单发伤害
	range: number;                     // 最大射程
	minRange?: number;                 // 最小射程（0 = 无限制，近距离无法开火）
	arc: number;                       // 射界角度范围
	cooldown: number;                  // 冷却时间（秒）
	fluxCost: number;                  // 辐能消耗（每发）
	ignoresShields: boolean;           // 是否无视护盾

	// 连发系统
	burstSize?: number;                // 连发数量（默认 1）
	burstDelay?: number;               // 连发间隔（秒，默认 0.1）

	// 弹药系统
	ammo?: number;                     // 最大弹药（0 = 无限）
	reloadTime?: number;               // 装填时间（秒）

	// 资源系统
	opCost: number;                    // OP 点数成本

	// 特殊效果
	tags?: WeaponTagValue[];           // 武器标签
	empDamage?: number;                // EMP 伤害值
	tracking?: number;                 // 追踪能力（0-1，导弹用）

	// UI 资源
	icon?: string;                     // 图标资源路径
}

// ==================== 武器挂载规格 ====================

/**
 * 武器挂载点规格
 *
 * 坐标系统说明（船体坐标系）：
 * - 船体中心为原点 (0, 0)
 * - X 轴：正方向朝右（从船头看向船尾时）
 * - Y 轴：正方向朝船尾，负方向朝船头
 * - 船头方向 = -Y（heading 0° 时朝上）
 *
 * 示例：
 * - position: { x: 30, y: 0 }   → 船体中心右侧 30 单位
 * - position: { x: 0, y: -50 }  → 船头前方 50 单位
 * - facing: 0                   → 朝船头方向（-Y）
 * - facing: 90                  → 朝右侧方向（+X）
 * - facing: 180                 → 朝船尾方向（+Y）
 * - facing: -90 / 270           → 朝左侧方向（-X）
 */
export interface WeaponMountSpec {
	// 基础标识
	id: string;
	displayName?: string;              // 挂载点显示名称（如"主炮"、"副炮"）

	// 类型与尺寸
	type: MountTypeValue;              // FIXED: 固定射界 ±10° / TURRET: 可旋转炮塔
	size: WeaponSlotSizeValue;

	// 位置与朝向（船体坐标系）
	position: Point;                   // 相对船体中心的偏移位置
	facing: number;                    // 基准朝向（度），0°=朝船头，90°=朝右

	// 射界
	arc: number;                       // 射界角度范围（度），以 facing 为中心

	// 限制
	restrictedTypes?: WeaponCategoryValue[]; // 限制武器类别（如只能装导弹）

	// 默认配置
	defaultWeapon?: string;            // 默认武器 ID
	groupHint?: string;                // 默认武器组建议（如"主炮组"）

	// 视觉
	visualOffset?: Point;              // 武器图标渲染偏移
}

// ==================== 舰船规格 ====================

/**
 * 舰船规格定义
 *
 * 物理尺寸说明：
 * - width:  船体宽度（左右方向，X 轴）
 * - length: 船体长度（前后方向，Y 轴），船头到船尾
 *
 * 机动系统：
 * - maxSpeed:     每阶段最大移动距离（单位）
 * - maxTurnRate:  每回合最大转向角度（度）
 *
 * 三阶段移动：
 * - Phase A: 平移（前进/后退/横移）
 * - Phase B: 转向
 * - Phase C: 再平移（沿新朝向）
 */
export interface ShipHullSpec {
	// 基础标识
	id: string;
	name: string;
	description?: string;

	// 分类
	size: HullSizeValue;               // FRIGATE / DESTROYER / CRUISER / CAPITAL
	class: ShipClassValue;             // STRIKE / ASSAULT / COMBAT / SUPPORT / HEAVY / CARRIER / BATTLESHIP

	// 物理尺寸
	width: number;                     // 船体宽度（左右方向）
	length: number;                    // 船体长度（前后方向）

	// 生存属性
	hitPoints: number;                 // 结构值上限（降至 0 即摧毁）
	hullPoints: number;                // 同 hitPoints（兼容字段）
	armorMax: number;                  // 单象限护甲上限（六象限独立）
	armorValue: number;                // 同 armorMax（兼容字段）

	// 辐能系统
	fluxCapacity: number;              // 辐能容量上限（过载阈值）
	fluxDissipation: number;           // 每回合自然排散的软辐能量

	// 护盾系统
	hasShield: boolean;
	shieldType: ShieldTypeValue;       // FRONT: 前盾（固定中心） / OMNI: 全盾（可调整）
	shieldArc: number;                 // 护盾覆盖角度范围（度）
	shieldRadius: number;              // 护盾半径（决定覆盖范围）
	shieldUpCost?: number;             // 每回合护盾维持的软辐能消耗

	// 机动系统
	maxSpeed: number;                  // 每阶段最大移动距离（单位）
	maxTurnRate: number;               // 每回合最大转向角度（度）

	// 武器系统
	weaponMounts: WeaponMountSpec[];   // 可配置的武器挂载点
	builtInWeapons?: WeaponLoadoutEntry[]; // 内置武器（不可更换）

	// 装备点数
	opCapacity: number;                // OP 点数容量（限制武器配置总量）

	// 变体
	variants?: string[];               // 预设变体 ID 列表
}

// ==================== 舰船变体 ====================

/** 武器配置条目 */
export interface WeaponLoadoutEntry {
	mountId: string;                   // 挂载点 ID
	weaponId: string;                  // 武器 ID（空字符串表示不装备）
}

/** 舰船变体规格 */
export interface ShipVariantSpec {
	id: string;                        // 变体唯一 ID
	hullId: string;                    // 基础舰船规格 ID
	name: string;                      // 变体名称
	description?: string;              // 变体描述
	weaponLoadout: WeaponLoadoutEntry[]; // 武器配置
	opUsed: number;                    // 已用 OP 点数
	tags?: string[];                   // 变体标签
}

// ==================== 伤害倍率 ====================

export interface DamageModifierConfig {
	shield: number;
	armor: number;
	hull: number;
	description?: string;
}

export type DamageModifiersMap = Record<DamageTypeValue, DamageModifierConfig>;