import type { GameSave, Faction, PlayerRoleValue, ShipBuild, WeaponBuild } from "@vt/data";

export type { ShipBuild, WeaponBuild };

export type Timestamp = number;

export interface BaseEntity {
	id: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface QueryOptions {
	limit?: number;
	offset?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
}

export interface UserStats {
	gamesPlayed: number;
	gamesWon: number;
	gamesLost: number;
	totalDamageDealt: number;
	totalDamageTaken: number;
	totalShipsDestroyed: number;
	totalShipsLost: number;
}

export interface UserPreferences {
	defaultFaction: Faction;
	showDamageNumbers: boolean;
	showMovementRange: boolean;
	showWeaponRange: boolean;
	uiScale: number;
	language: string;
}

export interface UserProfile extends BaseEntity {
	name: string;
	nickname?: string;
	avatar?: string;
	avatarAssetId?: string;
	username: string;
	role: PlayerRoleValue;
	faction: Faction;
	ready: boolean;
	connected: boolean;
	pingMs: number;
	jitterMs?: number;
	connectionQuality?: string;
	stats: UserStats;
	preferences: UserPreferences;
	shipBuildIds: string[];
}

export interface RoomArchiveMetadata {
	roomId: string;
	roomName: string;
	mapWidth: number;
	mapHeight: number;
	maxPlayers: number;
	playerCount: number;
	totalTurns: number;
	winnerFaction?: Faction;
	gameDuration: number;
}

export interface RoomArchive extends BaseEntity {
	name: string;
	description?: string;
	saveJson: GameSave;
	metadata: RoomArchiveMetadata;
	playerIds: string[];
	isAutoSave: boolean;
	tags: string[];
}