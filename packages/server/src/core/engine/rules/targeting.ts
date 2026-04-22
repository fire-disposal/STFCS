/**
 * 武器目标计算规则
 *
 * 计算某舰船上所有武器的可行目标
 * 基于 @vt/data 权威 schema 设计
 */

import type { CombatToken } from "../../state/Token.js";
import { distance, angleBetween } from "../geometry/index.js";
import { type MountSpec, type WeaponRuntime, type WeaponSpec } from "@vt/data";

/**
 * 武器目标信息
 */
export interface WeaponTargetInfo {
	/** 目标舰船ID */
	targetId: string;
	/** 目标名称 */
	targetName: string;
	/** 距离 */
	distance: number;
	/** 是否在射程内 */
	inRange: boolean;
	/** 是否在射界内 */
	inArc: boolean;
	/** 命中角度（用于显示） */
	hitAngle: number;
	/** 预计命中的护甲象限 */
	targetQuadrant: number;
}

/**
 * 武器UI状态（用于前端指示灯）
 *
 * - FIRED: 已开火（本回合已使用或武器状态非READY）
 * - UNAVAILABLE: 不可用（舰船状态不允许、武器冷却/禁用等）
 * - READY: 待命（武器就绪但范围内无可行目标）
 * - READY_WITH_TARGETS: 待命且有目标（武器就绪且范围内有可行目标）
 */
export type WeaponUIStatus = "FIRED" | "UNAVAILABLE" | "READY" | "READY_WITH_TARGETS";

/**
 * 武器可行目标结果
 */
export interface WeaponTargetingResult {
	/** 武器挂载ID */
	mountId: string;
	/** 武器名称 */
	weaponName: string;
	/** 武器规格引用 */
	weaponSpec: string;
	/** 武器状态 */
	state: string;
	/** 是否就绪 */
	isReady: boolean;
	/** 射程 */
	range: number;
	/** 最小射程 */
	minRange: number;
	/** 射界（度） */
	arc: number;
	/** 挂载点朝向 */
	mountFacing: number;
	/** 伤害 */
	damage: number;
	/** 连射数 */
	burstCount: number;
	/** 每发弹丸数 */
	projectilesPerShot: number;
	/** 是否允许多目标 */
	allowsMultipleTargets: boolean;
	/** 武器是否可用（综合状态） */
	isAvailable: boolean;
	/** 不可用的原因 */
	unavailableReason?: string;
	/** UI状态（用于前端指示灯） */
	uiStatus: WeaponUIStatus;
	/** UI状态说明 */
	uiStatusLabel: string;
	/** 可行目标列表 */
	validTargets: WeaponTargetInfo[];
}

/**
 * 舰船武器目标计算结果
 */
export interface ShipTargetingResult {
	/** 舰船ID */
	shipId: string;
	/** 舰船名称 */
	shipName: string;
	/** 舰船是否可攻击 */
	canAttack: boolean;
	/** 不可攻击的原因 */
	cannotAttackReason?: string;
	/** 各武器的目标信息 */
	weapons: WeaponTargetingResult[];
}

/**
 * 计算某舰船上所有武器的可行目标
 *
 * @param attacker - 攻击者舰船
 * @param potentialTargets - 潜在目标列表（通常为同房间的其他舰船）
 * @returns 目标计算结果
 */
export function calculateShipWeaponTargets(
	attacker: CombatToken,
	potentialTargets: CombatToken[]
): ShipTargetingResult {
	const result: ShipTargetingResult = {
		shipId: attacker.$id,
		shipName: attacker.metadata.name || attacker.$id,
		canAttack: true,
		weapons: [],
	};

	if (attacker.runtime?.destroyed) {
		result.canAttack = false;
		result.cannotAttackReason = "Ship is destroyed";
		return result;
	}

	if (attacker.runtime?.overloaded) {
		result.canAttack = false;
		result.cannotAttackReason = "Ship is overloaded";
		return result;
	}

	if (attacker.runtime?.hasFired) {
		result.canAttack = false;
		result.cannotAttackReason = "Ship has already fired this turn";
		return result;
	}

	const spec = attacker.spec;
	const runtime = attacker.runtime;

	// 遍历所有挂载点
	if (!spec.mounts || spec.mounts.length === 0) {
		return result;
	}

	for (const mount of spec.mounts) {
		const weaponRuntime = runtime?.weapons?.find(
			(w) => w.mountId === mount.id
		);

		if (!weaponRuntime) {
			continue;
		}

		const weaponSpec = mount.weapon?.spec;
		if (!weaponSpec) {
			continue;
		}

		const weaponResult = calculateWeaponTargets(
			attacker,
			mount,
			weaponRuntime,
			weaponSpec,
			potentialTargets
		);

		result.weapons.push(weaponResult);
	}

	return result;
}

