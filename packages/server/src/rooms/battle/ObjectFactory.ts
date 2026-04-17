/**
 * 对象创建工厂
 *
 * 创建舰船、空间站、小行星等游戏对象
 */

import { ArraySchema } from "@colyseus/schema";
import {
	Faction,
	getShipHullSpec,
	getWeaponSpec,
	WeaponState,
	WeaponSlotSize,
	WeaponMountType,
	HARDPOINT_ARC,
	SlotCategory,
	STATION_SPEC,
	ASTEROID_SPEC,
	isWeaponSizeCompatible,
	isWeaponCategoryCompatible,
	isWeaponMountTypeCompatible,
} from "@vt/data";
import type { FactionValue, WeaponCategoryValue, DamageTypeValue, WeaponSlotSizeValue, WeaponMountTypeValue, SlotCategoryValue, WeaponTagValue } from "@vt/data";
import type { WeaponMountSpec, WeaponSpec } from "@vt/data";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { CreateObjectPayload } from "../../commands/types.js";
import { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";

/** 生成唯一 ID */
function generateId(prefix: string): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${prefix}_${timestamp}_${random}`;
}

/** 创建舰船（内部） */
function createShipFromSpec(
	hullId: string,
	x: number,
	y: number,
	heading: number,
	faction: FactionValue,
	ownerId?: string
): ShipState | null {
	const spec = getShipHullSpec(hullId);
	if (!spec) return null;

	const ship = new ShipState();
	ship.id = generateId("ship");
	ship.faction = faction;
	ship.hullType = hullId;
	ship.ownerId = ownerId ?? "";
	ship.name = spec.name;
	ship.width = spec.width;
	ship.length = spec.length;

	ship.transform.setPosition(x, y);
	ship.transform.setHeading(heading);

	ship.hull.max = spec.hitPoints;
	ship.hull.current = spec.hitPoints;

	ship.armor.maxPerQuadrant = spec.armorMax;
	// 初始化护甲减伤比属性
	ship.armor.maxReductionRatio = spec.maxArmorReductionRatio ?? 0.85;
	ship.armor.minReductionRatio = spec.minArmorReductionRatio ?? 0.1;
	for (let i = 0; i < 6; i++) {
		ship.armor.setQuadrant(i, spec.armorMax);
	}

	ship.flux.max = spec.fluxCapacity;
	ship.flux.dissipation = spec.fluxDissipation;

	ship.maxSpeed = spec.maxSpeed;
	ship.maxTurnRate = spec.maxTurnRate;

	// 初始化射程比率
	ship.rangeRatio = spec.rangeRatio ?? 1.0;

	// 显式初始化移动阶段使用量（确保同步到客户端）
	ship.phaseAForwardUsed = 0;
	ship.phaseAStrafeUsed = 0;
	ship.phaseTurnUsed = 0;
	ship.phaseCForwardUsed = 0;
	ship.phaseCStrafeUsed = 0;

	// 初始化护盾属性
	ship.shield.arc = spec.shieldArc;
	ship.shield.radius = spec.shieldRadius;
	ship.shield.efficiency = spec.shieldEfficiency ?? 1.0;  // 护盾效率

	// 初始化武器
	for (const mount of spec.weaponMounts) {
		const weaponSpec = mount.defaultWeapon ? getWeaponSpec(mount.defaultWeapon) : null;
		if (weaponSpec) {
			// 验证尺寸兼容性
			if (!isWeaponSizeCompatible(mount.size, weaponSpec.size)) {
				console.warn(`武器 ${weaponSpec.name} (${weaponSpec.size}) 不兼容挂载点 ${mount.id} (${mount.size})`);
				continue;
			}
			// 验证类别兼容性（远行星号机制）
			if (!isWeaponCategoryCompatible(mount.slotCategory, weaponSpec.category)) {
				console.warn(`武器 ${weaponSpec.name} (${weaponSpec.category}) 不兼容挂载点 ${mount.id} (${mount.slotCategory})`);
				continue;
			}
			// 验证形态兼容性（远行星号机制）
			if (!isWeaponMountTypeCompatible(mount.acceptsTurret, mount.acceptsHardpoint, weaponSpec.mountType)) {
				console.warn(`武器 ${weaponSpec.name} (${weaponSpec.mountType}) 不符合挂载点 ${mount.id} 形态限制 (turret:${mount.acceptsTurret}, hardpoint:${mount.acceptsHardpoint})`);
				continue;
			}
			ship.weapons.set(mount.id, createWeaponSlot(mount, weaponSpec));
		}
	}

	// 初始化内置武器（不可更换）
	if (spec.builtInWeapons) {
		for (const entry of spec.builtInWeapons) {
			const mount = spec.weaponMounts.find(m => m.id === entry.mountId);
			const weaponSpec = getWeaponSpec(entry.weaponId);
			if (mount && weaponSpec) {
				const weapon = createWeaponSlot(mount, weaponSpec);
				weapon.isBuiltIn = true;  // 标记为内置武器
				ship.weapons.set(mount.id, weapon);
			}
		}
	}

	return ship;
}

/** 创建空间站（内部） */
function createStationFromSpec(x: number, y: number, heading: number): ShipState | null {
	const spec = STATION_SPEC;
	const station = new ShipState();

	station.id = generateId("station");
	station.hullType = spec.id;
	station.name = spec.name;
	station.transform.setPosition(x, y);
	station.transform.setHeading(heading);

	station.hull.max = spec.hitPoints;
	station.hull.current = spec.hitPoints;

	station.armor.maxPerQuadrant = spec.armorMax;
	const armorDist = [300, 300, 300, 200, 300, 300];
	for (let i = 0; i < 6; i++) {
		station.armor.setQuadrant(i, armorDist[i]);
	}

	station.flux.max = 0;
	station.maxSpeed = 0;
	station.maxTurnRate = 0;

	return station;
}

/** 创建小行星（内部） */
function createAsteroidFromSpec(x: number, y: number, heading = 0): ShipState | null {
	const spec = ASTEROID_SPEC;
	const asteroid = new ShipState();

	asteroid.id = generateId("asteroid");
	asteroid.hullType = spec.id;
	asteroid.name = spec.name;
	asteroid.transform.setPosition(x, y);
	asteroid.transform.setHeading(heading);

	asteroid.hull.max = spec.hitPoints;
	asteroid.hull.current = spec.hitPoints;

	asteroid.armor.maxPerQuadrant = spec.armorMax;
	for (let i = 0; i < 6; i++) {
		asteroid.armor.setQuadrant(i, spec.armorMax);
	}

	asteroid.flux.max = 0;
	asteroid.maxSpeed = 0;
	asteroid.maxTurnRate = 0;

	return asteroid;
}

/** 创建武器槽位（内部） */
function createWeaponSlot(mount: WeaponMountSpec, spec: WeaponSpec): WeaponSlot {
	const weapon = new WeaponSlot();

	// === 挂载点信息 ===
	weapon.mountId = mount.id;
	weapon.displayName = mount.displayName ?? mount.id;  // 挂载点显示名称
	weapon.mountOffsetX = mount.position?.x ?? 0;
	weapon.mountOffsetY = mount.position?.y ?? 0;
	weapon.mountType = spec.mountType as WeaponMountTypeValue; // 武器形态（从武器规格继承）
	weapon.mountSize = mount.size as WeaponSlotSizeValue;      // 挂载点尺寸
	weapon.mountFacing = mount.facing;                          // 基准朝向
	weapon.currentTurretAngle = mount.facing;                   // 炮塔初始朝向等于基准朝向

	// === 挂载点限制（从挂载点规格继承） ===
	weapon.slotCategory = mount.slotCategory as SlotCategoryValue;
	weapon.acceptsTurret = mount.acceptsTurret ?? true;
	weapon.acceptsHardpoint = mount.acceptsHardpoint ?? true;

	// === 武器射界（从武器规格继承） ===
	weapon.arc = spec.arc ?? 180;                              // 炮塔型武器射界
	weapon.hardpointArc = spec.hardpointArc ?? HARDPOINT_ARC;  // 硬点型武器射界（默认 20°）

	// === 武器规格 ===
	weapon.weaponSpecId = spec.id;
	weapon.instanceId = generateId("weapon");
	weapon.name = spec.name;
	weapon.description = spec.description ?? "";
	weapon.category = spec.category as WeaponCategoryValue;
	weapon.damageType = spec.damageType as DamageTypeValue;
	weapon.size = spec.size as WeaponSlotSizeValue;

	// === 战斗属性 ===
	weapon.damage = spec.damage;
	weapon.baseDamage = spec.damage;
	weapon.range = spec.range;
	weapon.minRange = spec.minRange ?? 0;           // 最小射程
	weapon.fluxCost = spec.fluxCost;
	weapon.fluxCostPerShot = spec.fluxCost;
	weapon.ignoresShields = spec.ignoresShields;

	// === 连发系统 ===
	weapon.burstSize = spec.burstSize ?? 1;
	weapon.burstDelay = spec.burstDelay ?? 0.1;
	weapon.burstRemaining = 0;

	// === 冷却系统 ===
	weapon.cooldownMax = spec.cooldown;
	weapon.cooldownRemaining = 0;

	// === 弹药系统 ===
	weapon.maxAmmo = spec.ammo ?? 0;
	weapon.currentAmmo = spec.ammo ?? 0;
	weapon.reloadTime = spec.reloadTime ?? 0;
	weapon.reloadProgress = 0;

	// === 特殊效果 ===
	weapon.empDamage = spec.empDamage ?? 0;
	weapon.tracking = spec.tracking ?? 0;

	// 武器标签
	if (spec.tags && spec.tags.length > 0) {
		weapon.tags = new ArraySchema<string>(...spec.tags);
	}

	// === 节源系统 ===
	weapon.opCost = spec.opCost;

	// === 状态 ===
	weapon.state = WeaponState.READY;
	weapon.hasFiredThisTurn = false;
	weapon.isBuiltIn = false;

	// === UI ===
	weapon.icon = spec.icon ?? "";

	return weapon;
}

export class ObjectFactory {
	/** 创建游戏对象并添加到状态 */
	create(state: GameRoomState, payload: CreateObjectPayload): ShipState | null {
		const heading = payload.heading ?? 0;
		const faction = payload.faction ?? Faction.PLAYER;

		let ship: ShipState | null;

		if (payload.type === "ship" && payload.hullId) {
			ship = createShipFromSpec(payload.hullId, payload.x, payload.y, heading, faction, payload.ownerId);
		} else if (payload.type === "station") {
			ship = createStationFromSpec(payload.x, payload.y, heading);
		} else {
			ship = createAsteroidFromSpec(payload.x, payload.y, heading);
		}

		if (ship) {
			ship.faction = faction;
			if (payload.name) ship.name = payload.name;
			state.ships.set(ship.id, ship);
		}

		return ship;
	}

	/** 仅创建舰船（不添加到状态） */
	createShip(
		hullId: string,
		x: number,
		y: number,
		heading: number,
		faction: FactionValue,
		ownerId?: string
	): ShipState | null {
		return createShipFromSpec(hullId, x, y, heading, faction, ownerId);
	}

	/** 仅创建空间站（不添加到状态） */
	createStation(x: number, y: number, heading: number): ShipState | null {
		return createStationFromSpec(x, y, heading);
	}

	/** 仅创建小行星（不添加到状态） */
	createAsteroid(x: number, y: number, heading = 0): ShipState | null {
		return createAsteroidFromSpec(x, y, heading);
	}

	/**
	 * 更换舰船武器
	 * @param ship 目标舰船
	 * @param mountId 挂载点 ID
	 * @param weaponSpecId 新武器规格 ID（空字符串表示清空）
	 * @returns 是否成功更换
	 */
	replaceWeapon(ship: ShipState, mountId: string, weaponSpecId: string): boolean {
		// 查找挂载点
		const existingWeapon = ship.weapons.get(mountId);
		if (!existingWeapon) {
			console.warn(`挂载点 ${mountId} 不存在`);
			return false;
		}

		// 检查是否为内置武器
		if (existingWeapon.isBuiltIn) {
			console.warn(`挂载点 ${mountId} 为内置武器，不可更换`);
			return false;
		}

		// 清空武器
		if (!weaponSpecId) {
			ship.weapons.delete(mountId);
			return true;
		}

		// 获取舰船规格以查找挂载点信息
		const hullSpec = getShipHullSpec(ship.hullType);
		if (!hullSpec) return false;

		const mount = hullSpec.weaponMounts.find(m => m.id === mountId);
		if (!mount) return false;

		// 获取新武器规格
		const newWeaponSpec = getWeaponSpec(weaponSpecId);
		if (!newWeaponSpec) {
			console.warn(`武器规格 ${weaponSpecId} 不存在`);
			return false;
		}

		// 验证尺寸兼容性
		if (!isWeaponSizeCompatible(mount.size, newWeaponSpec.size)) {
			console.warn(`武器 ${newWeaponSpec.name} (${newWeaponSpec.size}) 不兼容挂载点 ${mountId} (${mount.size})`);
			return false;
		}

		// 验证类别兼容性（远行星号机制）
		if (!isWeaponCategoryCompatible(mount.slotCategory, newWeaponSpec.category)) {
			console.warn(`武器 ${newWeaponSpec.name} (${newWeaponSpec.category}) 不兼容挂载点 ${mountId} (${mount.slotCategory})`);
			return false;
		}

		// 验证形态兼容性（远行星号机制）
		if (!isWeaponMountTypeCompatible(mount.acceptsTurret, mount.acceptsHardpoint, newWeaponSpec.mountType)) {
			console.warn(`武器 ${newWeaponSpec.name} (${newWeaponSpec.mountType}) 不符合挂载点 ${mountId} 形态限制`);
			return false;
		}

		// 创建新武器
		const newWeapon = createWeaponSlot(mount, newWeaponSpec);
		ship.weapons.set(mountId, newWeapon);

		return true;
	}
}