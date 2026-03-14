import type { PlayerInfo, Result } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";
import { BaseService } from "../common/BaseService";

export interface SelectionRecord {
	tokenId: string;
	playerId: string;
	playerName: string;
	isDMMode: boolean;
	timestamp: number;
	roomId: string;
}

/** Token 拖拽状态记录 */
export interface TokenDragRecord {
	tokenId: string;
	playerId: string;
	playerName: string;
	isDMMode: boolean;
	position: { x: number; y: number };
	heading: number;
	startTime: number;
	lastUpdateTime: number;
	roomId: string;
}

export interface SelectionConflict {
	canSelect: boolean;
	reason?: string;
	currentSelection?: SelectionRecord | null;
	forceOverrideRequired?: boolean;
}

export interface SelectObjectRequest {
	tokenId: string;
	playerId: string;
	forceOverride?: boolean;
	roomId: string;
}

export interface TokenDragStartRequest {
	tokenId: string;
	playerId: string;
	position: { x: number; y: number };
	heading: number;
	roomId: string;
}

export interface TokenDragUpdateRequest {
	tokenId: string;
	playerId: string;
	position: { x: number; y: number };
	heading: number;
	roomId: string;
}

export interface TokenDragEndRequest {
	tokenId: string;
	playerId: string;
	finalPosition: { x: number; y: number };
	finalHeading: number;
	committed: boolean;
	roomId: string;
}

export type SelectObjectResult = Result<SelectionRecord, string | SelectionConflict>;
export type DeselectObjectResult = Result<void>;
export type TokenDragStartResult = Result<TokenDragRecord, string>;
export type TokenDragUpdateResult = Result<TokenDragRecord, string>;
export type TokenDragEndResult = Result<{ committed: boolean }, string>;

export interface SelectionUpdate {
	selections: Array<{
		tokenId: string;
		selectedBy: {
			id: string;
			name: string;
			isDMMode: boolean;
		} | null;
		timestamp: number;
	}>;
}

export interface ISelectionService {
	selectObject(request: SelectObjectRequest): Promise<SelectObjectResult>;
	deselectObject(tokenId: string, playerId: string, roomId: string): Promise<DeselectObjectResult>;
	getSelection(tokenId: string, roomId: string): SelectionRecord | null;
	getPlayerSelections(playerId: string, roomId: string): SelectionRecord[];
	clearPlayerSelections(playerId: string, roomId: string): boolean;
	getAllSelections(roomId: string): SelectionRecord[];
	broadcastSelectionUpdate(roomId: string): void;
	canSelect(tokenId: string, playerId: string, isDMMode: boolean, roomId: string): SelectionConflict;
	// Token 拖拽相关方法
	startTokenDrag(request: TokenDragStartRequest): Promise<TokenDragStartResult>;
	updateTokenDrag(request: TokenDragUpdateRequest): Promise<TokenDragUpdateResult>;
	endTokenDrag(request: TokenDragEndRequest): Promise<TokenDragEndResult>;
	getTokenDrag(tokenId: string, roomId: string): TokenDragRecord | null;
	clearTokenDrag(tokenId: string, roomId: string): boolean;
}

export class SelectionService extends BaseService implements ISelectionService {
	private _selections: Map<string, Map<string, SelectionRecord>>; // roomId -> Map<tokenId, selection>
	private _playerSelections: Map<string, Map<string, Set<string>>>; // roomId -> Map<playerId, Set<tokenId>>
	private _tokenDrags: Map<string, Map<string, TokenDragRecord>>; // roomId -> Map<tokenId, dragRecord>

	constructor() {
		super();
		this._selections = new Map();
		this._playerSelections = new Map();
		this._tokenDrags = new Map();
	}

	private _getSelectionsForRoom(roomId: string): Map<string, SelectionRecord> {
		let roomSelections = this._selections.get(roomId);
		if (!roomSelections) {
			roomSelections = new Map();
			this._selections.set(roomId, roomSelections);
		}
		return roomSelections;
	}

