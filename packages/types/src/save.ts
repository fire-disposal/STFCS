/**
 * 存档接口
 */

import type {
	ChatMessageTypeValue,
	FactionValue,
	GamePhaseValue,
	PlayerRoleValue,
} from "./enums.js";
import type { Transform } from "./interfaces.js";

export interface PlayerSave {
	shortId: number;
	name: string;
	nickname: string;
	avatar: string;
	role: PlayerRoleValue;
	isReady: boolean;
}

export interface WeaponSave {
	mountId: string;
	weaponSpecId: string;
	currentAmmo: number;
	cooldownRemaining: number;
	hasFiredThisTurn: boolean;
}

export interface ShipSave {
	id: string;
	ownerId: string;
	hullType: string;
	faction: FactionValue;
	name: string;
	transform: Transform;
	width: number;
	length: number;
	hull: { current: number; max: number };
	armor: { maxPerQuadrant: number; quadrants: number[] };
	flux: { hard: number; soft: number; max: number; dissipation: number };
	shield: { type: string; active: boolean; orientation: number; arc: number; radius: number };
	isOverloaded: boolean;
	isDestroyed: boolean;
	hasMoved: boolean;
	hasFired: boolean;
	movePhaseAX: number;
	movePhaseAStrafe: number;
	movePhaseBX: number;
	movePhaseBStrafe: number;
	turnAngle: number;
	weapons: WeaponSave[];
}

export interface ChatMessageSave {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: ChatMessageTypeValue;
}

export interface GameSave {
	saveId: string;
	saveName: string;
	createdAt: number;
	updatedAt: number;
	version: string;
	roomId: string;
	roomName: string;
	maxPlayers: number;
	isPrivate: boolean;
	currentPhase: GamePhaseValue;
	turnCount: number;
	activeFaction: FactionValue;
	players: PlayerSave[];
	ships: ShipSave[];
	chatHistory: ChatMessageSave[];
}

export interface SaveSummary {
	saveId: string;
	saveName: string;
	roomName: string;
	playerCount: number;
	shipCount: number;
	turnCount: number;
	currentPhase: GamePhaseValue;
	createdAt: number;
	updatedAt: number;
	fileSize: number;
}

export interface SaveStore {
	save(data: GameSave): Promise<void>;
	load(id: string): Promise<GameSave>;
	delete(id: string): Promise<void>;
	list(): Promise<SaveSummary[]>;
	exists(id: string): Promise<boolean>;
	getSummary(id: string): Promise<SaveSummary>;
}