/**
 * 计算单个武器的可行目标
 */
function calculateWeaponTargets(
	attacker: CombatToken,
	mount: MountSpec,
	weaponRuntime: WeaponRuntime,
	weaponSpec: WeaponSpec,
	targets: CombatToken[]
): WeaponTargetingResult {
	const effectiveRange = weaponSpec.range * (attacker.spec.rangeModifier || 1.0);
	const minRange = weaponSpec.minRange || 0;
	const mountFacing = mount.facing || 0;

	// 射界直接使用 mount.arc（度）。360 = 全向炮塔，20 = 固定挂载
	const arc = mount.arc;

	// ===== UI 状态判断 =====
	// 优先级：已开火 > 不可用 > 待命有目标 > 待命无目标
	
	let uiStatus: WeaponUIStatus;
	let uiStatusLabel: string;
	let isAvailable = true;
	let unavailableReason: string | undefined;

	// 武器级别状态判断（与舰船 hasFired 分离）
	// 1. 检查武器是否已开火（本回合）
	if (weaponRuntime.state === "FIRED") {
		uiStatus = "FIRED";
		uiStatusLabel = "已开火";
		isAvailable = false;
		unavailableReason = "Weapon has already fired this turn";
	}
	// 2. 检查武器冷却
	else if (weaponRuntime.state === "COOLDOWN") {
		uiStatus = "UNAVAILABLE";
		uiStatusLabel = weaponRuntime.cooldownRemaining
			? `冷却中 (${weaponRuntime.cooldownRemaining}回合)`
			: "冷却中";
		isAvailable = false;
		unavailableReason = `Weapon is cooling down`;
	}
	// 3. 检查武器禁用
	else if (weaponRuntime.state === "DISABLED") {
		uiStatus = "UNAVAILABLE";
		uiStatusLabel = "不可用";
		isAvailable = false;
		unavailableReason = "Weapon is disabled";
	}
	// 4. 武器就绪，先标记为待命，后续根据目标情况更新
	else {
		uiStatus = "READY";
		uiStatusLabel = "待命";
	}

	const result: WeaponTargetingResult = {
		mountId: mount.id,
		weaponName: mount.displayName || mount.id,
		weaponSpec: weaponSpec.damageType,
		state: weaponRuntime.state,
		isReady: weaponRuntime.state === "READY",
		range: effectiveRange,
		minRange,
		arc,
		mountFacing,
		damage: weaponSpec.damage,
		burstCount: weaponSpec.burstCount || 1,
		projectilesPerShot: weaponSpec.projectilesPerShot || 1,
		allowsMultipleTargets: weaponSpec.allowsMultipleTargets || false,
		isAvailable,
		uiStatus,
		uiStatusLabel,
		validTargets: [],
		...(unavailableReason ? { unavailableReason } : {}),
	};

	// 如果武器不可用，不需要计算目标
	if (!isAvailable) {
		return result;
	}

	// 计算每个潜在目标
	for (const target of targets) {
		// 跳过自己
		if (target.$id === attacker.$id) continue;

		// 跳过已摧毁目标
		if (target.runtime?.destroyed) continue;

		const dist = distance(attacker.runtime?.position ?? { x: 0, y: 0 }, target.runtime?.position ?? { x: 0, y: 0 });

		// 检查射程
		const inRange = dist >= minRange && dist <= effectiveRange;

		// 检查射界（arc < 360 时需要检查）
		let inArc = true;
		if (arc < 360) {
			// 计算目标相对攻击者的角度
			const targetAngle = angleBetween(
				attacker.runtime?.position ?? { x: 0, y: 0 },
				target.runtime?.position ?? { x: 0, y: 0 }
			);
			const heading = attacker.runtime?.heading || 0;
			const relativeAngle = ((targetAngle - heading - mountFacing + 540) % 360) - 180;
			inArc = Math.abs(relativeAngle) <= arc / 2;
		}

		// 计算命中角度和护甲象限
		const hitAngle = angleBetween(
			attacker.runtime?.position ?? { x: 0, y: 0 },
			target.runtime?.position ?? { x: 0, y: 0 }
		);
		const relativeAngle = ((hitAngle - (target.runtime?.heading || 0) + 360) % 360);
		const targetQuadrant = Math.floor(relativeAngle / 60) % 6;

		const targetInfo: WeaponTargetInfo = {
			targetId: target.$id,
			targetName: target.metadata.name || target.$id,
			distance: Math.round(dist * 100) / 100,
			inRange,
			inArc,
			hitAngle: Math.round(hitAngle * 100) / 100,
			targetQuadrant,
		};

		result.validTargets.push(targetInfo);
	}

	// 检查是否有真正可行的目标（在射程内且在射界内）
	const hasValidTargets = result.validTargets.some(t => t.inRange && t.inArc);
	
	if (!hasValidTargets) {
		result.isAvailable = false;
		Object.assign(result, { unavailableReason: "No valid targets in range/arc" });
	} else {
		// 有可行目标，更新 UI 状态为待命且有目标
		result.uiStatus = "READY_WITH_TARGETS";
		result.uiStatusLabel = "待命 (有目标)";
	}

	return result;
}

