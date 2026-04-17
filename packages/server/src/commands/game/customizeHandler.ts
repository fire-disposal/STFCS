/**
 * 舰船自定义命令处理器
 *
 * 支持 DM 完整舰船自定义：
 * - 属性修改（生存/辐能/护盾/机动）
 * - 武器挂点管理（添加/删除/更新）
 * - 贴图设置
 *
 * 设计理念：
 * - 舰船实例与模板语义平等
 * - 高自由度自定义，依赖DM人工审查
 * - 所有属性可编辑
 */

import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState } from "../../schema/ShipStateSchema.js";
import { WeaponSlot, ShieldState, ArmorState, FluxStateSchema, HullState } from "../../schema/ShipStateSchema.js";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import {
	WeaponState,
	WeaponMountType,
	HARDPOINT_ARC,
	ShieldType,
	WeaponSlotSize,
	SlotCategory,
	Faction,
} from "@vt/data";
import { validateDmAuthority } from "./utils.js";
import type {
	CustomizeShipPayload,
	AddWeaponMountPayload,
	RemoveWeaponMountPayload,
	UpdateWeaponMountPayload,
	SetShipTexturePayload,
} from "../types.js";
import type { CustomWeaponMount, TextureConfig } from "@vt/data";

/** 自定义结果 */
export interface CustomizeResult {
	success: boolean;
	shipId: string;
	warnings: string[];
}

/**
 * 处理舰船完整自定义命令
 *
 * DM专用命令，支持舰船所有属性的编辑
 */
export function handleCustomizeShip(
	state: GameRoomState,
	client: Client,
	payload: CustomizeShipPayload
): CustomizeResult {
	const result: CustomizeResult = {
		success: false,
		shipId: payload.shipId,
		warnings: [],
	};

	// 验证权限（仅 DM）
	validateDmAuthority(state, client);

	// 验证舰船存在
	const ship = state.ships.get(payload.shipId);
	if (!ship) {
		throw new Error(`舰船不存在: ${payload.shipId}`);
	}

	// 应用所有提供的更新
	applyShipCustomization(ship, payload);

	result.success = true;
	result.warnings.push("舰船配置已更新");

	return result;
}

/**
 * 应用舰船自定义配置
 */
