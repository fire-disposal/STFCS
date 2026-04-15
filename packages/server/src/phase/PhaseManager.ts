/**
 * 阶段管理
 */

import { GAME_CONFIG } from "@vt/data";
import { Faction, GamePhase, WeaponState } from "@vt/types";
import type { FactionValue, GamePhaseValue } from "@vt/types";
import type { GameRoomState, PlayerState } from "../schema/GameSchema.js";
import { toPhaseChangeDto } from "../dto/index.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";

const PHASES: GamePhaseValue[] = [
	GamePhase.DEPLOYMENT,
	GamePhase.PLAYER_TURN,
	GamePhase.DM_TURN,
	GamePhase.END_PHASE,
];

export function advancePhase(
	state: GameRoomState,
	broadcast: (type: string, data: unknown) => void
): void {
	const idx = PHASES.indexOf(state.currentPhase);
	// 设计意图：DEPLOYMENT 阶段仅在游戏首轮使用，后续回合循环为
	// PLAYER_TURN → DM_TURN → END_PHASE → PLAYER_TURN，故跳回索引 1
	const next = idx + 1 >= PHASES.length ? 1 : idx + 1;
	state.currentPhase = PHASES[next];
	state.players.forEach((p: PlayerState) => (p.isReady = false));

	if (state.currentPhase === GamePhase.END_PHASE) {
		handleEndPhase(state);
		return advancePhase(state, broadcast);
	}

	state.activeFaction =
		state.currentPhase === GamePhase.PLAYER_TURN
			? Faction.PLAYER
			: (Faction.DM as FactionValue);
	broadcast("phase_change", toPhaseChangeDto(state.currentPhase, state.turnCount));
}

export function handleEndPhase(state: GameRoomState): void {
	state.ships.forEach((ship: ShipState) => {
		if (ship.isDestroyed) return;
		ship.hasMoved = false;
		ship.hasFired = false;
		ship.movePhaseAX = 0;
		ship.movePhaseAStrafe = 0;
		ship.turnAngle = 0;
		ship.movePhaseCX = 0;
		ship.movePhaseCStrafe = 0;
		ship.movePhase = "PHASE_A";
		ship.phaseAForwardUsed = 0;
		ship.phaseAStrafeUsed = 0;
		ship.phaseTurnUsed = 0;
		ship.phaseCForwardUsed = 0;
		ship.phaseCStrafeUsed = 0;

		ship.weapons.forEach((w: WeaponSlot) => {
			w.hasFiredThisTurn = false;
			if (w.state === WeaponState.OUT_OF_AMMO && w.maxAmmo > 0) {
				w.currentAmmo = w.maxAmmo;
				w.state = WeaponState.READY;
			}
		});

		if (ship.shield.active) ship.flux.addSoft(ship.flux.dissipation * 0.2);
		ship.flux.dissipate(1.0);

		if (ship.flux.isOverloaded && !ship.isOverloaded) {
			ship.isOverloaded = true;
			ship.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
			ship.shield.deactivate();
		}
	});
	state.turnCount++;
}
