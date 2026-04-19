/**
 * @vt/data 运行时常量
 *
 * 运行时枚举常量，与 schema 中的 enum 对应。
 */

export const DamageType = {
	KINETIC: "KINETIC",
	HIGH_EXPLOSIVE: "HIGH_EXPLOSIVE",
	ENERGY: "ENERGY",
	FRAGMENTATION: "FRAGMENTATION",
} as const;

export const WeaponCategory = {
	BALLISTIC: "BALLISTIC",
	ENERGY: "ENERGY",
	MISSILE: "MISSILE",
	SYNERGY: "SYNERGY",
} as const;

export const WeaponSlotSize = {
	SMALL: "SMALL",
	MEDIUM: "MEDIUM",
	LARGE: "LARGE",
} as const;

export const WeaponTag = {
	ANTI_SHIP: "ANTI_SHIP",
	PD: "PD",
	GUIDED: "GUIDED",
	BALLISTIC: "BALLISTIC",
	ENERGY: "ENERGY",
	HE: "HE",
	BEAM: "BEAM",
	SUPPRESSION: "SUPPRESSION",
} as const;

export const HullSize = {
	FRIGATE: "FRIGATE",
	DESTROYER: "DESTROYER",
	CRUISER: "CRUISER",
	CAPITAL: "CAPITAL",
} as const;

export const ShipClass = {
	STRIKE: "STRIKE",
	ASSAULT: "ASSAULT",
	COMBAT: "COMBAT",
	SUPPORT: "SUPPORT",
	HEAVY: "HEAVY",
	CARRIER: "CARRIER",
	BATTLESHIP: "BATTLESHIP",
} as const;

export const WeaponState = {
	READY: "READY",
	COOLDOWN: "COOLDOWN",
	DISABLED: "DISABLED",
} as const;

export const ArmorQuadrant = {
	RF: "RF", // 0°~60°   右前
	RR: "RR", // 60°~120° 右舷
	RB: "RB", // 120°~180° 右后
	LB: "LB", // 180°~240° 左后
	LL: "LL", // 240°~300° 左舷
	LF: "LF", // 300°~360° 左前
} as const;

export const GamePhase = {
	DEPLOYMENT: "DEPLOYMENT",
	PLAYER_ACTION: "PLAYER_ACTION",
	DM_ACTION: "DM_ACTION",
	TURN_END: "TURN_END",
} as const;

export const Faction = {
	PLAYER: "PLAYER",
	ENEMY: "ENEMY",
	NEUTRAL: "NEUTRAL",
} as const;

export const PlayerRole = {
	DM: "DM",
	PLAYER: "PLAYER",
	OBSERVER: "OBSERVER",
} as const;

export const ConnectionQuality = {
	EXCELLENT: "EXCELLENT",
	GOOD: "GOOD",
	FAIR: "FAIR",
	POOR: "POOR",
	OFFLINE: "OFFLINE",
} as const;

export const ChatMessageType = {
	CHAT: "chat",
	SYSTEM: "system",
	COMBAT: "combat",
} as const;

export const GamePhaseEnum = {
	DEPLOYMENT: "DEPLOYMENT",
	PLAYER_ACTION: "PLAYER_ACTION",
	DM_ACTION: "DM_ACTION",
	TURN_END: "TURN_END",
} as const;
