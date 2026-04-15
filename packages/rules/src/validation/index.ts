/**
 * 游戏规则验证器
 *
 * 统一处理游戏规则的验证逻辑，确保前后端使用相同的验证标准
 */

import { GAME_CONFIG } from "@vt/data";
import { angleBetween, angleDifference, distance, validateThreePhaseMove } from "../math/index.js";
import type { MovementPlan, MovementValidation } from "../math/index.js";

// 本地定义游戏阶段枚举（从 @vt/types 迁移）
const GamePhase = {
	DEPLOYMENT: "DEPLOYMENT",
	PLAYER_TURN: "PLAYER_TURN",
	DM_TURN: "DM_TURN",
	END_PHASE: "END_PHASE",
	BATTLE: "BATTLE",
	END: "END",
} as const;

type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];

// 本地定义玩家角色枚举
const PlayerRole = {
	DM: "DM",
	PLAYER: "PLAYER",
} as const;

type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];

export interface WeaponFireValidation {
	valid: boolean;
	error?: string;
	distance?: number;
	inRange?: boolean;
	inArc?: boolean;
}

export interface ShieldToggleValidation {
	valid: boolean;
	error?: string;
}

export interface FluxVentValidation {
	valid: boolean;
	error?: string;
	canVent?: boolean;
}

export interface PhaseTransitionValidation {
	valid: boolean;
	error?: string;
	newPhase?: GamePhaseValue;
}

export function validateWeaponFire(
	attackerX: number,
	attackerY: number,
	attackerHeading: number,
	weapon: {
		range: number;
		arcMin: number;
		arcMax: number;
		mountFacing: number;
		state: string;
		cooldownRemaining: number;
		currentAmmo: number;
		maxAmmo: number;
		fluxCost: number;
		hasFiredThisTurn: boolean;
	},
	targetX: number,
	targetY: number,
	attackerFlux: {
		total: number;
		max: number;
	}
): WeaponFireValidation {
	if (weapon.state !== "READY") {
		if (weapon.state === "COOLDOWN") {
			return {
				valid: false,
				error: `武器冷却中：剩余 ${weapon.cooldownRemaining.toFixed(1)} 秒`,
			};
		}
		if (weapon.state === "OUT_OF_AMMO") {
			return { valid: false, error: "弹药耗尽" };
		}
		return { valid: false, error: "武器不可用" };
	}

	if (weapon.hasFiredThisTurn) {
		return { valid: false, error: "该武器本回合已射击" };
	}

	const dist = distance(attackerX, attackerY, targetX, targetY);

	if (dist > weapon.range) {
		return {
			valid: false,
			error: `目标超出射程：距离 ${dist.toFixed(0)} > 射程 ${weapon.range}`,
			distance: dist,
			inRange: false,
		};
	}

	if (weapon.fluxCost > 0) {
		if (attackerFlux.total + weapon.fluxCost > attackerFlux.max) {
			return {
				valid: false,
				error: `辐能不足：需要 ${weapon.fluxCost}，当前容量 ${attackerFlux.max - attackerFlux.total}`,
			};
		}
	}

	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		return { valid: false, error: "弹药耗尽" };
	}

	const weaponWorldAngle = attackerHeading + weapon.mountFacing;
	const normalizedWeaponAngle = ((weaponWorldAngle % 360) + 360) % 360;

	const angleToTarget = angleBetween(attackerX, attackerY, targetX, targetY);
	const normalizedTargetAngle = ((angleToTarget % 360) + 360) % 360;

	const arcCenter = (weapon.arcMin + weapon.arcMax) / 2;
	const arcHalfWidth = (weapon.arcMax - weapon.arcMin) / 2;

	let relativeArcDiff = normalizedTargetAngle - arcCenter;
	if (relativeArcDiff > 180) relativeArcDiff -= 360;
	if (relativeArcDiff < -180) relativeArcDiff += 360;

	if (Math.abs(relativeArcDiff) > arcHalfWidth) {
		return {
			valid: false,
			error: `目标不在射界内：角度偏差 ${relativeArcDiff.toFixed(0)}°`,
			distance: dist,
			inRange: true,
			inArc: false,
		};
	}

	return {
		valid: true,
		distance: dist,
		inRange: true,
		inArc: true,
	};
}

export function validateShieldToggle(
	shipFlux: {
		total: number;
		max: number;
	},
	isOverloaded: boolean,
	shieldActive: boolean,
	wantToActivate: boolean
): ShieldToggleValidation {
	if (isOverloaded && wantToActivate) {
		return { valid: false, error: "过载状态下无法开启护盾" };
	}

	if (wantToActivate && !shieldActive) {
		const fluxCost = GAME_CONFIG.SHIELD_UP_FLUX_COST;
		if (shipFlux.total + fluxCost > shipFlux.max) {
			return { valid: false, error: "辐能容量不足以开启护盾" };
		}
	}

	return { valid: true };
}

