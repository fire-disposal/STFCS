/**
 * 服务端 Schema 定义
 *
 * Colyseus Schema 类必须使用装饰器，无法直接使用 interface
 * 类型值和常量从 contracts/definitions 导入（唯一事实来源）
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

// 从统一定义导入枚举和常量
import {
	ClientCommand as ClientCommandEnum,
	ConnectionQuality as ConnectionQualityEnum,
	DAMAGE_MODIFIERS,
	Faction as FactionEnum,
	GAME_CONFIG as GAME_CONFIG_UNIFIED,
	PlayerRole as PlayerRoleEnum,
	WeaponState as WeaponStateEnum,
} from "@vt/contracts";

export { ArraySchema };

// ==================== 统一的枚举常量（从 contracts 导入） ====================

// 导出 WeaponState 枚举
export const WeaponState = WeaponStateEnum;

// 导出 ClientCommand 枚举
export const ClientCommand = ClientCommandEnum;

// 导出 Faction 枚举
export const Faction = FactionEnum;

// 导出 PlayerRole 枚举
export const PlayerRole = PlayerRoleEnum;

// 导出 ConnectionQuality 枚举
export const ConnectionQuality = ConnectionQualityEnum;

// 导出统一配置
export const GAME_CONFIG = GAME_CONFIG_UNIFIED;

// 导出伤害倍率（兼容小写键版本）
export const DAMAGE_MULTIPLIERS: Record<string, { shield: number; armor: number; hull: number }> = {
	kinetic: DAMAGE_MODIFIERS.KINETIC,
	high_explosive: DAMAGE_MODIFIERS.HIGH_EXPLOSIVE,
	energy: DAMAGE_MODIFIERS.ENERGY,
	fragmentation: DAMAGE_MODIFIERS.FRAGMENTATION,
	// 大写键版本（新代码使用）
	KINETIC: DAMAGE_MODIFIERS.KINETIC,
	HIGH_EXPLOSIVE: DAMAGE_MODIFIERS.HIGH_EXPLOSIVE,
	ENERGY: DAMAGE_MODIFIERS.ENERGY,
	FRAGMENTATION: DAMAGE_MODIFIERS.FRAGMENTATION,
};

// ==================== Schema 类定义 ====================

export class Transform extends Schema {
	@type("number") x: number = 0;
	@type("number") y: number = 0;
	@type("number") heading: number = 0;
}

export class WeaponSlot extends Schema {
	@type("string") mountId: string = "";
	@type("string") weaponSpecId: string = "";
	@type("string") name: string = "";
	@type("string") category: string = "BALLISTIC";
	@type("string") damageType: string = "KINETIC";
	@type("string") mountType: string = "TURRET";

	@type("number") offsetX: number = 0;
	@type("number") offsetY: number = 0;
	@type("number") mountFacing: number = 0;
	@type("number") arcMin: number = -90;
	@type("number") arcMax: number = 90;

	@type("number") damage: number = 0;
	@type("number") range: number = 0;
	@type("number") fluxCost: number = 0;

	@type("number") cooldownMax: number = 0;
	@type("number") cooldownRemaining: number = 0;

	@type("number") maxAmmo: number = 0;
	@type("number") currentAmmo: number = 0;
	@type("number") reloadTime: number = 0;

	@type("string") state: string = WeaponState.READY;
	@type("boolean") ignoresShields: boolean = false;
	@type("boolean") hasFiredThisTurn: boolean = false;
}

export class PlayerState extends Schema {
	@type("string") sessionId: string = "";
	@type("number") shortId: number = 0;
	@type("string") role: string = "PLAYER";
	@type("string") name: string = "";
	@type("string") nickname: string = "";
	@type("string") avatar: string = "👤";
	@type("boolean") isReady: boolean = false;
	@type("boolean") connected: boolean = true;
	@type("number") pingMs: number = -1;
	@type("number") jitterMs: number = 0;
	@type("string") connectionQuality: string = "OFFLINE";
}

export class ShipState extends Schema {
	@type("string") id: string = "";
	@type("string") ownerId: string = "";
	@type("string") faction: string = "PLAYER";
	@type("string") hullType: string = "";
	@type("string") name: string = "";
	@type("number") width: number = 20;
	@type("number") length: number = 40;
	@type(Transform) transform = new Transform();

	// 护甲使用 MapSchema（对象形式）
	@type({ map: "number" }) armorQuadrants = new MapSchema<number>();
	@type("number") armorMaxPerQuadrant: number = 0;

	// 兼容旧数组形式（逐步废弃）
	@type(["number"]) armorCurrent = new ArraySchema<number>(0, 0, 0, 0, 0, 0);
	@type(["number"]) armorMax = new ArraySchema<number>(0, 0, 0, 0, 0, 0);

	@type("number") hullCurrent: number = 0;
	@type("number") hullMax: number = 0;
	@type("number") fluxMax: number = 0;
	@type("number") fluxDissipation: number = 0;
	@type("number") fluxHard: number = 0;
	@type("number") fluxSoft: number = 0;
	@type("boolean") isShieldUp: boolean = false;
	@type("number") shieldOrientation: number = 0;
	@type("number") shieldArc: number = 120;
	@type("number") shieldRadius: number = 0;
	@type("boolean") isOverloaded: boolean = false;
	@type("number") overloadTime: number = 0;
	@type("boolean") isDestroyed: boolean = false;
	@type("number") maxSpeed: number = 0;
	@type("number") maxTurnRate: number = 0;
	@type("number") acceleration: number = 0;
	@type("number") movePhaseAX: number = 0;
	@type("number") movePhaseAStrafe: number = 0;
	@type("number") movePhaseBX: number = 0;
	@type("number") movePhaseBStrafe: number = 0;
	@type("number") turnAngle: number = 0;

	// 燃料池制度追踪（每回合重置）
	@type("number") fuelPhaseAForwardUsed: number = 0;
	@type("number") fuelPhaseAStrafeUsed: number = 0;
	@type("number") fuelPhaseBTurnUsed: number = 0;
	@type("number") fuelPhaseCForwardUsed: number = 0;
	@type("number") fuelPhaseCStrafeUsed: number = 0;
	@type("number") currentMovementPhase: number = 0; // 0=未开始，1=PhaseA, 2=PhaseB, 3=PhaseC, 4=完成

	@type({ map: WeaponSlot }) weapons = new MapSchema<WeaponSlot>();
	@type("boolean") hasMoved: boolean = false;
	@type("boolean") hasFired: boolean = false;
}

export type GamePhase = "DEPLOYMENT" | "PLAYER_TURN" | "DM_TURN" | "END_PHASE";

export class GameRoomState extends Schema {
	@type("string") currentPhase: string = "DEPLOYMENT";
	@type("number") turnCount: number = 1;
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type({ map: ShipState }) ships = new MapSchema<ShipState>();
	@type("string") activeFaction: string = "PLAYER";
	@type("number") mapWidth: number = 2000;
	@type("number") mapHeight: number = 2000;
}
