/**
 * 武器和舰船配置命令处理器
 *
 * 支持：
 * - 武器更换（CMD_CONFIGURE_WEAPON）
 * - 舰船变体配置（CMD_CONFIGURE_VARIANT）
 * - OP 点数验证
 */

import type { Client } from "@colyseus/core";
import { getShipHullSpec, getWeaponSpec, isWeaponSizeCompatible, isWeaponCategoryCompatible, isWeaponMountTypeCompatible, WeaponState } from "@vt/data";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState } from "../../schema/ShipStateSchema.js";
import { ObjectFactory } from "../../rooms/battle/ObjectFactory.js";
import { validateDmAuthority, validateAuthority } from "./utils.js";
import type { ConfigureWeaponPayload, ConfigureVariantPayload, WeaponLoadoutEntry } from "../types.js";

/** 配置结果 */
export interface ConfigureResult {
	success: boolean;
	opUsed: number;
	opMax: number;
	opExceeded: boolean;
	warnings: string[];
}

/**
 * 处理武器配置命令
 *
 * DM 可以更换舰船的武器配置
 * 玩家在部署阶段也可以配置自己的舰船
 *
 * 验证：
 * - 武器尺寸与挂载点尺寸兼容
 * - 武器类型符合挂载点限制
 * - 武器非内置（不可更换）
 * - OP 点数预算（软限制）
 */
export function handleConfigureWeapon(
	state: GameRoomState,
	client: Client,
	payload: ConfigureWeaponPayload
): ConfigureResult {
	const result: ConfigureResult = {
		success: false,
		opUsed: 0,
		opMax: 0,
		opExceeded: false,
		warnings: [],
	};

	// 验证舰船存在
	const ship = state.ships.get(payload.shipId);
	if (!ship) {
		throw new Error("舰船不存在");
	}

	// 验证权限
	// DM 可以配置任何舰船
	// 玩家只能配置自己的舰船（且仅在部署阶段）
	const player = state.players.get(client.sessionId);
	if (!player) throw new Error("玩家未注册");

	if (player.role !== "DM") {
		// 玩家权限检查
		if (state.currentPhase !== "DEPLOYMENT") {
			throw new Error("仅部署阶段可配置武器");
		}
		if (ship.ownerId !== client.sessionId) {
			throw new Error("只能配置自己的舰船");
		}
	}

	// 获取舰船规格
	const hullSpec = getShipHullSpec(ship.hullType);
	if (!hullSpec) {
		throw new Error("舰船规格不存在");
	}

	// 获取挂载点信息
	const mount = hullSpec.weaponMounts.find(m => m.id === payload.mountId);
	if (!mount) {
		throw new Error(`挂载点 ${payload.mountId} 不存在`);
	}

	// 检查现有武器是否为内置
	const existingWeapon = ship.weapons.get(payload.mountId);
	if (existingWeapon?.isBuiltIn) {
		throw new Error(`挂载点 ${payload.mountId} 为内置武器，不可更换`);
	}

	// 清空武器
	if (!payload.weaponSpecId) {
		ship.weapons.delete(payload.mountId);
		result.success = true;

		// 计算 OP
		result.opUsed = calculateShipOpUsed(ship);
		result.opMax = hullSpec.opCapacity;

		return result;
	}

	// 获取武器规格
	const weaponSpec = getWeaponSpec(payload.weaponSpecId);
	if (!weaponSpec) {
		throw new Error(`武器规格 ${payload.weaponSpecId} 不存在`);
	}

	// 验证尺寸兼容性
	if (!isWeaponSizeCompatible(mount.size, weaponSpec.size)) {
		throw new Error(
			`武器尺寸不兼容: ${weaponSpec.name} (${weaponSpec.size}) 无法安装到 ${mount.size} 挂载点`
		);
	}

	// 验证类别兼容性（远行星号机制）
	if (!isWeaponCategoryCompatible(mount.slotCategory, weaponSpec.category)) {
		throw new Error(
			`武器类别不兼容: ${weaponSpec.name} (${weaponSpec.category}) 无法安装到 ${mount.slotCategory} 挂载点`
		);
	}

	// 验证形态兼容性（远行星号机制）
	if (!isWeaponMountTypeCompatible(mount.acceptsTurret, mount.acceptsHardpoint, weaponSpec.mountType)) {
		throw new Error(
			`武器形态不兼容: ${weaponSpec.name} (${weaponSpec.mountType}) 无法安装到此挂载点`
		);
	}

	// 使用 ObjectFactory 更换武器
	const factory = new ObjectFactory();
	const success = factory.replaceWeapon(ship, payload.mountId, payload.weaponSpecId);

	if (!success) {
		throw new Error("武器更换失败");
	}

	result.success = true;

	// 计算 OP 点数
	result.opUsed = calculateShipOpUsed(ship);
	result.opMax = hullSpec.opCapacity;

	// OP 超出警告（软限制）
	if (result.opUsed > result.opMax) {
		result.opExceeded = true;
		result.warnings.push(
			`OP 点数超出: ${result.opUsed}/${result.opMax} (+${result.opUsed - result.opMax})`
		);
	}

	return result;
}

