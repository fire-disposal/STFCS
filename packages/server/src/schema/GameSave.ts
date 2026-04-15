/**
 * 存档序列化
 */

import type {
	ChatMessageSave,
	FactionValue,
	GameSave,
	PlayerSave,
	ShieldTypeValue,
	ShipSave,
	WeaponSave,
} from "@vt/types";
import { ChatMessage, GameRoomState } from "./GameSchema.js";
import { ShipState, WeaponSlot } from "./ShipStateSchema.js";

export const GAME_SAVE_VERSION = "1.0.0";

export function serializeGameSave(
	state: GameRoomState,
	roomId: string,
	roomName: string,
	maxPlayers: number,
	isPrivate: boolean,
	saveName: string
): GameSave {
	const players: PlayerSave[] = [];
	state.players.forEach((p) =>
		players.push({
			shortId: p.shortId,
			name: p.name,
			nickname: p.nickname,
			avatar: p.avatar,
			role: p.role,
			isReady: p.isReady,
		})
	);

	const ships: ShipSave[] = [];
	state.ships.forEach((ship: ShipState) => {
		const weapons: WeaponSave[] = [];
		ship.weapons.forEach((w: WeaponSlot) =>
			weapons.push({
				mountId: w.mountId,
				weaponSpecId: w.weaponSpecId,
				currentAmmo: w.currentAmmo,
				cooldownRemaining: w.cooldownRemaining,
				hasFiredThisTurn: w.hasFiredThisTurn,
			})
		);
		ships.push({
			id: ship.id,
			ownerId: ship.ownerId,
			hullType: ship.hullType,
			faction: ship.faction,
			name: ship.name,
			transform: { x: ship.transform.x, y: ship.transform.y, heading: ship.transform.heading },
			width: ship.width,
			length: ship.length,
			hull: { current: ship.hull.current, max: ship.hull.max },
			armor: { maxPerQuadrant: ship.armor.maxPerQuadrant, quadrants: [...ship.armor.quadrants] },
			flux: {
				hard: ship.flux.hard,
				soft: ship.flux.soft,
				max: ship.flux.max,
				dissipation: ship.flux.dissipation,
			},
			shield: {
				type: ship.shield.type,
				active: ship.shield.active,
				orientation: ship.shield.orientation,
				arc: ship.shield.arc,
				radius: ship.shield.radius,
			},
			isOverloaded: ship.isOverloaded,
			isDestroyed: ship.isDestroyed,
			hasMoved: ship.hasMoved,
			hasFired: ship.hasFired,
			movePhaseAX: ship.movePhaseAX,
			movePhaseAStrafe: ship.movePhaseAStrafe,
			movePhaseCX: ship.movePhaseCX,
			movePhaseCStrafe: ship.movePhaseCStrafe,
			turnAngle: ship.turnAngle,
			weapons,
		});
	});

	const chatHistory: ChatMessageSave[] = state.chatMessages.slice(-50).map((m: ChatMessage) => ({
		id: m.id,
		senderId: m.senderId,
		senderName: m.senderName,
		content: m.content,
		timestamp: m.timestamp,
		type: m.type,
	}));

	return {
		saveId: `save_${Date.now()}_${roomId}`,
		saveName,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		version: GAME_SAVE_VERSION,
		roomId,
		roomName,
		maxPlayers,
		isPrivate,
		currentPhase: state.currentPhase,
		turnCount: state.turnCount,
		activeFaction: state.activeFaction,
		players,
		ships,
		chatHistory,
	};
}

export function deserializeShipSave(data: ShipSave): ShipState {
	const ship = new ShipState();
	ship.id = data.id;
	ship.ownerId = data.ownerId;
	ship.hullType = data.hullType;
	ship.faction = data.faction as FactionValue;
	ship.name = data.name;
	ship.transform.x = data.transform.x;
	ship.transform.y = data.transform.y;
	ship.transform.heading = data.transform.heading;
	ship.width = data.width;
	ship.length = data.length;
	ship.hull.current = data.hull.current;
	ship.hull.max = data.hull.max;
	ship.armor.maxPerQuadrant = data.armor.maxPerQuadrant;
	data.armor.quadrants.forEach((v, i) => ship.armor.setQuadrant(i, v));
	ship.flux.hard = data.flux.hard;
	ship.flux.soft = data.flux.soft;
	ship.flux.max = data.flux.max;
	ship.flux.dissipation = data.flux.dissipation;
	ship.shield.type = data.shield.type as ShieldTypeValue;
	ship.shield.active = data.shield.active;
	ship.shield.orientation = data.shield.orientation;
	ship.shield.arc = data.shield.arc;
	ship.shield.radius = data.shield.radius;
	ship.isOverloaded = data.isOverloaded;
	ship.isDestroyed = data.isDestroyed;
	ship.hasMoved = data.hasMoved;
	ship.hasFired = data.hasFired;
	ship.movePhaseAX = data.movePhaseAX;
	ship.movePhaseAStrafe = data.movePhaseAStrafe;
	ship.movePhaseCX = data.movePhaseCX;
	ship.movePhaseCStrafe = data.movePhaseCStrafe;
	ship.turnAngle = data.turnAngle;
	return ship;
}
