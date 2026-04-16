/**
 * 舰船状态 Schema
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import {
	DamageType,
	WeaponCategory,
	MountType,
	WeaponState,
	WeaponSlotSize,
	ShieldType,
	FluxState,
	Faction,
} from "@vt/data";
import type {
	DamageTypeValue,
	WeaponCategoryValue,
	MountTypeValue,
	WeaponStateValue,
	WeaponSlotSizeValue,
	ShieldTypeValue,
	FluxStateValue,
	FactionValue,
	MovePhaseValue,
} from "@vt/data";

export class WeaponSlot extends Schema {
	// === 挂载点信息 ===
	@type("string") mountId: string = "";
	@type("string") displayName: string = "";           // 挂载点显示名称（如"主炮"、"副炮"）
	@type("number") mountOffsetX: number = 0;           // 挂载点位置 X（相对于船体中心）
	@type("number") mountOffsetY: number = 0;           // 挂载点位置 Y（船头方向为 -Y）
	@type("string") mountType: MountTypeValue = MountType.TURRET;
	@type("string") mountSize: WeaponSlotSizeValue = WeaponSlotSize.MEDIUM;  // 挂载点尺寸
	@type("number") mountFacing: number = 0;            // 武器基准朝向（相对于船体，0=朝船头）
	@type("number") currentTurretAngle: number = 0;     // 炮塔当前朝向（相对于船体，仅 TURRET）
	@type("number") arc: number = 180;                  // 射界角度范围

	// === 武器规格 ===
	@type("string") weaponSpecId: string = "";
	@type("string") instanceId: string = "";
	@type("string") name: string = "";
	@type("string") description: string = "";
	@type("string") category: WeaponCategoryValue = WeaponCategory.BALLISTIC;
	@type("string") damageType: DamageTypeValue = DamageType.KINETIC;
	@type("string") size: WeaponSlotSizeValue = WeaponSlotSize.MEDIUM;      // 武器尺寸

	// === 战斗属性 ===
	@type("number") damage: number = 0;
	@type("number") baseDamage: number = 0;
	@type("number") range: number = 0;              // 最大射程
	@type("number") minRange: number = 0;           // 最小射程（近距离无法开火）
	@type("number") fluxCost: number = 0;
	@type("number") fluxCostPerShot: number = 0;
	@type("boolean") ignoresShields: boolean = false;

	// === 连发系统 ===
	@type("number") burstSize: number = 1;           // 连发数量
	@type("number") burstDelay: number = 0.1;        // 连发间隔（秒）
	@type("number") burstRemaining: number = 0;      // 剩余连发数

	// === 冷却系统 ===
	@type("number") cooldownMax: number = 0;
	@type("number") cooldownRemaining: number = 0;

	// === 弹药系统 ===
	@type("number") maxAmmo: number = 0;             // 最大弹药（0=无限）
	@type("number") currentAmmo: number = 0;
	@type("number") reloadTime: number = 0;          // 装填时间（秒）
	@type("number") reloadProgress: number = 0;      // 装填进度（秒）

	// === 特殊效果 ===
	@type("number") empDamage: number = 0;           // EMP 伤害
	@type("number") tracking: number = 0;            // 追踪能力（0-1）
	@type(["string"]) tags = new ArraySchema<string>(); // 武器标签

	// === 资源系统 ===
	@type("number") opCost: number = 0;              // OP 点数成本

	// === 状态 ===
	@type("string") state: WeaponStateValue = WeaponState.READY;
	@type("boolean") hasFiredThisTurn: boolean = false;
	@type("boolean") isBuiltIn: boolean = false;     // 是否为内置武器（不可更换）

	// === UI ===
	@type("string") icon: string = "";               // 武器图标

	/**
	 * 执行开火
	 * @returns 是否成功开火
	 */
	fire(): boolean {
		if (this.state !== WeaponState.READY || this.cooldownRemaining > 0) return false;
		if (this.maxAmmo > 0 && this.currentAmmo <= 0) return false;

		this.cooldownRemaining = this.cooldownMax;
		this.hasFiredThisTurn = true;
		this.burstRemaining = this.burstSize - 1;  // 连发计数

		if (this.maxAmmo > 0) {
			this.currentAmmo--;
			if (this.currentAmmo <= 0) {
				this.state = WeaponState.OUT_OF_AMMO;
				this.reloadProgress = 0;
			}
		}

		return true;
	}

	/**
	 * 执行连发（burst 后续射击）
	 * @returns 是否成功连发
	 */
	fireBurst(): boolean {
		if (this.burstRemaining <= 0) return false;
		if (this.maxAmmo > 0 && this.currentAmmo <= 0) return false;

		this.burstRemaining--;
		if (this.maxAmmo > 0) this.currentAmmo--;

		return true;
	}

	/**
	 * 重置连发状态
	 */
	resetBurst(): void {
		this.burstRemaining = 0;
	}

	/**
	 * 检查是否为点防御武器
	 */
	isPD(): boolean {
		return this.tags.includes("PD");
	}

	/**
	 * 检查是否为制导武器
	 */
	isGuided(): boolean {
		return this.tags.includes("GUIDED");
	}
}

