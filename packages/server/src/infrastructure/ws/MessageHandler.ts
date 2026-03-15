import type {
	ChatMessagePayload,
	CombatEventMessage,
	DrawingAddMessage,
	DrawingClearMessage,
	DrawingElement,
	ErrorResponse,
	FluxStateMessage,
	ObjectDeselectedMessage,
	ObjectSelectedMessage,
	PlayerJoinedMessage,
	RequestHandlers,
	RequestMessage,
	RequestOperation,
	RequestPayload,
	ShieldUpdateMessage,
	SuccessResponse,
	TokenDragEndMessage,
	TokenDragStartMessage,
	TokenDraggingMessage,
	WSMessage,
} from "@vt/shared/ws";
import { WS_MESSAGE_TYPES, isRequestMessage, isShipMovedMessage } from "@vt/shared/ws";
import type { PlayerService } from "../../application/player/PlayerService";
import type { SelectionService } from "../../application/selection/SelectionService";
import type { ShipService } from "../../application/ship/ShipService";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

interface WSSender {
	sendTo: (id: string, msg: WSMessage) => void;
}

export interface MessageHandlerOptions {
	roomManager: RoomManager;
	playerService: PlayerService;
	shipService: ShipService;
	selectionService: SelectionService;
	wsServer?: WSSender;
}

export class MessageHandler {
	private _roomManager: RoomManager;
	private _playerService: PlayerService;
	private _shipService: ShipService;
	private _selectionService: SelectionService;
	private _roomDrawings: Map<string, DrawingElement[]>;
	private _requestHandlers: RequestHandlers;
	private _wsServer?: WSSender;

	constructor(options: MessageHandlerOptions) {
		this._roomManager = options.roomManager;
		this._playerService = options.playerService;
		this._shipService = options.shipService;
		this._selectionService = options.selectionService;
		this._wsServer = options.wsServer;
		this._roomDrawings = new Map();
		this._requestHandlers = this._createRequestHandlers();
	}

	private _createRequestHandlers(): RequestHandlers {
		return {
			"player.join": this._handlePlayerJoin.bind(this),
			"player.leave": this._handlePlayerLeave.bind(this),
			"player.list": this._handlePlayerList.bind(this),
			"room.list": this._handleRoomList.bind(this),
			"room.create": this._handleRoomCreate.bind(this),
			"camera.update": this._handleCameraUpdate.bind(this),
			"ship.move": this._handleShipMove.bind(this),
			"ship.toggleShield": this._handleShipToggleShield.bind(this),
			"ship.vent": this._handleShipVent.bind(this),
			"ship.getStatus": this._handleShipGetStatus.bind(this),
			"dm.toggle": this._handleDMToggle.bind(this),
		};
	}

	async handleMessage(clientId: string, message: WSMessage): Promise<void> {
		try {
			if (isRequestMessage(message)) {
				await this._handleRequestMessage(clientId, message);
				return;
			}

			switch (message.type) {
				case WS_MESSAGE_TYPES.PLAYER_JOINED:
					await this._handlePlayerJoined(clientId, message);
					break;
				case WS_MESSAGE_TYPES.SHIP_MOVED:
					await this._handleShipMoved(clientId, message);
					break;
				case WS_MESSAGE_TYPES.SHIELD_UPDATE:
					await this._handleShieldUpdate(clientId, message);
					break;
				case WS_MESSAGE_TYPES.FLUX_STATE:
					await this._handleFluxState(clientId, message);
					break;
				case WS_MESSAGE_TYPES.COMBAT_EVENT:
					await this._handleCombatEvent(clientId, message);
					break;
				case WS_MESSAGE_TYPES.DRAWING_ADD:
					await this._handleDrawingAdd(clientId, message);
					break;
				case WS_MESSAGE_TYPES.DRAWING_CLEAR:
					await this._handleDrawingClear(clientId, message);
					break;
				case WS_MESSAGE_TYPES.CHAT_MESSAGE:
					await this._handleChatMessage(clientId, message);
					break;
				case WS_MESSAGE_TYPES.OBJECT_SELECTED:
					await this._handleObjectSelected(clientId, message);
					break;
				case WS_MESSAGE_TYPES.OBJECT_DESELECTED:
					await this._handleObjectDeselected(clientId, message);
					break;
				case WS_MESSAGE_TYPES.TOKEN_DRAG_START:
					await this._handleTokenDragStart(clientId, message);
					break;
				case WS_MESSAGE_TYPES.TOKEN_DRAGGING:
					await this._handleTokenDragging(clientId, message);
					break;
				case WS_MESSAGE_TYPES.TOKEN_DRAG_END:
					await this._handleTokenDragEnd(clientId, message);
					break;
				case WS_MESSAGE_TYPES.PING:
					await this._handlePing(clientId, message);
					break;
				default:
					console.warn(`Unhandled WS message type: ${message.type}`);
			}
		} catch (error) {
			console.error(`Error handling message from ${clientId}:`, error);
			this._sendError(
				clientId,
				"MESSAGE_ERROR",
				error instanceof Error ? error.message : "Unknown error"
			);
		}
	}