	private _getPlayerSelectionsForRoom(roomId: string): Map<string, Set<string>> {
		let roomPlayerSelections = this._playerSelections.get(roomId);
		if (!roomPlayerSelections) {
			roomPlayerSelections = new Map();
			this._playerSelections.set(roomId, roomPlayerSelections);
		}
		return roomPlayerSelections;
	}

	private _addPlayerSelection(roomId: string, playerId: string, tokenId: string): void {
		const playerSelections = this._getPlayerSelectionsForRoom(roomId);
		let tokenSet = playerSelections.get(playerId);
		if (!tokenSet) {
			tokenSet = new Set();
			playerSelections.set(playerId, tokenSet);
		}
		tokenSet.add(tokenId);
	}

	private _removePlayerSelection(roomId: string, playerId: string, tokenId: string): void {
		const playerSelections = this._getPlayerSelectionsForRoom(roomId);
		const tokenSet = playerSelections.get(playerId);
		if (tokenSet) {
			tokenSet.delete(tokenId);
			if (tokenSet.size === 0) {
				playerSelections.delete(playerId);
			}
		}
	}

	async selectObject(request: SelectObjectRequest): Promise<SelectObjectResult> {
		const { tokenId, playerId, forceOverride = false, roomId } = request;

		let playerInfo: PlayerInfo | null = null;
		if (this._roomManager) {
			const room = this._roomManager.getRoom(roomId);
			if (room) {
				playerInfo = room.players.get(playerId) ?? null;
			}
		}

		if (!playerInfo) {
			return { success: false, error: "Player not found in room" };
		}

		const currentSelection = this.getSelection(tokenId, roomId);
		const conflict = this.canSelect(tokenId, playerId, playerInfo.isDMMode, roomId);

		if (!conflict.canSelect) {
			if (forceOverride && playerInfo.isDMMode && currentSelection) {
				this._removeSelection(tokenId, roomId);
			} else {
				return {
					success: false,
					error: conflict.reason ?? "Cannot select object",
				} as const;
			}
		}

		const selection: SelectionRecord = {
			tokenId,
			playerId,
			playerName: playerInfo.name,
			isDMMode: playerInfo.isDMMode,
			timestamp: Date.now(),
			roomId,
		};

		const roomSelections = this._getSelectionsForRoom(roomId);
		roomSelections.set(tokenId, selection);

		this._addPlayerSelection(roomId, playerId, tokenId);

		if (this._wsServer) {
			this._wsServer.broadcast({
				type: WS_MESSAGE_TYPES.OBJECT_SELECTED,
				payload: {
					playerId,
					playerName: playerInfo.name,
					tokenId,
					timestamp: Date.now(),
					forceOverride: forceOverride && playerInfo.isDMMode,
				},
			});
		}

		this.broadcastSelectionUpdate(roomId);

		return { success: true, data: selection };
	}

	async deselectObject(tokenId: string, playerId: string, roomId: string): Promise<DeselectObjectResult> {
		const selection = this.getSelection(tokenId, roomId);

		if (!selection) {
			return { success: false, error: "Object is not selected" };
		}

		if (selection.playerId !== playerId) {
			let canForceDeselect = false;
			if (this._roomManager) {
				const room = this._roomManager.getRoom(roomId);
				if (room) {
					const player = room.players.get(playerId);
					if (player?.isDMMode && !selection.isDMMode) {
						canForceDeselect = true;
					}
				}
			}

			if (!canForceDeselect) {
				return { success: false, error: "Cannot deselect object selected by another player" };
			}
		}

		this._removeSelection(tokenId, roomId);

		if (this._wsServer) {
			this._wsServer.broadcast({
				type: WS_MESSAGE_TYPES.OBJECT_DESELECTED,
				payload: {
					playerId,
					tokenId,
					timestamp: Date.now(),
					reason: selection.playerId === playerId ? "manual" : "override",
				},
			});
		}

		this.broadcastSelectionUpdate(roomId);

		return { success: true, data: undefined };
	}