/**
 * 验证攻击分配方案
 *
 * @param attacker - 攻击者
 * @param weaponAllocations - 武器攻击分配
 * @returns 验证结果
 */
export interface WeaponAllocation {
	mountId: string;
	targets: Array<{
		targetId: string;
		shotCount: number; // 分配到这个目标的弹丸/射击数
	}>;
}

export interface AttackValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export function validateAttackAllocations(
	attacker: CombatToken,
	allocations: WeaponAllocation[]
): AttackValidationResult {
	const result: AttackValidationResult = {
		valid: true,
		errors: [],
		warnings: [],
	};

	if (attacker.runtime?.destroyed) {
		result.valid = false;
		result.errors.push("Attacker is destroyed");
		return result;
	}

	if (attacker.runtime?.overloaded) {
		result.valid = false;
		result.errors.push("Attacker is overloaded");
		return result;
	}

	const spec = attacker.spec;

	// 验证每个武器分配
	for (const allocation of allocations) {
		const mount = spec.mounts?.find((m) => m.id === allocation.mountId);
		if (!mount) {
			result.valid = false;
			result.errors.push(`Invalid mount ID: ${allocation.mountId}`);
			continue;
		}

		const weaponRuntime = attacker.runtime?.weapons?.find(
			(w) => w.mountId === allocation.mountId
		);
		if (!weaponRuntime) {
			result.valid = false;
			result.errors.push(`No weapon on mount: ${allocation.mountId}`);
			continue;
		}

		if (weaponRuntime.state === "FIRED") {
			result.valid = false;
			result.errors.push(`Weapon has already fired this turn: ${allocation.mountId}`);
			continue;
		}

		if (weaponRuntime.state !== "READY") {
			result.valid = false;
			result.errors.push(`Weapon not ready: ${allocation.mountId} (${weaponRuntime.state})`);
			continue;
		}

		const weaponSpec = mount.weapon?.spec;
		if (!weaponSpec) {
			result.valid = false;
			result.errors.push(`No weapon spec for: ${allocation.mountId}`);
			continue;
		}

		// 计算总射击数
		const totalShots = allocation.targets.reduce((sum, t) => sum + t.shotCount, 0);
		const burstCount = weaponSpec.burstCount || 1;

		if (totalShots > burstCount) {
			result.valid = false;
			result.errors.push(
				`Total shots (${totalShots}) exceed burst count (${burstCount}) for ${allocation.mountId}`
			);
			continue;
		}

		if (totalShots === 0) {
			result.warnings.push(`No shots allocated for ${allocation.mountId}`);
			continue;
		}

		// 检查多目标限制
		if (!weaponSpec.allowsMultipleTargets && allocation.targets.length > 1) {
			result.valid = false;
			result.errors.push(
				`Weapon ${allocation.mountId} does not allow multiple targets`
			);
			continue;
		}

		// 检查目标数量限制（单目标武器只能选1个）
		if (!weaponSpec.allowsMultipleTargets && allocation.targets.length !== 1) {
			result.valid = false;
			result.errors.push(
				`Single-target weapon ${allocation.mountId} must select exactly 1 target`
			);
			continue;
		}
	}

	return result;
}