function applyShipCustomization(ship: ShipState, payload: CustomizeShipPayload): void {
	// === 基本信息 ===
	if (payload.name) ship.name = payload.name;
	if (payload.hullType) ship.hullType = payload.hullType;
	if (payload.width) ship.width = payload.width;
	if (payload.length) ship.length = payload.length;

	// === 生存属性 ===
	if (payload.hullPointsMax) {
		ship.hull.max = payload.hullPointsMax;
		// 确保当前值不超过上限
		if (ship.hull.current > payload.hullPointsMax) {
			ship.hull.current = payload.hullPointsMax;
		}
	}
	if (payload.hullPointsCurrent !== undefined) {
		ship.hull.current = Math.min(payload.hullPointsCurrent, ship.hull.max);
	}
	if (payload.armorMaxPerQuadrant) {
		ship.armor.maxPerQuadrant = payload.armorMaxPerQuadrant;
		// 确保各象限值不超过上限
		for (let i = 0; i < 6; i++) {
			if (ship.armor.quadrants[i] > payload.armorMaxPerQuadrant) {
				ship.armor.quadrants[i] = payload.armorMaxPerQuadrant;
			}
		}
	}
	if (payload.armorQuadrants) {
		for (let i = 0; i < 6; i++) {
			ship.armor.quadrants[i] = Math.min(
				payload.armorQuadrants[i],
				ship.armor.maxPerQuadrant
			);
		}
	}
	if (payload.armorMinReductionRatio !== undefined) {
		ship.armor.minReductionRatio = payload.armorMinReductionRatio;
	}
	if (payload.armorMaxReductionRatio !== undefined) {
		ship.armor.maxReductionRatio = payload.armorMaxReductionRatio;
	}

	// === 辐能系统 ===
	if (payload.fluxCapacityMax) {
		ship.flux.max = payload.fluxCapacityMax;
		// 确保当前值不超过上限
		if (ship.flux.soft + ship.flux.hard > payload.fluxCapacityMax) {
			ship.flux.soft = Math.min(ship.flux.soft, payload.fluxCapacityMax);
			ship.flux.hard = Math.min(
				payload.fluxCapacityMax - ship.flux.soft,
				ship.flux.hard
			);
		}
	}
	if (payload.fluxDissipation) ship.flux.dissipation = payload.fluxDissipation;
	if (payload.fluxSoftCurrent !== undefined) {
		ship.flux.soft = Math.min(payload.fluxSoftCurrent, ship.flux.max - ship.flux.hard);
	}
	if (payload.fluxHardCurrent !== undefined) {
		ship.flux.hard = Math.min(payload.fluxHardCurrent, ship.flux.max);
	}

	// === 护盾系统 ===
	if (payload.shieldType) {
		ship.shield.type = payload.shieldType as any;
		if (payload.shieldType === "NONE") {
			ship.shield.active = false;
		}
	}
	if (payload.shieldArc) ship.shield.arc = payload.shieldArc;
	if (payload.shieldEfficiency) ship.shield.efficiency = payload.shieldEfficiency;
	if (payload.shieldRadius) ship.shield.radius = payload.shieldRadius;
	if (payload.shieldUpCost !== undefined) {
		// 护盾维持成本（需要在其他地方处理）
	}

	// === 机动属性 ===
	if (payload.maxSpeed) ship.maxSpeed = payload.maxSpeed;
	if (payload.maxTurnRate) ship.maxTurnRate = payload.maxTurnRate;

	// === 武器挂点 ===
	if (payload.weaponMounts) {
		applyWeaponMounts(ship, payload.weaponMounts);
	}

	// === 其他 ===
	if (payload.rangeModifier !== undefined) {
		ship.rangeRatio = payload.rangeModifier;
	}
}

/**
 * 应用武器挂点配置
 *
 * 支持添加、更新、删除挂点
 */
function applyWeaponMounts(ship: ShipState, mounts: CustomWeaponMount[]): void {
	// 清空现有挂点（保留内置武器）
	const builtinWeapons: WeaponSlot[] = [];
	ship.weapons.forEach((weapon) => {
		if (weapon.isBuiltIn) {
			builtinWeapons.push(weapon);
		}
	});
	ship.weapons.clear();

	// 添加内置武器
	builtinWeapons.forEach((weapon) => {
		ship.weapons.set(weapon.mountId, weapon);
	});

	// 应用新的挂点配置
	for (const mount of mounts) {
		if (mount.builtin && mount.builtinWeaponSpec) {
			// 内置武器
			const slot = createWeaponSlotFromMount(mount, mount.builtinWeaponSpec, true);
			ship.weapons.set(mount.id, slot);
		} else {
			// 可配置挂点
			if (mount.currentWeaponId) {
				// 有安装武器
				const slot = createWeaponSlotFromMountId(mount, mount.currentWeaponId);
				ship.weapons.set(mount.id, slot);
			} else {
				// 空挂点
				const emptySlot = createEmptyWeaponSlot(mount);
				ship.weapons.set(mount.id, emptySlot);
			}
		}
	}
}

/**
 * 从挂点配置创建武器槽位
 */
