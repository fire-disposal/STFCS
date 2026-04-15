/**
 * 舰船工厂
 *
 * 创建舰船、空间站、小行星等对象
 */

import { getShipHullSpec, getWeaponSpec } from "@vt/data";
import type { DamageTypeValue, FactionValue, WeaponCategoryValue } from "../schema/types.js";
import { WeaponState } from "../schema/types.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";

export function createShip(
	hullId: string,
	x: number,
	y: number,
	heading: number,
	faction: FactionValue,
	ownerId?: string
): ShipState | null {
	const spec = getShipHullSpec(hullId);
	if (!spec) {
		console.error(`[ShipFactory] Hull not found: ${hullId}`);
		return null;
	}

	const ship = new ShipState();
	ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	ship.faction = faction;
	ship.hullType = hullId;
	ship.ownerId = ownerId || "";
	ship.name = spec.name;
	ship.width = spec.width;
	ship.length = spec.length;

	ship.setPosition(x, y);
	ship.setHeading(heading);

	ship.hull.max = spec.hitPoints;
	ship.hull.current = spec.hitPoints;

	ship.armor.maxPerQuadrant = spec.armorMax;
	const armorDist = Array(6).fill(spec.armorMax);
	armorDist.forEach((value, index) => {
		ship.armor.setQuadrant(index, value);
	});

	ship.flux.max = spec.fluxCapacity;
	ship.flux.dissipation = spec.fluxDissipation;

	ship.maxSpeed = spec.maxSpeed;
	ship.maxTurnRate = spec.maxTurnRate;

	ship.shield.arc = spec.shieldArc;
	ship.shield.radius = spec.shieldRadius;

	for (const mount of spec.weaponMounts) {
		const weaponSpec = mount.defaultWeapon ? getWeaponSpec(mount.defaultWeapon) : null;
		if (weaponSpec) {
			ship.weapons.set(mount.id, createWeaponSlot(mount, weaponSpec));
		}
	}

	console.log(`[ShipFactory] Created ${spec.name} at (${x}, ${y})`);
	return ship;
}

export function createStation(x: number, y: number, heading: number): ShipState {
	const station = new ShipState();
	station.id = `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	station.hullType = "station";
	station.name = "Space Station";
	station.setPosition(x, y);
	station.setHeading(heading);

	station.hull.max = 5000;
	station.hull.current = 5000;

	station.armor.maxPerQuadrant = 300;
	[300, 300, 300, 200, 300, 300].forEach((value, index) => {
		station.armor.setQuadrant(index, value);
	});

	station.flux.max = 0;
	station.maxSpeed = 0;
	station.maxTurnRate = 0;

	console.log(`[ShipFactory] Created station at (${x}, ${y})`);
	return station;
}

export function createAsteroid(x: number, y: number, heading = 0): ShipState {
	const asteroid = new ShipState();
	asteroid.id = `asteroid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	asteroid.hullType = "asteroid";
	asteroid.name = "Asteroid";
	asteroid.setPosition(x, y);
	asteroid.setHeading(heading);

	asteroid.hull.max = 2000;
	asteroid.hull.current = 2000;

	asteroid.armor.maxPerQuadrant = 200;
	Array(6)
		.fill(200)
		.forEach((value, index) => {
			asteroid.armor.setQuadrant(index, value);
		});

	asteroid.flux.max = 0;
	asteroid.maxSpeed = 0;
	asteroid.maxTurnRate = 0;

	console.log(`[ShipFactory] Created asteroid at (${x}, ${y})`);
	return asteroid;
}

function createWeaponSlot(
	mount: { id: string; facing: number; arc: number; position?: { x: number; y: number } },
	spec: {
		id: string;
		name: string;
		category: string;
		damageType: string;
		damage: number;
		range: number;
		fluxCost: number;
		cooldown: number;
		ammo: number;
		reloadTime: number;
		ignoresShields: boolean;
	}
): WeaponSlot {
	const weapon = new WeaponSlot();
	weapon.mountId = mount.id;
	weapon.mountOffsetX = mount.position?.x ?? 0;
	weapon.mountOffsetY = mount.position?.y ?? 0;
	weapon.weaponSpecId = spec.id;
	weapon.instanceId = `${mount.id}_${Date.now()}`;
	weapon.name = spec.name;
	weapon.category = spec.category as WeaponCategoryValue;
	weapon.damageType = spec.damageType as DamageTypeValue;

	weapon.mountFacing = mount.facing;
	weapon.arcMin = mount.facing - mount.arc / 2;
	weapon.arcMax = mount.facing + mount.arc / 2;
	weapon.arc = mount.arc;

	weapon.damage = spec.damage;
	weapon.baseDamage = spec.damage;
	weapon.range = spec.range;
	weapon.fluxCost = spec.fluxCost;
	weapon.fluxCostPerShot = spec.fluxCost;

	weapon.cooldownMax = spec.cooldown;
	weapon.maxAmmo = spec.ammo;
	weapon.currentAmmo = spec.ammo;
	weapon.reloadTime = spec.reloadTime;

	weapon.state = WeaponState.READY;
	weapon.ignoresShields = spec.ignoresShields;

	return weapon;
}