	private _removeSelection(tokenId: string, roomId: string): void {
		const roomSelections = this._getSelectionsForRoom(roomId);
		const selection = roomSelections.get(tokenId);

		if (selection) {
			this._removePlayerSelection(roomId, selection.playerId, tokenId);
			roomSelections.delete(tokenId);
		}
	}

	getSelection(tokenId: string, roomId: string): SelectionRecord | null {
		const roomSelections = this._getSelectionsForRoom(roomId);
		return roomSelections.get(tokenId) ?? null;
	}

	getPlayerSelections(playerId: string, roomId: string): SelectionRecord[] {
		const roomSelections = this._getSelectionsForRoom(roomId);
		const playerSelections = this._getPlayerSelectionsForRoom(roomId);
		const tokenSet = playerSelections.get(playerId);

		if (!tokenSet) {
			return [];
		}

		const result: SelectionRecord[] = [];
		for (const tokenId of tokenSet) {
			const selection = roomSelections.get(tokenId);
			if (selection && selection.playerId === playerId) {
				result.push(selection);
			}
		}

		return result;
	}

	clearPlayerSelections(playerId: string, roomId: string): boolean {
		const playerSelections = this.getPlayerSelections(playerId, roomId);

		if (playerSelections.length === 0) {
			return false;
		}

		for (const selection of playerSelections) {
			this._removeSelection(selection.tokenId, roomId);
		}

		if (this._wsServer) {
			for (const selection of playerSelections) {
				this._wsServer.broadcast({
					type: WS_MESSAGE_TYPES.OBJECT_DESELECTED,
					payload: {
						playerId,
						tokenId: selection.tokenId,
						timestamp: Date.now(),
						reason: "released",
					},
				});
			}
		}

		this.broadcastSelectionUpdate(roomId);

		return true;
	}

	getAllSelections(roomId: string): SelectionRecord[] {
		const roomSelections = this._getSelectionsForRoom(roomId);
		return Array.from(roomSelections.values());
	}