	private async _handleRequestMessage(clientId: string, request: RequestMessage): Promise<void> {
		const { requestId, operation } = request.payload;
		const data = (request.payload as RequestPayload).data;

		const handler = this._requestHandlers[operation];
		if (!handler) {
			this._sendResponse(clientId, requestId, {
				success: false,
				operation,
				error: {
					code: "INVALID_OPERATION",
					message: `No handler for operation: ${operation}`,
				},
				timestamp: Date.now(),
			});
			return;
		}

		try {
			const result = await (handler as (clientId: string, data: unknown) => Promise<unknown>)(
				clientId,
				data
			);
			this._sendResponse(clientId, requestId, {
				success: true,
				operation,
				data: result,
				timestamp: Date.now(),
			});
		} catch (error) {
			this._sendResponse(clientId, requestId, {
				success: false,
				operation,
				error: {
					code: "INTERNAL_ERROR",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				timestamp: Date.now(),
			});
		}
	}

	private async _handlePlayerJoin(
		_clientId: string,
		data: Extract<RequestPayload, { operation: "player.join" }>["data"]
	) {
		const playerInfo = {
			id: data.id,
			name: data.name,
			joinedAt: Date.now(),
			isActive: true,
			isDMMode: false,
		};

		const roomId = "roomId" in data ? (data.roomId as string | undefined) : undefined;
		const result = await this._playerService.join(playerInfo, roomId);
		if (!result.success) throw new Error(result.error ?? "Failed to join");
		if (!result.data) throw new Error("No player data returned");

		return result.data;
	}

	private async _handlePlayerLeave(
		clientId: string,
		data: Extract<RequestPayload, { operation: "player.leave" }>["data"]
	) {
		const result = await this._playerService.leave(data.playerId, data.roomId);
		if (!result.success) throw new Error(result.error ?? "Failed to leave");

		this._roomManager.removePlayerCamera(data.roomId, data.playerId);

		if (this._wsServer) {
			this._wsServer.sendTo(data.roomId, {
				type: WS_MESSAGE_TYPES.PLAYER_LEFT,
				payload: {
					playerId: data.playerId,
					reason: "Player left",
				},
			});
		}

		return undefined;
	}

	private async _handlePlayerList(
		_clientId: string,
		data: Extract<RequestPayload, { operation: "player.list" }>["data"]
	) {
		return this._playerService.listPlayers(data.roomId);
	}

	private async _handleShipMove(
		clientId: string,
		data: Extract<RequestPayload, { operation: "ship.move" }>["data"]
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		const result = await this._shipService.moveShip(data.shipId, {
			shipId: data.shipId,
			phase: data.phase,
			type: data.type,
			distance: data.distance,
			angle: data.angle,
		});

		if (!result.success) throw new Error(result.error ?? "Movement failed");

		const status = this._shipService.getShipStatus(data.shipId);

		this._roomManager.broadcastToRoom(
			playerRoom.id,
			{
				type: WS_MESSAGE_TYPES.SHIP_MOVED,
				payload: {
					shipId: data.shipId,
					phase: data.phase,
					type: data.type,
					distance: data.distance,
					angle: data.angle,
					newX: status?.position.x ?? 0,
					newY: status?.position.y ?? 0,
					newHeading: status?.heading ?? 0,
					timestamp: Date.now(),
				},
			},
			clientId
		);

		return status ?? null;
	}

	private async _handleShipToggleShield(
		clientId: string,
		data: Extract<RequestPayload, { operation: "ship.toggleShield" }>["data"]
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		const success = await this._shipService.toggleShield(data.shipId);
		if (!success) throw new Error("Failed to toggle shield");

		const status = this._shipService.getShipStatus(data.shipId);

		this._roomManager.broadcastToRoom(
			playerRoom.id,
			{
				type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
				payload: {
					shipId: data.shipId,
					active: status?.shield.active ?? false,
					type: status?.shield.type ?? "front",
					coverageAngle: status?.shield.coverageAngle ?? 0,
				},
			},
			clientId
		);

		return status ?? null;
	}

	private async _handleShipVent(
		clientId: string,
		data: Extract<RequestPayload, { operation: "ship.vent" }>["data"]
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		const success = await this._shipService.ventShip(data.shipId);
		if (!success) throw new Error("Failed to vent");

		const status = this._shipService.getShipStatus(data.shipId);

		this._roomManager.broadcastToRoom(
			playerRoom.id,
			{
				type: WS_MESSAGE_TYPES.FLUX_STATE,
				payload: {
					shipId: data.shipId,
					fluxState: status?.fluxState ?? "normal",
					currentFlux: status?.flux.current ?? 0,
					softFlux: status?.flux.softFlux ?? 0,
					hardFlux: status?.flux.hardFlux ?? 0,
				},
			},
			clientId
		);

		return status ?? null;
	}

	private async _handleShipGetStatus(
		_clientId: string,
		data: Extract<RequestPayload, { operation: "ship.getStatus" }>["data"]
	) {
		return this._shipService.getShipStatus(data.shipId) ?? null;
	}

	private async _handleDMToggle(
		clientId: string,
		data: Extract<RequestPayload, { operation: "dm.toggle" }>["data"]
	) {
		const player = this._playerService.getPlayer(clientId);
		if (!player) throw new Error("Player not found");

		const success = await this._playerService.toggleDMMode(clientId, data.enable);
		if (!success) throw new Error("Failed to toggle DM mode");

		const updatedPlayer = this._playerService.getPlayer(clientId);
		if (!updatedPlayer) throw new Error("Player not found after DM toggle");
		return updatedPlayer;
	}

	private async _handleObjectSelected(
		clientId: string,
		message: ObjectSelectedMessage
	): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const result = await this._selectionService.selectObject({
			tokenId: message.payload.tokenId,
			playerId: clientId,
			forceOverride: message.payload.forceOverride ?? false,
			roomId: playerRoom.id,
		});

		if (!result.success) {
			this._sendError(
				clientId,
				"SELECTION_ERROR",
				typeof result.error === "string" ? result.error : "Failed to select object"
			);
		}
	}