export function validateFluxVent(
	fluxState: {
		hard: number;
		soft: number;
		total: number;
	},
	isOverloaded: boolean,
	overloadTimeRemaining: number
): FluxVentValidation {
	if (isOverloaded) {
		return {
			valid: false,
			error: `过载状态，需等待 ${overloadTimeRemaining.toFixed(1)} 秒`,
			canVent: false,
		};
	}

	if (fluxState.total <= 0) {
		return { valid: false, error: "无辐能需要排散", canVent: false };
	}

	return { valid: true, canVent: true };
}

export function validateMovement(
	startX: number,
	startY: number,
	startHeading: number,
	plan: MovementPlan,
	shipStats: {
		maxSpeed: number;
		maxTurnRate: number;
	},
	isOverloaded: boolean,
	hasMoved: boolean,
	isIncremental: boolean
): MovementValidation {
	if (isOverloaded) {
		return { valid: false, error: "过载状态下无法移动" };
	}

	if (!isIncremental && hasMoved) {
		return { valid: false, error: "本回合已移动" };
	}

	return validateThreePhaseMove(
		startX,
		startY,
		startHeading,
		plan,
		shipStats.maxSpeed,
		shipStats.maxTurnRate
	);
}

export function validateIncrementalMovement(
	startX: number,
	startY: number,
	startHeading: number,
	targetX: number,
	targetY: number,
	targetHeading: number,
	phase: string,
	shipStats: {
		maxSpeed: number;
		maxTurnRate: number;
	},
	isOverloaded: boolean
): MovementValidation {
	if (isOverloaded) {
		return { valid: false, error: "过载状态下无法移动" };
	}

	const moveDistance = distance(startX, startY, targetX, targetY);
	const headingDiff = angleDifference(startHeading, targetHeading);

	if (phase === "PHASE_A" || phase === "PHASE_C") {
		if (moveDistance > shipStats.maxSpeed) {
			return {
				valid: false,
				error: `增量移动距离 ${moveDistance.toFixed(2)} 超过单步限制 ${shipStats.maxSpeed}`,
			};
		}
	} else if (phase === "PHASE_B") {
		if (headingDiff > shipStats.maxTurnRate) {
			return {
				valid: false,
				error: `增量转向角度 ${headingDiff.toFixed(2)} 超过限制 ${shipStats.maxTurnRate}`,
			};
		}
	}

	return {
		valid: true,
		finalPosition: { x: targetX, y: targetY },
		finalHeading: targetHeading,
	};
}

export function validatePhaseTransition(
	currentPhase: GamePhaseValue,
	allPlayersReady: boolean,
	isDM: boolean
): PhaseTransitionValidation {
	if (currentPhase === GamePhase.DEPLOYMENT) {
		if (!isDM) {
			return { valid: false, error: "只有 DM 可以结束部署阶段" };
		}
		return { valid: true, newPhase: GamePhase.PLAYER_TURN };
	}

	if (currentPhase === GamePhase.PLAYER_TURN) {
		if (!allPlayersReady) {
			return { valid: false, error: "所有玩家必须准备完毕" };
		}
		return { valid: true, newPhase: GamePhase.DM_TURN };
	}

	if (currentPhase === GamePhase.DM_TURN) {
		if (!isDM) {
			return { valid: false, error: "只有 DM 可以结束 DM 回合" };
		}
		return { valid: true, newPhase: GamePhase.END_PHASE };
	}

	if (currentPhase === GamePhase.END_PHASE) {
		return { valid: true, newPhase: GamePhase.PLAYER_TURN };
	}

	return { valid: false, error: `未知阶段: ${currentPhase}` };
}

export function validatePlayerAction(
	currentPhase: GamePhaseValue,
	playerRole: PlayerRoleValue,
	playerIsReady: boolean
): { valid: boolean; error?: string } {
	if (playerRole === "DM") {
		return { valid: true };
	}

	if (currentPhase !== GamePhase.PLAYER_TURN) {
		return { valid: false, error: "当前不是玩家行动回合" };
	}

	if (playerIsReady) {
		return { valid: false, error: "已结束本回合，无法继续操作" };
	}

	return { valid: true };
}

export function validateShipOwnership(
	shipOwnerId: string,
	playerSessionId: string,
	playerRole: PlayerRoleValue
): { valid: boolean; error?: string } {
	if (playerRole === "DM") {
		return { valid: true };
	}

	if (shipOwnerId !== playerSessionId) {
		return { valid: false, error: "没有权限操作这艘舰船" };
	}

	return { valid: true };
}

export function validateMapBoundaries(
	x: number,
	y: number,
	mapWidth: number,
	mapHeight: number
): { valid: boolean; error?: string } {
	const halfWidth = mapWidth / 2;
	const halfHeight = mapHeight / 2;

	if (x < -halfWidth || x > halfWidth) {
		return { valid: false, error: `X 坐标 ${x} 超出地图边界` };
	}

	if (y < -halfHeight || y > halfHeight) {
		return { valid: false, error: `Y 坐标 ${y} 超出地图边界` };
	}

	return { valid: true };
}