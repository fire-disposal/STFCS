/**
 * 移动命令处理器
 */

import type { Client } from "@colyseus/core";
import { validateThreePhaseMove } from "@vt/rules";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState } from "../../schema/ShipStateSchema.js";
import type { MoveTokenPayload } from "../types.js";
import {
	validateAuthority,
	normalizeHeading,
	applyTranslation,
	assertPhaseOrder,
	getMovePhase,
} from "./utils.js";

/** 更新移动资源预算 */
function updateMovementBudget(
	ship: ShipState,
	phase: "PHASE_A" | "PHASE_B" | "PHASE_C",
	forward: number,
	strafe: number,
	turn: number
): void {
	const maxForward = ship.maxSpeed * 2;
	const maxStrafe = ship.maxSpeed;
	const maxTurn = ship.maxTurnRate;

	if (phase === "PHASE_A") {
		if (Math.abs(forward) + ship.phaseAForwardUsed > maxForward) {
			throw new Error("阶段A前进燃料不足");
		}
		if (Math.abs(strafe) + ship.phaseAStrafeUsed > maxStrafe) {
			throw new Error("阶段A横移燃料不足");
		}
		ship.phaseAForwardUsed += Math.abs(forward);
		ship.phaseAStrafeUsed += Math.abs(strafe);
	}

	if (phase === "PHASE_B") {
		if (Math.abs(turn) + ship.phaseTurnUsed > maxTurn) {
			throw new Error("阶段B转向燃料不足");
		}
		ship.phaseTurnUsed += Math.abs(turn);
	}

	if (phase === "PHASE_C") {
		if (Math.abs(forward) + ship.phaseCForwardUsed > maxForward) {
			throw new Error("阶段C前进燃料不足");
		}
		if (Math.abs(strafe) + ship.phaseCStrafeUsed > maxStrafe) {
			throw new Error("阶段C横移燃料不足");
		}
		ship.phaseCForwardUsed += Math.abs(forward);
		ship.phaseCStrafeUsed += Math.abs(strafe);
	}
}

/** 应用增量移动 */
function applyIncrementalMovement(ship: ShipState, payload: MoveTokenPayload): void {
	const plan = payload.movementPlan;
	if (!plan) throw new Error("缺少移动计划");
	if (payload.phase && payload.phase !== ship.movePhase) throw new Error("移动阶段未同步");

	const phase = getMovePhase(payload.phase, ship.movePhase);
	assertPhaseOrder(ship.movePhase, phase);

	let forward = 0;
	let strafe = 0;
	let turn = 0;

	switch (phase) {
		case "PHASE_A":
			forward = plan.phaseAForward;
			strafe = plan.phaseAStrafe;
			break;
		case "PHASE_B":
			turn = plan.turnAngle;
			break;
		case "PHASE_C":
			forward = plan.phaseCForward;
			strafe = plan.phaseCStrafe;
			break;
	}

	if (forward === 0 && strafe === 0 && turn === 0) throw new Error("移动量不能为空");

	updateMovementBudget(ship, phase, forward, strafe, turn);
	if (phase !== ship.movePhase) ship.movePhase = phase;

	let nextX = ship.transform.x;
	let nextY = ship.transform.y;
	let nextHeading = ship.transform.heading;

	if (phase === "PHASE_B") {
		nextHeading = normalizeHeading(nextHeading + turn);
	} else {
		const next = applyTranslation(nextX, nextY, nextHeading, forward, strafe);
		nextX = next.x;
		nextY = next.y;
	}

	ship.transform.setPosition(nextX, nextY);
	ship.transform.setHeading(nextHeading);
}

/** 处理移动命令 */
export function handleMove(state: GameRoomState, client: Client, payload: MoveTokenPayload): void {
	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);
	validateAuthority(state, client, ship);
	if (ship.isOverloaded) throw new Error("过载状态无法移动");
	if (ship.hasMoved) throw new Error("本回合已移动");
	if (!payload.movementPlan) throw new Error("缺少移动计划");

	if (payload.isIncremental) {
		applyIncrementalMovement(ship, payload);
		return;
	}

	const v = validateThreePhaseMove(
		ship.transform.x,
		ship.transform.y,
		ship.transform.heading,
		payload.movementPlan,
		ship.maxSpeed,
		ship.maxTurnRate
	);
	if (!v.valid || !v.finalPosition || v.finalHeading === undefined)
		throw new Error(v.error || "无效移动");

	ship.phaseAForwardUsed = payload.movementPlan.phaseAForward;
	ship.phaseAStrafeUsed = payload.movementPlan.phaseAStrafe;
	ship.phaseTurnUsed = payload.movementPlan.turnAngle;
	ship.phaseCForwardUsed = payload.movementPlan.phaseCForward;
	ship.phaseCStrafeUsed = payload.movementPlan.phaseCStrafe;
	ship.transform.setPosition(v.finalPosition.x, v.finalPosition.y);
	ship.transform.setHeading(v.finalHeading);
	ship.hasMoved = true;
}

/** 处理推进移动阶段命令 */
export function handleAdvanceMovePhase(state: GameRoomState, client: Client, ship: ShipState): void {
	validateAuthority(state, client, ship);
	if (ship.hasMoved) throw new Error("本回合已移动");
	switch (ship.movePhase) {
		case "PHASE_A":
			ship.movePhase = "PHASE_B";
			break;
		case "PHASE_B":
			ship.movePhase = "PHASE_C";
			break;
		case "PHASE_C":
			ship.hasMoved = true;
			break;
	}
}