function createWeaponSlotFromMount(
	mount: CustomWeaponMount,
	weaponSpec: any,
	isBuiltIn: boolean
): WeaponSlot {
	const slot = new WeaponSlot();

	// 挂载点信息
	slot.mountId = mount.id;
	slot.displayName = mount.displayName || mount.id;
	slot.mountOffsetX = mount.position.x;
	slot.mountOffsetY = mount.position.y;
	slot.mountType = mount.mountType === "turret" ? WeaponMountType.TURRET : WeaponMountType.HARDPOINT;
	slot.mountSize = mount.size as any;
	slot.mountFacing = mount.facing;
	slot.slotCategory = mount.slotCategory as any;
	slot.acceptsTurret = mount.acceptsTurret;
	slot.acceptsHardpoint = mount.acceptsHardpoint;
	slot.arc = mount.arc;
	slot.hardpointArc = mount.hardpointArc || HARDPOINT_ARC;

	// 武器规格
	slot.weaponSpecId = weaponSpec.id || `custom_${mount.id}`;
	slot.instanceId = `${mount.id}_${Date.now()}`;
	slot.name = weaponSpec.name || "Custom Weapon";
	slot.category = weaponSpec.category as any;
	slot.damageType = weaponSpec.damageType as any;
	slot.size = mount.size as any;
	slot.damage = weaponSpec.damage || 0;
	slot.baseDamage = weaponSpec.damage || 0;
	slot.range = weaponSpec.range || 0;
	slot.minRange = weaponSpec.minRange || 0;
	slot.fluxCost = weaponSpec.fluxCost || 0;
	slot.fluxCostPerShot = weaponSpec.fluxCost || 0;
	slot.cooldownMax = weaponSpec.cooldown || 1;
	slot.cooldownRemaining = 0;
	slot.burstSize = weaponSpec.burstSize || 1;
	slot.burstDelay = weaponSpec.burstDelay || 0.1;
	slot.maxAmmo = weaponSpec.ammo || 0;
	slot.currentAmmo = weaponSpec.ammo || 0;
	slot.empDamage = weaponSpec.empDamage || 0;
	slot.tracking = weaponSpec.tracking || 0;
	slot.opCost = weaponSpec.opCost || 0;
	slot.ignoresShields = weaponSpec.ignoresShields || false;
	slot.isBuiltIn = isBuiltIn;
	slot.state = WeaponState.READY;

	return slot;
}

/**
 * 从武器ID创建武器槽位
 */
function createWeaponSlotFromMountId(mount: CustomWeaponMount, weaponSpecId: string): WeaponSlot {
	// 这里需要从武器规格获取详细信息
	// 由于 @vt/data 的 getWeaponSpec 函数可能不包含自定义武器，这里做简化处理
	const slot = new WeaponSlot();

	// 挂载点信息
	slot.mountId = mount.id;
	slot.displayName = mount.displayName || mount.id;
	slot.mountOffsetX = mount.position.x;
	slot.mountOffsetY = mount.position.y;
	slot.mountType = mount.mountType === "turret" ? WeaponMountType.TURRET : WeaponMountType.HARDPOINT;
	slot.mountSize = mount.size as any;
	slot.mountFacing = mount.facing;
	slot.slotCategory = mount.slotCategory as any;
	slot.acceptsTurret = mount.acceptsTurret;
	slot.acceptsHardpoint = mount.acceptsHardpoint;
	slot.arc = mount.arc;
	slot.hardpointArc = mount.hardpointArc || HARDPOINT_ARC;

	// 武器规格ID
	slot.weaponSpecId = weaponSpecId;
	slot.instanceId = `${mount.id}_${Date.now()}`;
	slot.name = weaponSpecId;
	slot.size = mount.size as any;
	slot.isBuiltIn = false;
	slot.state = WeaponState.READY;

	return slot;
}

/**
 * 创建空挂点槽位
 */
