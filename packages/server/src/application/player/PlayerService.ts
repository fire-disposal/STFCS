import type {
	DockedShip,
	InventoryItem,
	PlayerHangar,
	PlayerInfo,
	Result,
	ShipAssetDefinition,
} from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import { GLOBAL_ROOM_ID } from "@vt/shared/constants";
import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";
import { BaseService } from "../common/BaseService";
import { ShipAssetLibrary } from "./ShipAssetLibrary";

export type JoinPlayerResult = Result<PlayerInfo>;
export type LeavePlayerResult = Result<void>;

export interface IPlayerService {
	join(player: PlayerInfo, roomId?: string): Promise<JoinPlayerResult>;
	leave(playerId: string, roomId: string): Promise<LeavePlayerResult>;
	getPlayer(playerId: string): PlayerInfo | undefined;
	listPlayers(roomId: string): PlayerInfo[];
	toggleDMMode(playerId: string, enable: boolean): Promise<boolean>;
	getShipAssets(): ShipAssetDefinition[];
	getPlayerHangar(playerId: string): PlayerHangar | null;
	setActiveDockedShip(playerId: string, dockedShipId: string): PlayerHangar | null;
}

export class PlayerService extends BaseService implements IPlayerService {
	private _players: Map<string, PlayerInfo>;
	private _shipAssetLibrary: ShipAssetLibrary;
	private _hangars: Map<string, PlayerHangar>;

	constructor() {
		super();
		this._players = new Map();
		this._shipAssetLibrary = new ShipAssetLibrary();
		this._hangars = new Map();
	}

	async join(player: PlayerInfo, roomId?: string): Promise<JoinPlayerResult> {
		const existingPlayer = this._players.get(player.id);
		if (existingPlayer) {
			return { success: true, data: existingPlayer };
		}

		// 初始化可选属性为默认值
		const completePlayer: PlayerInfo = {
			...player,
			isActive: player.isActive ?? true,
			isDMMode: player.isDMMode ?? false,
		};

		this._players.set(player.id, completePlayer);
		this._ensurePlayerHangar(player.id);

		if (this._roomManager) {
			const targetRoom = roomId ?? GLOBAL_ROOM_ID;
			this._roomManager.joinRoom(targetRoom, completePlayer);
		}

		if (this._wsServer) {
			const targetRoom = this._roomManager?.getPlayerRoom(player.id);
			if (targetRoom) {
				this._roomManager?.broadcastToRoom(targetRoom.id, {
					type: WS_MESSAGE_TYPES.PLAYER_JOINED,
					payload: completePlayer,
				});
			} else {
				this._wsServer.broadcast({
					type: WS_MESSAGE_TYPES.PLAYER_JOINED,
					payload: completePlayer,
				});
			}
		}

		return { success: true, data: completePlayer };
	}

	async leave(playerId: string, roomId: string): Promise<LeavePlayerResult> {
		const player = this._players.get(playerId);
		if (!player) {
			return { success: false, error: "Player not found" };
		}

		if (this._roomManager) {
			this._roomManager.leaveRoom(roomId, playerId);
		}

		this._players.delete(playerId);
		this._hangars.delete(playerId);

		if (this._wsServer) {
			this._roomManager?.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.PLAYER_LEFT,
				payload: { playerId, reason: "Player left" },
			});
		}

		return { success: true, data: undefined };
	}

	getPlayer(playerId: string): PlayerInfo | undefined {
		return this._players.get(playerId);
	}

	getShipAssets(): ShipAssetDefinition[] {
		return this._shipAssetLibrary.listAssets();
	}

	getPlayerHangar(playerId: string): PlayerHangar | null {
		const player = this._players.get(playerId);
		if (!player) return null;
		return this._ensurePlayerHangar(playerId);
	}

	setActiveDockedShip(playerId: string, dockedShipId: string): PlayerHangar | null {
		const hangar = this.getPlayerHangar(playerId);
		if (!hangar) return null;
		const exists = hangar.dockedShips.some((ship) => ship.id === dockedShipId);
		if (!exists) {
			return hangar;
		}
		hangar.activeShipId = dockedShipId;
		hangar.updatedAt = Date.now();
		return hangar;
	}

	listPlayers(roomId: string): PlayerInfo[] {
		if (!this._roomManager) {
			return Array.from(this._players.values());
		}

		const room = this._roomManager.getRoom(roomId);
		if (!room) {
			return [];
		}

		return Array.from(room.players.values());
	}

	async toggleDMMode(playerId: string, enable: boolean): Promise<boolean> {
		const player = this._players.get(playerId);
		if (!player) {
			return false;
		}

		player.isDMMode = enable;
		this._players.set(playerId, player);

		if (this._wsServer) {
			const room = this._roomManager?.getPlayerRoom(playerId);
			if (room) {
				this._roomManager?.broadcastToRoom(room.id, {
					type: WS_MESSAGE_TYPES.DM_TOGGLE,
					payload: {
						playerId,
						playerName: player.name,
						enable,
						timestamp: Date.now(),
					},
				});
				this._broadcastDMStatus(room.id);
			}
		}

		return true;
	}

	private _broadcastDMStatus(roomId: string): void {
		if (!this._wsServer || !this._roomManager) {
			return;
		}

		const roomPlayers = this.listPlayers(roomId);
		const dmStatus = roomPlayers.map((player) => ({
			id: player.id,
			name: player.name,
			isDMMode: player.isDMMode,
		}));

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.DM_STATUS_UPDATE,
			payload: {
				players: dmStatus,
			},
		});
	}

	private _ensurePlayerHangar(playerId: string): PlayerHangar {
		const existing = this._hangars.get(playerId);
		if (existing) {
			return existing;
		}

		const assets = this._shipAssetLibrary.listAssets();
		const dockedShips: DockedShip[] = assets.map((asset, index) => ({
			id: `${playerId}_dock_${asset.id}`,
			assetId: asset.id,
			displayName: asset.defaultCustomization.nickname ?? `${asset.name}-${index + 1}`,
			customization: { ...asset.defaultCustomization },
			cargoSlots: asset.hullClass === "frigate" ? 2 : 4,
			assignedTokenId: null,
		}));

		const inventory: InventoryItem[] = [
			{
				id: `${playerId}_module_burst_laser`,
				name: "Burst Laser",
				category: "module",
				quantity: 2,
				metadata: { type: "weapon" },
			},
			{
				id: `${playerId}_resource_supplies`,
				name: "Supplies",
				category: "resource",
				quantity: 120,
				metadata: { unit: "crate" },
			},
		];

		const created: PlayerHangar = {
			playerId,
			dockedShips,
			inventory,
			activeShipId: dockedShips[0]?.id ?? null,
			updatedAt: Date.now(),
		};
		this._hangars.set(playerId, created);
		return created;
	}
}

export default PlayerService;
