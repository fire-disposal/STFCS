/**
 * 舰船状态 Schema
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import {
	DamageType,
	WeaponCategory,
	MountType,
	WeaponState,
	ShieldType,
	FluxState,
	Faction,
} from "./types.js";
import type {
	DamageTypeValue,
	WeaponCategoryValue,
	MountTypeValue,
	WeaponStateValue,
	ShieldTypeValue,
	FluxStateValue,
	FactionValue,
	MovePhaseValue,
} from "./types.js";

export class WeaponSlot extends Schema {
	@type("string") mountId: string = "";
	@type("number") mountOffsetX: number = 0;
	@type("number") mountOffsetY: number = 0;
	@type("string") weaponSpecId: string = "";
	@type("string") instanceId: string = "";
	@type("string") name: string = "";
	@type("string") category: WeaponCategoryValue = WeaponCategory.BALLISTIC;
	@type("string") damageType: DamageTypeValue = DamageType.KINETIC;
	@type("string") mountType: MountTypeValue = MountType.TURRET;
	@type("number") mountFacing: number = 0;
	@type("number") arcMin: number = -90;
	@type("number") arcMax: number = 90;
	@type("number") arc: number = 180;
	@type("number") damage: number = 0;
	@type("number") baseDamage: number = 0;
	@type("number") range: number = 0;
	@type("number") fluxCost: number = 0;
	@type("number") fluxCostPerShot: number = 0;
	@type("number") cooldownMax: number = 0;
	@type("number") cooldownRemaining: number = 0;
	@type("number") maxAmmo: number = 0;
	@type("number") currentAmmo: number = 0;
	@type("number") reloadTime: number = 0;
	@type("string") state: WeaponStateValue = WeaponState.READY;
	@type("boolean") hasFiredThisTurn: boolean = false;
	@type("boolean") ignoresShields: boolean = false;

	fire(): boolean {
		if (this.state !== WeaponState.READY || this.cooldownRemaining > 0) return false;
		this.cooldownRemaining = this.cooldownMax;
		this.hasFiredThisTurn = true;
		if (this.maxAmmo > 0) this.currentAmmo--;
		return true;
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