/**
 * 处理舰船变体配置命令
 *
 * 支持两种模式：
 * 1. 加载预设变体（variantId）
 * 2. 自定义配置（weaponLoadout）
 */
export function handleConfigureVariant(
	state: GameRoomState,
	client: Client,
	payload: ConfigureVariantPayload
): ConfigureResult {
	const result: ConfigureResult = {
		success: false,
		opUsed: 0,
		opMax: 0,
		opExceeded: false,
		warnings: [],
	};

	// 验证舰船规格存在
	const hullSpec = getShipHullSpec(payload.hullId);
	if (!hullSpec) {
		throw new Error(`舰船规格 ${payload.hullId} 不存在`);
	}

	// 验证权限（仅 DM）
	validateDmAuthority(state, client);

	// 构建武器配置
	let weaponLoadout: WeaponLoadoutEntry[];

	if (payload.variantId) {
		// 加载预设变体（未来实现预设变体系统）
		throw new Error("预设变体系统尚未实现");
	} else if (payload.weaponLoadout) {
		weaponLoadout = payload.weaponLoadout;
	} else {
		throw new Error("需要提供 variantId 或 weaponLoadout");
	}

	// 验证武器配置
	for (const entry of weaponLoadout) {
		const mount = hullSpec.weaponMounts.find(m => m.id === entry.mountId);
		if (!mount) {
			throw new Error(`挂载点 ${entry.mountId} 不存在`);
		}

		if (!entry.weaponSpecId) continue;  // 空槽位

		const weaponSpec = getWeaponSpec(entry.weaponSpecId);
		if (!weaponSpec) {
			throw new Error(`武器规格 ${entry.weaponSpecId} 不存在`);
		}

		// 尺寸验证
		if (!isWeaponSizeCompatible(mount.size, weaponSpec.size)) {
			throw new Error(
				`挂载点 ${entry.mountId}: 武器 ${weaponSpec.name} (${weaponSpec.size}) 不兼容 ${mount.size} 挂载点`
			);
		}

		// 类别兼容性验证（远行星号机制）
		if (!isWeaponCategoryCompatible(mount.slotCategory, weaponSpec.category)) {
			throw new Error(
				`挂载点 ${entry.mountId}: 武器 ${weaponSpec.name} (${weaponSpec.category}) 不兼容 ${mount.slotCategory}`
			);
		}

		// 形态兼容性验证（远行星号机制）
		if (!isWeaponMountTypeCompatible(mount.acceptsTurret, mount.acceptsHardpoint, weaponSpec.mountType)) {
			throw new Error(
				`挂载点 ${entry.mountId}: 武器 ${weaponSpec.name} (${weaponSpec.mountType}) 形态不兼容`
			);
		}
	}

	// 计算 OP
	result.opUsed = weaponLoadout.reduce((sum, entry) => {
		if (!entry.weaponSpecId) return sum;
		const weapon = getWeaponSpec(entry.weaponSpecId);
		return sum + (weapon?.opCost ?? 0);
	}, 0);
	result.opMax = hullSpec.opCapacity;

	// OP 超出警告
	if (result.opUsed > result.opMax) {
		result.opExceeded = true;
		result.warnings.push(
			`OP 点数超出: ${result.opUsed}/${result.opMax} (+${result.opUsed - result.opMax})`
		);
	}

	// 配置有效，返回结果
	// 实际应用需要在创建舰船时使用此配置
	result.success = true;

	return result;
}

/**
 * 计算舰船已用 OP 点数
 */
function calculateShipOpUsed(ship: ShipState): number {
	let opUsed = 0;

	ship.weapons.forEach((weapon) => {
		// 内置武器不计入 OP
		if (weapon.isBuiltIn) return;
		opUsed += weapon.opCost;
	});

	return opUsed;
}

/**
 * 验证舰船 OP 配置是否合规
 */
export function validateShipOpConfiguration(ship: ShipState): {
	isValid: boolean;
	opUsed: number;
	opMax: number;
	opExceeded: boolean;
} {
	const hullSpec = getShipHullSpec(ship.hullType);
	if (!hullSpec) {
		return {
			isValid: false,
			opUsed: 0,
			opMax: 0,
			opExceeded: true,
		};
	}

	const opUsed = calculateShipOpUsed(ship);
	const opMax = hullSpec.opCapacity;

	return {
		isValid: opUsed <= opMax,
		opUsed,
		opMax,
		opExceeded: opUsed > opMax,
	};
}

/**
 * 处理武器修复命令（DM）
 *
 * 将 DISABLED 状态的武器恢复为 READY
 */
export function handleRepairWeapon(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string; weaponId: string }
): void {
	// 验证权限
	validateDmAuthority(state, client);

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error("舰船不存在");

	const weapon = ship.weapons.get(payload.weaponId);
	if (!weapon) throw new Error("武器不存在");

	if (weapon.state !== WeaponState.DISABLED) {
		throw new Error("武器未损坏，无需修复");
	}

	// 修复武器
	weapon.state = WeaponState.READY;
	weapon.cooldownRemaining = 0;
}