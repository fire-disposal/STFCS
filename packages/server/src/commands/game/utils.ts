/**
 * 命令处理器共享工具函数
 */

import type { Client } from "@colyseus/core";
import { PlayerRole } from "@vt/data";
import { angleBetween, angleDifference, distance, getMountWorldPosition } from "@vt/rules";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";

/** 
 * 游戏逻辑错误类
 * 用于携带错误分发代码，方便前端 UI 提示
 */
export class GameLogicError extends Error {
	constructor(public message: string, public code?: string) {
		super(message);
		this.name = "GameLogicError";
	}
}

/** 常用错误代码常量 */
export const ERROR_CODES = {
	UNAUTHORIZED: "AUTH_001",
	WRONG_PHASE: "PHASE_001",
	NOT_OWNER: "AUTH_002",
	ALREADY_READY: "PHASE_002",
	INSUFFICIENT_FLUX: "SHIP_001",
	OUT_OF_AMMO: "WEAPON_001",
	WEAPON_NOT_READY: "WEAPON_002",
	OUT_OF_RANGE: "WEAPON_003",
	TARGET_DESTROYED: "TARGET_001",
	IS_OVERLOADED: "SHIP_002",
};

/** 验证操作权限 */
export function validateAuthority(state: GameRoomState, client: Client, ship: ShipState): void {
	const player = state.players.get(client.sessionId);
	if (!player) throw new GameLogicError("玩家未注册", ERROR_CODES.UNAUTHORIZED);
	if (player.role === PlayerRole.DM) return;
	if (state.currentPhase !== "PLAYER_TURN") throw new GameLogicError("当前不是玩家行动回合", ERROR_CODES.WRONG_PHASE);
	if (ship.ownerId !== client.sessionId) throw new GameLogicError("没有权限操作此舰船", ERROR_CODES.NOT_OWNER);
	if (player.isReady) throw new GameLogicError("已结束本回合", ERROR_CODES.ALREADY_READY);
}

/** 验证 DM 权限 */
export function validateDmAuthority(state: GameRoomState, client: Client): void {
	const player = state.players.get(client.sessionId);
	if (!player || player.role !== PlayerRole.DM) {
		throw new GameLogicError("仅 DM 可执行此操作", ERROR_CODES.UNAUTHORIZED);
	}
}

/** 标准化航向角度 */
export function normalizeHeading(value: number): number {
	return ((value % 360) + 360) % 360;
}

/** 获取武器世界坐标位置（使用 @vt/rules 的权威函数） */
export function getWeaponWorldPosition(ship: ShipState, weapon: WeaponSlot): { x: number; y: number } {
	return getMountWorldPosition(
		ship.transform.x,
		ship.transform.y,
		ship.transform.heading,
		weapon.mountOffsetX ?? 0,
		weapon.mountOffsetY ?? 0
	);
}

/** 验证目标在武器射界内 */
export function assertTargetInWeaponArc(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): { distanceToMuzzle: number; angleToTarget: number } {
	const muzzle = getWeaponWorldPosition(attacker, weapon);
	const angleToTarget = angleBetween(muzzle.x, muzzle.y, target.transform.x, target.transform.y);
	const weaponFacing = normalizeHeading(attacker.transform.heading + weapon.mountFacing);
	// 使用 getEffectiveArc() 获取有效射界（TURRET 用 arc，HARDPOINT 用 hardpointArc）
	const effectiveArc = weapon.getEffectiveArc();
	const arcHalf = Math.max(0, effectiveArc) / 2;
	const diff = angleDifference(weaponFacing, angleToTarget);
	if (diff > arcHalf) {
		throw new Error(`目标不在武器射界内: 偏差 ${diff.toFixed(1)}° > ${arcHalf.toFixed(1)}°`);
	}

	const dist = distance(muzzle.x, muzzle.y, target.transform.x, target.transform.y);
	return { distanceToMuzzle: dist, angleToTarget };
}

/** 应用平移变换 */
export function applyTranslation(
	x: number,
	y: number,
	heading: number,
	forward: number,
	strafe: number
): { x: number; y: number } {
	const rad = (heading * Math.PI) / 180;
	const forwardX = Math.sin(rad);
	const forwardY = -Math.cos(rad);
	const rightX = Math.cos(rad);
	const rightY = Math.sin(rad);
	return {
		x: x + forwardX * forward + rightX * strafe,
		y: y + forwardY * forward + rightY * strafe,
	};
}

/** 移动阶段顺序 */
export const MOVE_PHASE_ORDER: Record<"PHASE_A" | "PHASE_B" | "PHASE_C", number> = {
	PHASE_A: 0,
	PHASE_B: 1,
	PHASE_C: 2,
};

/** 验证阶段顺序 */
export function assertPhaseOrder(current: "PHASE_A" | "PHASE_B" | "PHASE_C", next: "PHASE_A" | "PHASE_B" | "PHASE_C"): void {
	const cur = MOVE_PHASE_ORDER[current];
	const nxt = MOVE_PHASE_ORDER[next];
	if (nxt < cur) throw new Error("移动阶段顺序错误");
}

/** 获取有效移动阶段 */
export function getMovePhase(
	payloadPhase?: "PHASE_A" | "PHASE_B" | "PHASE_C",
	shipPhase?: "PHASE_A" | "PHASE_B" | "PHASE_C"
): "PHASE_A" | "PHASE_B" | "PHASE_C" {
	return payloadPhase ?? shipPhase ?? "PHASE_A";
}