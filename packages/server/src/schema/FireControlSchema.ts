/**
 * 火控系统 Schema
 *
 * 服务端权威存储可攻击目标数据
 * 通过 Colyseus Schema 直接同步到客户端
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/** 单个目标的可攻击性数据 */
export class TargetAttackabilitySchema extends Schema {
	@type("string") shipId: string = "";           // 目标舰船 ID
	@type("boolean") canAttack: boolean = false;   // 是否可攻击
	@type("string") reason: string = "";           // 不可攻击原因
	@type("boolean") inRange: boolean = false;     // 是否在射程内
	@type("boolean") inArc: boolean = false;       // 是否在射界内
	@type("number") distance: number = 0;          // 距离
	@type("number") estimatedDamage: number = 0;   // 预估伤害
	@type("boolean") isFriendly: boolean = false;  // 是否友军
}

/** 单个武器的目标查询结果 */
export class WeaponTargetsSchema extends Schema {
	@type("string") weaponMountId: string = "";    // 武器挂载点 ID（mountId）
	@type({ array: TargetAttackabilitySchema }) targets = new ArraySchema<TargetAttackabilitySchema>();
	@type("boolean") weaponCanFire: boolean = true; // 武器是否可开火
	@type("string") weaponFireReason: string = ""; // 武器不可开火原因
}

/** 舰船的火控数据（所有武器的可攻击目标） */
export class ShipFireControlSchema extends Schema {
	@type("string") shipId: string = "";
	@type("number") lastUpdateTime: number = 0;    // 最后更新时间戳
	@type({ map: WeaponTargetsSchema }) weapons = new MapSchema<WeaponTargetsSchema>();
}

/**
 * 游戏房间的火控数据缓存
 *
 * 存储所有舰船的可攻击目标数据
 * 当客户端请求查询时，服务端计算并写入此 Schema
 */
export class FireControlCacheSchema extends Schema {
	@type({ map: ShipFireControlSchema }) ships = new MapSchema<ShipFireControlSchema>();
}