export class Transform extends Schema {
	@type("number") x: number = 0;
	@type("number") y: number = 0;
	@type("number") heading: number = 0;
	setPosition(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
	setHeading(h: number) {
		this.heading = ((h % 360) + 360) % 360;
	}
}

export class HullState extends Schema {
	@type("number") current: number = 100;
	@type("number") max: number = 100;
	get percent() { return (this.current / this.max) * 100; }
	takeDamage(n: number) {
		const d = Math.min(this.current, n);
		this.current -= d;
		return d;
	}
}

export class ArmorState extends Schema {
	@type("number") maxPerQuadrant: number = 100;
	@type(["number"]) quadrants = new ArraySchema<number>(100, 100, 100, 100, 100, 100);
	getQuadrant(i: number) { return this.quadrants[i] ?? 0; }
	setQuadrant(i: number, v: number) { this.quadrants[i] = Math.max(0, Math.min(this.maxPerQuadrant, v)); }
	takeDamage(i: number, n: number) {
		const d = Math.min(this.getQuadrant(i), n);
		this.setQuadrant(i, this.getQuadrant(i) - d);
		return d;
	}
}

export class FluxStateSchema extends Schema {
	@type("number") hard: number = 0;
	@type("number") soft: number = 0;
	@type("number") max: number = 100;
	@type("number") dissipation: number = 10;
	@type("string") state: FluxStateValue = FluxState.NORMAL;
	get total() { return this.hard + this.soft; }
	get percent() { return (this.total / this.max) * 100; }
	get isOverloaded() { return this.total >= this.max; }
	addHard(n: number) { this.hard = Math.min(this.max, this.hard + n); }
	addSoft(n: number) { this.soft = Math.min(this.max - this.hard, this.soft + n); }
	dissipate(dt: number) {
		const n = this.dissipation * dt;
		this.soft = Math.max(0, this.soft - n);
		if (this.soft <= 0) this.hard = Math.max(0, this.hard - n);
	}
	vent(dt: number) {
		const n = this.dissipation * 2 * dt;
		this.soft = Math.max(0, this.soft - n);
		this.hard = Math.max(0, this.hard - n);
		return n;
	}
}

export class ShieldState extends Schema {
	@type("string") type: ShieldTypeValue = ShieldType.FRONT;
	@type("boolean") active: boolean = false;
	@type("number") orientation: number = 0;
	@type("number") arc: number = 120;
	@type("number") radius: number = 50;
	@type("number") current: number = 100;
	@type("number") max: number = 100;
	activate() { this.active = true; }
	deactivate() { this.active = false; }
}

export class ShipState extends Schema {
	@type("string") id: string = "";
	@type("string") ownerId: string = "";
	@type("string") faction: FactionValue = Faction.PLAYER;
	@type("string") hullType: string = "";
	@type("string") name: string = "";
	@type("number") width: number = 20;
	@type("number") length: number = 40;
	@type(Transform) transform = new Transform();
	@type(HullState) hull = new HullState();
	@type(ArmorState) armor = new ArmorState();
	@type(ShieldState) shield = new ShieldState();
	@type(FluxStateSchema) flux = new FluxStateSchema();
	@type({ map: WeaponSlot }) weapons = new MapSchema<WeaponSlot>();
	@type("number") maxSpeed: number = 0;
	@type("number") maxTurnRate: number = 0;
	@type("boolean") isOverloaded: boolean = false;
	@type("number") overloadTime: number = 0;
	@type("boolean") isDestroyed: boolean = false;
	@type("boolean") hasMoved: boolean = false;
	@type("boolean") hasFired: boolean = false;
	@type("string") movePhase: MovePhaseValue = "PHASE_A";
	@type("number") phaseAForwardUsed: number = 0;
	@type("number") phaseAStrafeUsed: number = 0;
	@type("number") phaseTurnUsed: number = 0;
	@type("number") phaseCForwardUsed: number = 0;
	@type("number") phaseCStrafeUsed: number = 0;
}