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
import { MapSnapshotSchema } from "@vt/shared/core-types";
import type { TurnPhase } from "@vt/shared/types";
import { WS_MESSAGE_TYPES, isRequestMessage, isShipMovedMessage } from "@vt/shared/ws";
import type { PlayerService } from "../../application/player/PlayerService";
import type { SelectionService } from "../../application/selection/SelectionService";
import type { ShipService } from "../../application/ship/ShipService";
import { MovementStepEngine } from "../../application/turn/MovementStepEngine";
import { RoomTurnCoordinator } from "../../application/turn/RoomTurnCoordinator";
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
	private _turnCoordinator: RoomTurnCoordinator;

	constructor(options: MessageHandlerOptions) {
		this._roomManager = options.roomManager;
		this._playerService = options.playerService;
		this._shipService = options.shipService;
		this._selectionService = options.selectionService;
		this._wsServer = options.wsServer;
		this._roomDrawings = new Map();
		this._turnCoordinator = new RoomTurnCoordinator(this._playerService, this._roomManager);
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
			"dm.getStatus": this._handleDMGetStatus.bind(this),
			"map.snapshot.get": this._handleMapSnapshotGet.bind(this),
			"map.snapshot.save": this._handleMapSnapshotSave.bind(this),
			"map.token.move": this._handleMapTokenMove.bind(this),
			"map.token.move.step": this._handleMapTokenMoveStep.bind(this),
			"map.token.deploy": this._handleMapTokenDeploy.bind(this),
			"turn.initialize": this._handleTurnInitialize.bind(this),
			"turn.advance": this._handleTurnAdvance.bind(this),
			"turn.setPhase": this._handleTurnSetPhase.bind(this),
			"turn.state.get": this._handleTurnStateGet.bind(this),
			"ship.assets.list": this._handleShipAssetsList.bind(this),
			"player.hangar.get": this._handlePlayerHangarGet.bind(this),
			"player.hangar.setActiveShip": this._handlePlayerHangarSetActiveShip.bind(this),
			"room.state.get": this._handleRoomStateGet.bind(this),
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
		const joinedRoomId = roomId ?? "default";

		// 为玩家创建最小可操作 Token（已存在则不覆盖 owner）
		this._roomManager.upsertTokenPosition(
			joinedRoomId,
			`ship_${data.id}`,
			this._createSpawnPosition(joinedRoomId, data.id),
			0,
			data.id,
			"ship",
			56
		);

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
		if (data.playerId !== clientId) throw new Error("Cannot toggle DM mode for another player");

		const player = this._playerService.getPlayer(clientId);
		if (!player) throw new Error("Player not found");

		const success = await this._playerService.toggleDMMode(clientId, data.enable);
		if (!success) throw new Error("Failed to toggle DM mode");

		const updatedPlayer = this._playerService.getPlayer(clientId);
		if (!updatedPlayer) throw new Error("Player not found after DM toggle");
		return updatedPlayer;
	}

	private async _handleDMGetStatus(clientId: string, _data: unknown) {
		const player = this._playerService.getPlayer(clientId);
		if (!player) throw new Error("Player not found");

		// 获取玩家所在的房间
		const playerRoom = this._roomManager.getPlayerRoom(clientId);

		// 获取所有玩家的 DM 状态
		let allPlayers: { id: string; name: string; isDMMode: boolean }[] = [];
		if (playerRoom) {
			const roomPlayers = this._playerService.listPlayers(playerRoom.id);
			allPlayers = roomPlayers.map((p) => ({
				id: p.id,
				name: p.name,
				isDMMode: p.isDMMode ?? false,
			}));
		} else {
			// 如果玩家不在房间中，只返回当前玩家
			allPlayers = [{
				id: player.id,
				name: player.name,
				isDMMode: player.isDMMode ?? false,
			}];
		}

		return {
			isDMMode: player.isDMMode ?? false,
			players: allPlayers,
		};
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

		const room = this._roomManager.createRoom(roomData.roomId, roomData.maxPlayers);
		return { roomId: room.id };
	}


	private async _handleMapSnapshotGet(
		clientId: string,
		data: Extract<RequestPayload, { operation: "map.snapshot.get" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		return { roomId, snapshot };
	}

	private async _handleMapSnapshotSave(
		clientId: string,
		data: Extract<RequestPayload, { operation: "map.snapshot.save" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		const parsed = MapSnapshotSchema.safeParse(data.snapshot);
		if (!parsed.success) {
			throw new Error("Invalid map snapshot payload");
		}
		const snapshot = this._roomManager.saveMapSnapshot(roomId, parsed.data);
		return { roomId, snapshot };
	}

	private async _handleMapTokenMove(
		clientId: string,
		data: Extract<RequestPayload, { operation: "map.token.move" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		if (!this._canControlToken(roomId, clientId, data.tokenId)) {
			throw new Error("You are not allowed to control this token");
		}
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const existing = snapshot.tokens.find((token) => token.id === data.tokenId);
		const movementDistance = existing
			? Math.hypot(data.position.x - existing.position.x, data.position.y - existing.position.y)
			: 0;
		const movementValidation = this._turnCoordinator.validateMovement(
			roomId,
			clientId,
			existing,
			movementDistance
		);
		if (!movementValidation.ok) {
			throw new Error(movementValidation.reason ?? "Invalid movement");
		}

		const previousPosition = existing?.position ?? data.position;
		const previousHeading = existing?.heading ?? data.heading;

		const token = this._roomManager.upsertTokenPosition(
			roomId,
			data.tokenId,
			data.position,
			data.heading,
			data.ownerId ?? clientId,
			data.type ?? "ship",
			data.size ?? 50
		);

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TOKEN_MOVED,
			payload: {
				tokenId: token.id,
				previousPosition,
				newPosition: data.position,
				previousHeading,
				newHeading: data.heading,
				timestamp: Date.now(),
			},
		});
		this._turnCoordinator.consumeMovementBudget(roomId, data.tokenId, movementDistance);

		return { roomId, token };
	}

	private async _handleMapTokenMoveStep(
		clientId: string,
		data: Extract<RequestPayload, { operation: "map.token.move.step" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const token = snapshot.tokens.find((item) => item.id === data.tokenId);
		if (!token) {
			throw new Error("Token not found");
		}
		if (!this._canControlToken(roomId, clientId, data.tokenId)) {
			throw new Error("You are not allowed to control this token");
		}

		const stepResult = MovementStepEngine.applyStep(
			{ position: token.position, heading: token.heading },
			{
				stepIndex: data.stepIndex,
				forward: data.forward,
				strafe: data.strafe,
				rotation: data.rotation,
			}
		);

		const movementValidation = this._turnCoordinator.validateMovement(
			roomId,
			clientId,
			token,
			stepResult.consumedDistance
		);
		if (!movementValidation.ok) {
			throw new Error(movementValidation.reason ?? "Invalid movement step");
		}
		const previousPosition = token.position;
		const previousHeading = token.heading;

		const updatedToken = this._roomManager.upsertTokenPosition(
			roomId,
			token.id,
			stepResult.nextPosition,
			stepResult.nextHeading,
			token.ownerId,
			token.type,
			token.size
		);
		this._turnCoordinator.consumeMovementBudget(roomId, token.id, stepResult.consumedDistance);

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TOKEN_MOVED,
			payload: {
				tokenId: token.id,
				previousPosition,
				newPosition: stepResult.nextPosition,
				previousHeading,
				newHeading: stepResult.nextHeading,
				timestamp: Date.now(),
			},
		});

		return {
			roomId,
			token: updatedToken,
			appliedStep: {
				stepIndex: data.stepIndex,
				forward: data.forward,
				strafe: data.strafe,
				rotation: data.rotation,
			},
		};
	}

	private async _handleMapTokenDeploy(
		clientId: string,
		data: Extract<RequestPayload, { operation: "map.token.deploy" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		const state = this._turnCoordinator.getState(roomId);
		if (state.phase !== "deployment") {
			throw new Error("Deploy operation only allowed in deployment phase");
		}

		const ownerId = data.ownerId ?? clientId;
		const player = this._playerService.getPlayer(clientId);
		const isDM = Boolean(player?.isDMMode);
		if (!isDM && ownerId !== clientId) {
			throw new Error("Only DM can deploy token for another player");
		}

		const validation = this._turnCoordinator.validateDeployment(roomId, ownerId, data.position);
		if (!validation.ok) {
			throw new Error(validation.reason ?? "Invalid deployment position");
		}

		const allAssets = this._playerService.getShipAssets();
		const requestedAsset = data.shipAssetId
			? allAssets.find((asset) => asset.id === data.shipAssetId)
			: undefined;
		if (data.shipAssetId && !requestedAsset) {
			throw new Error(`Unknown ship asset: ${data.shipAssetId}`);
		}

		const tokenMetadata: Record<string, unknown> = {};
		if (requestedAsset) {
			tokenMetadata.assetId = requestedAsset.id;
			tokenMetadata.assetName = requestedAsset.name;
			tokenMetadata.hullClass = requestedAsset.hullClass;
			tokenMetadata.manufacturer = requestedAsset.manufacturer;
		}

		const token = this._roomManager.upsertTokenPosition(
			roomId,
			data.tokenId,
			data.position,
			data.heading,
			ownerId,
			data.type ?? "ship",
			data.size ?? requestedAsset?.baseStats.size ?? 56,
			tokenMetadata
		);
		if (data.dockedShipId) {
			const hangar = this._playerService.getPlayerHangar(ownerId);
			const docked = hangar?.dockedShips.find((ship) => ship.id === data.dockedShipId);
			if (!docked) {
				throw new Error("Docked ship not found");
			}
			if (docked.assignedTokenId && docked.assignedTokenId !== token.id) {
				throw new Error("Docked ship is already deployed");
			}
			docked.assignedTokenId = token.id;
			if (data.customization) {
				docked.customization = {
					...docked.customization,
					...(data.customization as Record<string, unknown>),
				} as typeof docked.customization;
			}
			const dockedAsset = allAssets.find((asset) => asset.id === docked.assetId);
			token.maxMovement = dockedAsset?.baseStats.maxMovement ?? token.maxMovement;
			token.remainingMovement = token.maxMovement;
			token.metadata = {
				...token.metadata,
				dockedShipId: docked.id,
				assetId: docked.assetId,
				assetName: dockedAsset?.name,
				hullClass: dockedAsset?.hullClass,
				manufacturer: dockedAsset?.manufacturer,
				name: docked.displayName,
				customization: docked.customization,
			};
		}

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TOKEN_PLACED,
			payload: token,
		});

		return { roomId, token, phase: state.phase };
	}

	private async _handleRoomStateGet(
		clientId: string,
		data: Extract<RequestPayload, { operation: "room.state.get" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		const players = this._playerService.listPlayers(roomId);
		const current = this._playerService.getPlayer(clientId);
		const dmPlayers = players.map((p) => ({
			id: p.id,
			name: p.name,
			isDMMode: p.isDMMode ?? false,
		}));

		return {
			roomId,
			players,
			dm: {
				isDMMode: current?.isDMMode ?? false,
				players: dmPlayers,
			},
			snapshot: this._roomManager.getMapSnapshot(roomId),
			turn: this._turnCoordinator.getState(roomId),
			hangar: this._playerService.getPlayerHangar(clientId),
		};
	}

	private async _handleShipAssetsList(_clientId: string, _data: Extract<RequestPayload, { operation: "ship.assets.list" }>["data"]) {
		return {
			assets: this._playerService.getShipAssets(),
		};
	}

	private async _handlePlayerHangarGet(
		clientId: string,
		data: Extract<RequestPayload, { operation: "player.hangar.get" }>["data"]
	) {
		const playerId = data.playerId ?? clientId;
		if (playerId !== clientId && !this._playerService.getPlayer(clientId)?.isDMMode) {
			throw new Error("Only DM can query another player's hangar");
		}
		const hangar = this._playerService.getPlayerHangar(playerId);
		if (!hangar) {
			throw new Error("Hangar not found");
		}
		return hangar;
	}

	private async _handlePlayerHangarSetActiveShip(
		clientId: string,
		data: Extract<RequestPayload, { operation: "player.hangar.setActiveShip" }>["data"]
	) {
		const hangar = this._playerService.setActiveDockedShip(clientId, data.dockedShipId);
		if (!hangar) {
			throw new Error("Failed to set active docked ship");
		}
		return hangar;
	}

	private async _handleTurnInitialize(
		clientId: string,
		data: Extract<RequestPayload, { operation: "turn.initialize" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		this._requireDM(clientId);
		const state = this._turnCoordinator.initialize(roomId);
		this._broadcastTurnState(roomId, state, WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED);
		return state;
	}

	private async _handleTurnAdvance(
		clientId: string,
		data: Extract<RequestPayload, { operation: "turn.advance" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		this._requireDM(clientId);
		const state = this._turnCoordinator.advanceTurn(roomId);
		this._broadcastTurnState(roomId, state, WS_MESSAGE_TYPES.TURN_ORDER_UPDATED);
		return state;
	}

	private async _handleTurnSetPhase(
		clientId: string,
		data: Extract<RequestPayload, { operation: "turn.setPhase" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		this._requireDM(clientId);
		const state = this._turnCoordinator.setPhase(roomId, data.phase as TurnPhase);
		this._broadcastTurnState(roomId, state, WS_MESSAGE_TYPES.TURN_ORDER_UPDATED);
		return state;
	}

	private async _handleTurnStateGet(
		clientId: string,
		data: Extract<RequestPayload, { operation: "turn.state.get" }>["data"]
	) {
		const roomId = data.roomId ?? this._roomManager.getPlayerRoom(clientId)?.id ?? "default";
		return this._turnCoordinator.getState(roomId);
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
			const existing = this._roomManager
				.getMapSnapshot(playerRoom.id)
				.tokens.find((t) => t.id === message.payload.tokenId);
			if (!this._canControlToken(playerRoom.id, clientId, message.payload.tokenId)) {
				this._sendError(clientId, "DRAG_END_ERROR", "You are not allowed to control this token");
				return;
			}
			const previousPosition = existing?.position ?? message.payload.finalPosition;
			const previousHeading = existing?.heading ?? message.payload.finalHeading;
			this._roomManager.upsertTokenPosition(
				playerRoom.id,
				message.payload.tokenId,
				message.payload.finalPosition,
				message.payload.finalHeading,
				clientId
			);
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.TOKEN_MOVED,
				payload: {
					tokenId: message.payload.tokenId,
					previousPosition,
					newPosition: message.payload.finalPosition,
					previousHeading,
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

	private _canControlToken(roomId: string, clientId: string, tokenId: string): boolean {
		const token = this._roomManager.getMapSnapshot(roomId).tokens.find((item) => item.id === tokenId);
		if (!token) return true;
		if (token.ownerId === clientId) return true;
		const player = this._playerService.getPlayer(clientId);
		return Boolean(player?.isDMMode);
	}

	private _requireDM(clientId: string): void {
		const player = this._playerService.getPlayer(clientId);
		if (!player?.isDMMode) {
			throw new Error("DM permission required");
		}
	}

	private _broadcastTurnState(
		roomId: string,
		state: { round: number; phase: TurnPhase; currentIndex: number },
		type: typeof WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED | typeof WS_MESSAGE_TYPES.TURN_ORDER_UPDATED
	): void {
		const room = this._roomManager.getRoom(roomId);
		const units = Array.from(room?.players.values() ?? []).map((player, index) => ({
			id: player.id,
			name: player.name,
			ownerId: player.id,
			ownerName: player.name,
			unitType: "ship" as const,
			state: index === state.currentIndex ? "active" as const : "waiting" as const,
			initiative: 10,
		}));
		this._roomManager.broadcastToRoom(roomId, {
			type,
			payload: {
				units,
				roundNumber: state.round,
				phase: state.phase,
			},
		});
	}

	private _createSpawnPosition(roomId: string, playerId: string): { x: number; y: number } {
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const playerTokenCount = snapshot.tokens.filter((token) => token.ownerId === playerId).length;
		const index = snapshot.tokens.filter((token) => token.type === "ship").length + playerTokenCount;
		const baseX = 800;
		const baseY = 900;
		const step = 280;
		return {
			x: baseX + (index % 4) * step,
			y: baseY + Math.floor(index / 4) * step,
		};
	}
}

export default MessageHandler;