	private async _handleObjectDeselected(
		clientId: string,
		message: ObjectDeselectedMessage
	): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const result = await this._selectionService.deselectObject(
			message.payload.tokenId,
			clientId,
			playerRoom.id
		);

		if (!result.success) {
			this._sendError(clientId, "DESELECTION_ERROR", result.error ?? "Failed to deselect object");
		}
	}

	private async _handlePlayerJoined(clientId: string, message: PlayerJoinedMessage): Promise<void> {
		const { payload } = message;
		const playerInfo = { ...payload, isActive: true, isDMMode: false };
		await this._playerService.join(playerInfo);

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom) {
			const drawings = this._roomDrawings.get(playerRoom.id) ?? [];
			if (drawings.length > 0) {
				this._sendDrawingsToPlayer(clientId, drawings);
			}

			const existingCameras = this._roomManager.getRoomPlayerCameras(playerRoom.id);
			for (const camera of existingCameras) {
				if (this._wsServer) {
					this._wsServer.sendTo(clientId, {
						type: WS_MESSAGE_TYPES.CAMERA_UPDATED,
						payload: camera,
					});
				}
			}
		}
	}

	private _sendDrawingsToPlayer(clientId: string, drawings: DrawingElement[]): void {
		if (drawings.length === 0 || !this._wsServer) return;

		this._wsServer.sendTo(clientId, {
			type: WS_MESSAGE_TYPES.DRAWING_SYNC,
			payload: { elements: drawings },
		});
	}

	private async _handleShipMoved(clientId: string, message: WSMessage): Promise<void> {
		if (!isShipMovedMessage(message)) return;

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const payload = message.payload;
		const result = await this._shipService.moveShip(payload.shipId, {
			shipId: payload.shipId,
			phase: payload.phase,
			type: payload.type,
			distance: payload.distance,
			angle: payload.angle,
		});

		if (result.success) {
			const shipStatus = this._shipService.getShipStatus(payload.shipId);
			if (shipStatus) {
				this._roomManager.broadcastToRoom(playerRoom.id, {
					type: WS_MESSAGE_TYPES.SHIP_MOVED,
					payload: {
						shipId: payload.shipId,
						phase: payload.phase,
						type: payload.type,
						distance: payload.distance,
						angle: payload.angle,
						newX: shipStatus.position.x,
						newY: shipStatus.position.y,
						newHeading: shipStatus.heading,
						timestamp: Date.now(),
					},
				});
			}
		}
	}

	private async _handleShieldUpdate(clientId: string, message: ShieldUpdateMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const { payload } = message;
		if (payload.active) {
			await this._shipService.enableShield(payload.shipId);
		} else {
			await this._shipService.disableShield(payload.shipId);
		}

		const shipStatus = await this._shipService.getShipStatus(payload.shipId);

		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
			payload: {
				shipId: payload.shipId,
				active: payload.active,
				type: shipStatus?.shield.type || "front",
				coverageAngle: shipStatus?.shield.coverageAngle || 180,
			},
		});
	}

	private async _handleFluxState(clientId: string, message: FluxStateMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) return;

		const { payload } = message;
		if (payload.fluxState === "venting") {
			await this._shipService.ventShip(payload.shipId);
		}

		const shipStatus = await this._shipService.getShipStatus(payload.shipId);

		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.FLUX_STATE,
			payload: {
				shipId: payload.shipId,
				fluxState: payload.fluxState,
				currentFlux: shipStatus?.flux.current || 0,
				softFlux: shipStatus?.flux.softFlux || 0,
				hardFlux: shipStatus?.flux.hardFlux || 0,
			},
		});
	}

	private async _handleCombatEvent(clientId: string, message: CombatEventMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const { payload } = message;
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.COMBAT_EVENT,
			payload: {
				sourceShipId: payload.sourceShipId,
				targetShipId: payload.targetShipId,
				weaponId: payload.weaponId,
				hit: payload.hit ?? true,
				damage: payload.damage,
				hitQuadrant: payload.hitQuadrant,
				timestamp: Date.now(),
			},
		});
	}

	private async _handleDrawingAdd(clientId: string, message: DrawingAddMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		let drawings = this._roomDrawings.get(playerRoom.id);
		if (!drawings) {
			drawings = [];
			this._roomDrawings.set(playerRoom.id, drawings);
		}
		drawings.push(message.payload.element);

		this._roomManager.broadcastToRoom(
			playerRoom.id,
			{
				type: WS_MESSAGE_TYPES.DRAWING_ADD,
				payload: {
					playerId: clientId,
					element: message.payload.element,
				},
			},
			clientId
		);
	}

	private async _handleDrawingClear(clientId: string, message: DrawingClearMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		if (message.payload.playerId === clientId) {
			this._roomDrawings.set(playerRoom.id, []);
		}

		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.DRAWING_CLEAR,
			payload: { playerId: clientId },
		});
	}

	private async _handleChatMessage(clientId: string, message: ChatMessagePayload): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const player = this._playerService.getPlayer(clientId);

		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
			payload: {
				senderId: clientId,
				senderName: player?.name ?? "Unknown",
				content: message.payload.content,
				timestamp: Date.now(),
			},
		});
	}

	private _sendError(
		clientId: string,
		code: string,
		message: string,
		details?: Record<string, unknown>
	): void {
		if (this._wsServer) {
			this._wsServer.sendTo(clientId, {
				type: WS_MESSAGE_TYPES.ERROR,
				payload: { code, message, details },
			});
		}
	}

	private _sendResponse(
		clientId: string,
		requestId: string,
		response: SuccessResponse<RequestOperation> | ErrorResponse
	): void {
		if (!this._wsServer) return;

		this._wsServer.sendTo(clientId, {
			type: WS_MESSAGE_TYPES.RESPONSE,
			payload: { requestId, ...response },
		});
	}

	private async _handleRoomList(_clientId: string, _data: unknown) {
		const rooms = this._roomManager.listRooms().map((r) => ({
			roomId: r.id,
			playerCount: r.players.size,
			maxPlayers: r.maxPlayers,
			createdAt: r.createdAt,
		}));
		return { rooms };
	}

	private async _handleRoomCreate(_clientId: string, data: unknown) {
		const roomData = data as { roomId: string; maxPlayers?: number };
		if (!roomData?.roomId) throw new Error("Invalid roomId");

		const room = this._roomManager.createRoom(roomData.roomId);
		return { roomId: room.id };
	}

	private async _handleCameraUpdate(
		clientId: string,
		data: Extract<RequestPayload, { operation: "camera.update" }>["data"]
	): Promise<void> {
		const player = this._playerService.getPlayer(clientId);
		if (!player) throw new Error("Player not found");

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		const cameraState = {
			playerId: clientId,
			playerName: player.name,
			centerX: data.x,
			centerY: data.y,
			zoom: data.zoom,
			rotation: 0,
			minZoom: 0.5,
			maxZoom: 4,
			timestamp: Date.now(),
		};
		this._roomManager.updatePlayerCamera(playerRoom.id, clientId, cameraState);

		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.CAMERA_UPDATED,
			payload: cameraState,
		});
	}

	getRoomDrawings(roomId: string): DrawingElement[] {
		return this._roomDrawings.get(roomId) ?? [];
	}

	setWSServer(wsServer: WSSender): void {
		this._wsServer = wsServer;
	}

	// Token 拖拽消息处理
	private async _handleTokenDragStart(
		clientId: string,
		message: TokenDragStartMessage
	): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "DRAG_START_ERROR", "Player is not in a room");
			return;
		}

		const result = await this._selectionService.startTokenDrag({
			tokenId: message.payload.tokenId,
			playerId: clientId,
			position: message.payload.position,
			heading: message.payload.heading,
			roomId: playerRoom.id,
		});

		if (!result.success) {
			this._sendError(clientId, "DRAG_START_ERROR", result.error ?? "Failed to start drag");
		}
	}

	private async _handleTokenDragging(
		clientId: string,
		message: TokenDraggingMessage
	): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "DRAG_ERROR", "Player is not in a room");
			return;
		}

		const result = await this._selectionService.updateTokenDrag({
			tokenId: message.payload.tokenId,
			playerId: clientId,
			position: message.payload.position,
			heading: message.payload.heading,
			roomId: playerRoom.id,
		});

		if (!result.success) {
			console.warn(`Failed to update drag for token ${message.payload.tokenId}:`, result.error);
		}
	}

	private async _handleTokenDragEnd(clientId: string, message: TokenDragEndMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "DRAG_END_ERROR", "Player is not in a room");
			return;
		}

		const result = await this._selectionService.endTokenDrag({
			tokenId: message.payload.tokenId,
			playerId: clientId,
			finalPosition: message.payload.finalPosition,
			finalHeading: message.payload.finalHeading,
			committed: message.payload.committed,
			roomId: playerRoom.id,
		});

		if (!result.success) {
			this._sendError(clientId, "DRAG_END_ERROR", result.error ?? "Failed to end drag");
			return;
		}

		if (message.payload.committed) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.TOKEN_MOVED,
				payload: {
					tokenId: message.payload.tokenId,
					previousPosition: { x: 0, y: 0 },
					newPosition: message.payload.finalPosition,
					previousHeading: 0,
					newHeading: message.payload.finalHeading,
					timestamp: Date.now(),
				},
			});
		}
	}

	private async _handlePing(clientId: string, message: WSMessage): Promise<void> {
		if (this._wsServer) {
			this._wsServer.sendTo(clientId, {
				type: WS_MESSAGE_TYPES.PONG,
				payload: { timestamp: (message as { payload: { timestamp: number } }).payload.timestamp },
			});
		}
	}
}

export default MessageHandler;