function createEmptyWeaponSlot(mount: CustomWeaponMount): WeaponSlot {
	const slot = new WeaponSlot();

	slot.mountId = mount.id;
	slot.displayName = mount.displayName || mount.id;
	slot.mountOffsetX = mount.position.x;
	slot.mountOffsetY = mount.position.y;
	slot.mountType = mount.mountType === "turret" ? WeaponMountType.TURRET : WeaponMountType.HARDPOINT;
	slot.mountSize = mount.size as any;
	slot.mountFacing = mount.facing;
	slot.slotCategory = mount.slotCategory as any;
	slot.acceptsTurret = mount.acceptsTurret;
	slot.acceptsHardpoint = mount.acceptsHardpoint;
	slot.arc = mount.arc;
	slot.hardpointArc = mount.hardpointArc || HARDPOINT_ARC;

	// 空挂点
	slot.weaponSpecId = "";
	slot.instanceId = "";
	slot.isBuiltIn = false;
	slot.state = WeaponState.READY;

	return slot;
}

/**
 * 处理添加武器挂点命令
 */
export function handleAddWeaponMount(
	state: GameRoomState,
	client: Client,
	payload: AddWeaponMountPayload
): void {
	validateDmAuthority(state, client);

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);

	// 检查挂点ID是否已存在
	if (ship.weapons.has(payload.mount.id)) {
		throw new Error(`挂点ID已存在: ${payload.mount.id}`);
	}

	// 创建新挂点
	const slot = createEmptyWeaponSlot(payload.mount);
	ship.weapons.set(payload.mount.id, slot);
}

/**
 * 处理删除武器挂点命令
 */
export function handleRemoveWeaponMount(
	state: GameRoomState,
	client: Client,
	payload: RemoveWeaponMountPayload
): void {
	validateDmAuthority(state, client);

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);

	const weapon = ship.weapons.get(payload.mountId);
	if (!weapon) throw new Error(`挂点不存在: ${payload.mountId}`);

	if (weapon.isBuiltIn) {
		throw new Error("内置武器挂点不可删除");
	}

	ship.weapons.delete(payload.mountId);
}

/**
 * 处理更新武器挂点命令
 */
export function handleUpdateWeaponMount(
	state: GameRoomState,
	client: Client,
	payload: UpdateWeaponMountPayload
): void {
	validateDmAuthority(state, client);

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);

	const weapon = ship.weapons.get(payload.mountId);
	if (!weapon) throw new Error(`挂点不存在: ${payload.mountId}`);

	if (weapon.isBuiltIn) {
		throw new Error("内置武器挂点不可修改");
	}

	// 应用更新
	const updates = payload.updates;
	if (updates.displayName) weapon.displayName = updates.displayName;
	if (updates.position) {
		weapon.mountOffsetX = updates.position.x;
		weapon.mountOffsetY = updates.position.y;
	}
	if (updates.facing !== undefined) weapon.mountFacing = updates.facing;
	if (updates.arc !== undefined) weapon.arc = updates.arc;
	if (updates.hardpointArc !== undefined) weapon.hardpointArc = updates.hardpointArc;
	if (updates.size) weapon.mountSize = updates.size as any;
	if (updates.mountType) {
		weapon.mountType = updates.mountType === "turret" ? WeaponMountType.TURRET : WeaponMountType.HARDPOINT;
	}
	if (updates.slotCategory) weapon.slotCategory = updates.slotCategory as any;
	if (updates.acceptsTurret !== undefined) weapon.acceptsTurret = updates.acceptsTurret;
	if (updates.acceptsHardpoint !== undefined) weapon.acceptsHardpoint = updates.acceptsHardpoint;
}

/**
 * 处理设置舰船贴图命令
 *
 * 贴图配置存储在舰船的自定义属性中
 * 注意：当前 Schema 可能不支持贴图字段，需要扩展
 */
export function handleSetShipTexture(
	state: GameRoomState,
	client: Client,
	payload: SetShipTexturePayload
): void {
	validateDmAuthority(state, client);

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);

	// TODO: 扩展 ShipState Schema 支持贴图字段
	// 当前仅记录日志，实际应用需要扩展 Schema
	console.log(`[CustomizeHandler] Set texture for ship ${payload.shipId}:`, payload.texture);

	// 未来实现：
	// ship.texture = new TextureConfigSchema();
	// ship.texture.sourceType = payload.texture.sourceType;
	// ...
}