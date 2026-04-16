/**
 * 存档序列化
 */

import type { GameSave, ShipSave, WeaponSave } from "./types.js";
import { GameRoomState } from "./GameSchema.js";
import { ShipState, WeaponSlot } from "./ShipStateSchema.js";

export const GAME_SAVE_VERSION = "1.0.0";

export function serializeGameSave(
	state: GameRoomState,
	roomId: string,
	saveName: string
): GameSave {
	const ships: ShipSave[] = [];
	state.ships.forEach((ship: ShipState) => {
		const weapons: WeaponSave[] = [];
		ship.weapons.forEach((w: WeaponSlot) =>
			weapons.push({
				mountId: w.mountId,
				instanceId: w.instanceId,
				state: w.state,
				cooldownRemaining: w.cooldownRemaining,
				currentAmmo: w.currentAmmo,
			})
		);
		ships.push({
			id: ship.id,
			hullId: ship.hullType,
			name: ship.name,
			faction: ship.faction,
			ownerId: ship.ownerId,
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			hullCurrent: ship.hull.current,
			hullMax: ship.hull.max,
			fluxHard: ship.flux.hard,
			fluxSoft: ship.flux.soft,
			fluxMax: ship.flux.max,
			shieldActive: ship.shield.active,
			shieldCurrent: ship.shield.current,
			shieldMax: ship.shield.max,
			armorGrid: [...ship.armor.quadrants],
			weapons,
			isOverloaded: ship.isOverloaded,
			hasMoved: ship.hasMoved,
			hasFired: ship.hasFired,
			movePhase: ship.movePhase,
			phaseAForwardUsed: ship.phaseAForwardUsed,
			phaseAStrafeUsed: ship.phaseAStrafeUsed,
			phaseTurnUsed: ship.phaseTurnUsed,
			phaseCForwardUsed: ship.phaseCForwardUsed,
			phaseCStrafeUsed: ship.phaseCStrafeUsed,
		});
	});

	return {
		id: `save_${Date.now()}_${roomId}`,
		name: saveName,
	 createdAt: Date.now(),
		updatedAt: Date.now(),
		turnCount: state.turnCount,
		currentPhase: state.currentPhase,
		activeFaction: state.activeFaction,
		ships,
		mapWidth: state.mapWidth,
		mapHeight: state.mapHeight,
	};
}

export function deserializeShipSave(data: ShipSave): ShipState {
	const ship = new ShipState();
	ship.id = data.id;
	ship.hullType = data.hullId;
	ship.name = data.name;
	ship.faction = data.faction;
	ship.ownerId = data.ownerId;
	ship.transform.x = data.x;
	ship.transform.y = data.y;
	ship.transform.heading = data.heading;
	ship.hull.current = data.hullCurrent;
	ship.hull.max = data.hullMax;
	ship.flux.hard = data.fluxHard;
	ship.flux.soft = data.fluxSoft;
	ship.flux.max = data.fluxMax;
	ship.shield.active = data.shieldActive;
	ship.shield.current = data.shieldCurrent;
	ship.shield.max = data.shieldMax;
	data.armorGrid.forEach((v, i) => ship.armor.setQuadrant(i, v));
	ship.isOverloaded = data.isOverloaded;
	ship.hasMoved = data.hasMoved;
	ship.hasFired = data.hasFired;
	ship.movePhase = data.movePhase ?? "PHASE_A";
	ship.phaseAForwardUsed = data.phaseAForwardUsed ?? 0;
	ship.phaseAStrafeUsed = data.phaseAStrafeUsed ?? 0;
	ship.phaseTurnUsed = data.phaseTurnUsed ?? 0;
	ship.phaseCForwardUsed = data.phaseCForwardUsed ?? 0;
	ship.phaseCStrafeUsed = data.phaseCStrafeUsed ?? 0;
	return ship;
}