/**
 * 游戏枚举定义（唯一事实来源）
 *
 * 所有枚举使用大写命名，前后端共享
 */

// ==================== 伤害类型 ====================

export const DamageType = {
	KINETIC: "KINETIC",
	HIGH_EXPLOSIVE: "HIGH_EXPLOSIVE",
	ENERGY: "ENERGY",
	FRAGMENTATION: "FRAGMENTATION",
} as const;

export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType];

// ==================== 武器类别 ====================

export const WeaponCategory = {
	BALLISTIC: "BALLISTIC",
	ENERGY: "ENERGY",
	MISSILE: "MISSILE",
	SYNERGY: "SYNERGY",
} as const;

export type WeaponCategoryValue = (typeof WeaponCategory)[keyof typeof WeaponCategory];

// ==================== 武器挂载类型 ====================

export const MountType = {
	FIXED: "FIXED",
	TURRET: "TURRET",
	HIDDEN: "HIDDEN",
} as const;

export type MountTypeValue = (typeof MountType)[keyof typeof MountType];

// ==================== 武器状态 ====================

export const WeaponState = {
	READY: "ready",
	COOLDOWN: "cooldown",
	CHARGING: "charging",
	RELOADING: "reloading",
	DISABLED: "disabled",
	OUT_OF_AMMO: "out_of_ammo",
} as const;

export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];

// ==================== 武器槽位尺寸 ====================

export const WeaponSlotSize = {
	SMALL: "SMALL",
	MEDIUM: "MEDIUM",
	LARGE: "LARGE",
} as const;

export type WeaponSlotSizeValue = (typeof WeaponSlotSize)[keyof typeof WeaponSlotSize];

// ==================== 护甲象限 ====================

export const ArmorQuadrant = {
	FRONT_TOP: "FRONT_TOP",
	FRONT_BOTTOM: "FRONT_BOTTOM",
	LEFT_TOP: "LEFT_TOP",
	LEFT_BOTTOM: "LEFT_BOTTOM",
	RIGHT_TOP: "RIGHT_TOP",
	RIGHT_BOTTOM: "RIGHT_BOTTOM",
} as const;

export type ArmorQuadrantValue = (typeof ArmorQuadrant)[keyof typeof ArmorQuadrant];

export const ARMOR_QUADRANTS: readonly ArmorQuadrantValue[] = [
	ArmorQuadrant.FRONT_TOP,
	ArmorQuadrant.FRONT_BOTTOM,
	ArmorQuadrant.LEFT_TOP,
	ArmorQuadrant.LEFT_BOTTOM,
	ArmorQuadrant.RIGHT_TOP,
	ArmorQuadrant.RIGHT_BOTTOM,
];

// ==================== 护盾类型 ====================

export const ShieldType = {
	FRONT: "FRONT",
	OMNI: "OMNI",
	NONE: "NONE",
} as const;

export type ShieldTypeValue = (typeof ShieldType)[keyof typeof ShieldType];

// ==================== 辐能状态 ====================

export const FluxStateType = {
	NORMAL: "NORMAL",
	VENTING: "VENTING",
	OVERLOADED: "OVERLOADED",
} as const;

export type FluxStateValue = (typeof FluxStateType)[keyof typeof FluxStateType];

// ==================== 游戏阶段 ====================

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

// ==================== 舰船尺寸 ====================

export const HullSize = {
	FIGHTER: "FIGHTER",
	FRIGATE: "FRIGATE",
	DESTROYER: "DESTROYER",
	CRUISER: "CRUISER",
	CAPITAL: "CAPITAL",
} as const;

export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize];

// ==================== 舰船级别 ====================

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

// ==================== 阵营 ====================

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

// ==================== 玩家角色 ====================

export const PlayerRole = {
	DM: "DM",
	PLAYER: "PLAYER",
} as const;

export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];

// ==================== 连接质量 ====================

export const ConnectionQuality = {
	EXCELLENT: "EXCELLENT",
	GOOD: "GOOD",
	FAIR: "FAIR",
	POOR: "POOR",
	OFFLINE: "OFFLINE",
} as const;

export type ConnectionQualityValue = (typeof ConnectionQuality)[keyof typeof ConnectionQuality];

// ==================== 聊天消息类型 ====================

export const ChatMessageType = {
	CHAT: "chat",
	SYSTEM: "system",
	COMBAT: "combat",
} as const;

export type ChatMessageTypeValue = (typeof ChatMessageType)[keyof typeof ChatMessageType];

// ==================== 客户端命令 ====================

export const ClientCommand = {
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
} as const;

export type ClientCommandValue = (typeof ClientCommand)[keyof typeof ClientCommand];