	broadcastSelectionUpdate(roomId: string): void {
		if (!this._wsServer) {
			return;
		}

		const selections = this.getAllSelections(roomId);
		const selectionUpdate: SelectionUpdate = {
			selections: selections.map((selection) => ({
				tokenId: selection.tokenId,
				selectedBy: {
					id: selection.playerId,
					name: selection.playerName,
					isDMMode: selection.isDMMode,
				},
				timestamp: selection.timestamp,
			})),
		};

		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.SELECTION_UPDATE,
			payload: selectionUpdate,
		});
	}

	canSelect(
		tokenId: string,
		playerId: string,
		isDMMode: boolean,
		roomId: string
	): SelectionConflict {
		const currentSelection = this.getSelection(tokenId, roomId);

		if (!currentSelection) {
			return { canSelect: true };
		}

		if (currentSelection.playerId === playerId) {
			return { canSelect: true, currentSelection };
		}

		if (isDMMode) {
			if (!currentSelection.isDMMode) {
				return {
					canSelect: true,
					currentSelection,
					forceOverrideRequired: true,
					reason: "DM can override non-DM player",
				};
			} else {
				return {
					canSelect: false,
					currentSelection,
					reason: "Object already selected by another DM (first-come, first-served)",
				};
			}
		} else {
			if (currentSelection.isDMMode) {
				return {
					canSelect: false,
					currentSelection,
					reason: "Object already selected by DM player",
				};
			} else {
				return {
					canSelect: false,
					currentSelection,
					reason: "Object already selected by another player",
				};
			}
		}
	}

	clearRoomSelections(roomId: string): void {
		this._selections.delete(roomId);
		this._playerSelections.delete(roomId);
	}

	handlePlayerLeave(playerId: string, roomId: string): void {
		this.clearPlayerSelections(playerId, roomId);
	}

	// ===== Token 拖拽相关方法 =====

	private _getDragsForRoom(roomId: string): Map<string, TokenDragRecord> {
		let roomDrags = this._tokenDrags.get(roomId);
		if (!roomDrags) {
			roomDrags = new Map();
			this._tokenDrags.set(roomId, roomDrags);
		}
		return roomDrags;
	}

	async startTokenDrag(request: TokenDragStartRequest): Promise<TokenDragStartResult> {
		const { tokenId, playerId, position, heading, roomId } = request;

		let playerInfo: PlayerInfo | null = null;
		if (this._roomManager) {
			const room = this._roomManager.getRoom(roomId);
			if (room) {
				playerInfo = room.players.get(playerId) ?? null;
			}
		}

		if (!playerInfo) {
			return { success: false, error: "Player not found in room" };
		}

		const now = Date.now();
		const dragRecord: TokenDragRecord = {
			tokenId,
			playerId,
			playerName: playerInfo.name,
			isDMMode: playerInfo.isDMMode,
			position,
			heading,
			startTime: now,
			lastUpdateTime: now,
			roomId,
		};

		const roomDrags = this._getDragsForRoom(roomId);
		roomDrags.set(tokenId, dragRecord);

		// 广播拖拽开始
		if (this._wsServer) {
			this._wsServer.broadcast({
				type: WS_MESSAGE_TYPES.TOKEN_DRAG_START,
				payload: {
					tokenId,
					playerId,
					playerName: playerInfo.name,
					position,
					heading,
					timestamp: now,
				},
			});
		}

		return { success: true, data: dragRecord };
	}

	async updateTokenDrag(request: TokenDragUpdateRequest): Promise<TokenDragUpdateResult> {
		const { tokenId, playerId, position, heading, roomId } = request;

		const roomDrags = this._getDragsForRoom(roomId);
		const dragRecord = roomDrags.get(tokenId);

		if (!dragRecord || dragRecord.playerId !== playerId) {
			return { success: false, error: "No active drag for this token/player" };
		}

		// 更新拖拽记录
		dragRecord.position = position;
		dragRecord.heading = heading;
		dragRecord.lastUpdateTime = Date.now();

		// 广播拖拽更新
		if (this._wsServer) {
			this._wsServer.broadcast({
				type: WS_MESSAGE_TYPES.TOKEN_DRAGGING,
				payload: {
					tokenId,
					playerId: dragRecord.playerId,
					playerName: dragRecord.playerName,
					position,
					heading,
					timestamp: dragRecord.lastUpdateTime,
					isDragging: true,
				},
			});
		}

		return { success: true, data: dragRecord };
	}

	async endTokenDrag(request: TokenDragEndRequest): Promise<TokenDragEndResult> {
		const { tokenId, playerId, finalPosition, finalHeading, committed, roomId } = request;

		const roomDrags = this._getDragsForRoom(roomId);
		const dragRecord = roomDrags.get(tokenId);

		if (!dragRecord || dragRecord.playerId !== playerId) {
			return { success: false, error: "No active drag for this token/player" };
		}

		// 清除拖拽记录
		roomDrags.delete(tokenId);

		// 广播拖拽结束
		if (this._wsServer) {
			this._wsServer.broadcast({
				type: WS_MESSAGE_TYPES.TOKEN_DRAG_END,
				payload: {
					tokenId,
					playerId,
					finalPosition,
					finalHeading,
					timestamp: Date.now(),
					committed,
				},
			});
		}

		return { success: true, data: { committed } };
	}

	getTokenDrag(tokenId: string, roomId: string): TokenDragRecord | null {
		const roomDrags = this._getDragsForRoom(roomId);
		return roomDrags.get(tokenId) ?? null;
	}

	clearTokenDrag(tokenId: string, roomId: string): boolean {
		const roomDrags = this._getDragsForRoom(roomId);
		return roomDrags.delete(tokenId);
	}

	clearRoomDrags(roomId: string): void {
		this._tokenDrags.delete(roomId);
	}
}

export default SelectionService;
