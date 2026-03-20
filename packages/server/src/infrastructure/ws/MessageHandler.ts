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
	DeploymentStartMessage,
	DeploymentReadyMessage,
	DeploymentTokenPlacedMessage,
	GamePhaseChangedMessage,
	TurnPhaseChangedMessage,
	TurnResolutionMessage,
	ShipActionMessage,
	ShipActionResultMessage,
} from "@vt/shared/ws";
import { MapSnapshotSchema } from "@vt/shared/core-types";
import { WS_MESSAGE_TYPES, isRequestMessage, isShipMovedMessage } from "@vt/shared/ws";
import type { PlayerService } from "../../application/player/PlayerService";
import type { SelectionService } from "../../application/selection/SelectionService";
import type { ShipService } from "../../application/ship/ShipService";
import type { FactionService } from "../../application/faction/FactionService";
import type { FactionTurnService } from "../../application/turn/FactionTurnService";
import type { GameFlowService } from "../../application/game/GameFlowService";
import type { CombatService } from "../../application/combat/CombatService";
import type { DeploymentService } from "../../application/deployment/DeploymentService";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

interface WSSender {
	sendTo: (id: string, msg: WSMessage) => void;
}

export interface MessageHandlerOptions {
	roomManager: RoomManager;
	playerService: PlayerService;
	shipService: ShipService;
	selectionService: SelectionService;
	factionService: FactionService;
	factionTurnService: FactionTurnService;
	gameFlowService?: GameFlowService;
	combatService?: CombatService;
	deploymentService?: DeploymentService;
	wsServer?: WSSender;
}

export class MessageHandler {
	private _roomManager: RoomManager;
	private _playerService: PlayerService;
	private _shipService: ShipService;
	private _selectionService: SelectionService;
	private _factionService: FactionService;
	private _factionTurnService: FactionTurnService;
	private _gameFlowService?: GameFlowService;
	private _combatService?: CombatService;
	private _deploymentService?: DeploymentService;
	private _roomDrawings: Map<string, DrawingElement[]>;
	private _requestHandlers: RequestHandlers;
	private _wsServer?: WSSender;

	constructor(options: MessageHandlerOptions) {
		this._roomManager = options.roomManager;
		this._playerService = options.playerService;
		this._shipService = options.shipService;
		this._selectionService = options.selectionService;
		this._factionService = options.factionService;
		this._factionTurnService = options.factionTurnService;
		this._gameFlowService = options.gameFlowService;
		this._combatService = options.combatService;
		this._deploymentService = options.deploymentService;
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
			"dm.getStatus": this._handleDMGetStatus.bind(this),
			"map.snapshot.get": this._handleMapSnapshotGet.bind(this),
			"map.snapshot.save": this._handleMapSnapshotSave.bind(this),
			"map.token.move": this._handleMapTokenMove.bind(this),
			"room.state.get": this._handleRoomStateGet.bind(this),
			// 三阶段移动操作
			"movement.start": this._handleMovementStart.bind(this),
			"movement.preview": this._handleMovementPreview.bind(this),
			"movement.commit": this._handleMovementCommit.bind(this),
			"movement.cancel": this._handleMovementCancel.bind(this),
			// 战斗交互操作
			"combat.selectTarget": this._handleCombatSelectTarget.bind(this),
			"combat.clearTarget": this._handleCombatClearTarget.bind(this),
			"combat.selectWeapon": this._handleCombatSelectWeapon.bind(this),
			"combat.clearWeapon": this._handleCombatClearWeapon.bind(this),
			"combat.selectQuadrant": this._handleCombatSelectQuadrant.bind(this),
			"combat.clearQuadrant": this._handleCombatClearQuadrant.bind(this),
			"combat.attackPreview": this._handleCombatAttackPreview.bind(this),
			"combat.confirmAttack": this._handleCombatConfirmAttack.bind(this),
			// 部署操作
			"deployment.deployShip": this._handleDeploymentDeployShip.bind(this),
			"deployment.removeShip": this._handleDeploymentRemoveShip.bind(this),
			"deployment.setReady": this._handleDeploymentSetReady.bind(this),
			"deployment.getState": this._handleDeploymentGetState.bind(this),
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
				case WS_MESSAGE_TYPES.FACTION_SELECTED:
					await this._handleFactionSelected(clientId, message);
					break;
				case WS_MESSAGE_TYPES.PLAYER_END_TURN:
					await this._handlePlayerEndTurn(clientId, message);
					break;
				case WS_MESSAGE_TYPES.PLAYER_CANCEL_END_TURN:
					await this._handlePlayerCancelEndTurn(clientId, message);
					break;
				// 游戏流程控制消息
				case WS_MESSAGE_TYPES.DEPLOYMENT_START:
					await this._handleDeploymentStart(clientId, message);
					break;
				case WS_MESSAGE_TYPES.DEPLOYMENT_TOKEN_PLACED:
					await this._handleDeploymentTokenPlaced(clientId, message);
					break;
				case WS_MESSAGE_TYPES.DEPLOYMENT_READY:
					await this._handleDeploymentReady(clientId, message);
					break;
				case WS_MESSAGE_TYPES.GAME_PHASE_CHANGED:
					await this._handleGamePhaseChanged(clientId, message);
					break;
				case WS_MESSAGE_TYPES.TURN_PHASE_CHANGED:
					await this._handleTurnPhaseChanged(clientId, message);
					break;
				// 行动系统消息
				case WS_MESSAGE_TYPES.SHIP_ACTION:
					await this._handleShipAction(clientId, message);
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
		const existing = this._roomManager
			.getMapSnapshot(roomId)
			.tokens.find((token) => token.id === data.tokenId);
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

		return { roomId, token };
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
		};
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

	// ====== 阵营消息处理 ======

	/**
	 * 处理玩家选择阵营消息
	 */
	private async _handleFactionSelected(clientId: string, message: WSMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		const payload = message.payload as { faction: string };
		const player = this._playerService.getPlayer(clientId);
		if (!player) {
			this._sendError(clientId, "PLAYER_NOT_FOUND", "Player not found");
			return;
		}

		// 设置玩家阵营
		const success = this._factionService.setPlayerFaction(
			playerRoom.id,
			clientId,
			player.name,
			payload.faction
		);

		if (!success) {
			this._sendError(clientId, "FACTION_ERROR", "Failed to set player faction");
		}
	}

	/**
	 * 处理玩家宣告结束回合消息
	 */
	private async _handlePlayerEndTurn(clientId: string, message: WSMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		// 检查回合系统是否已初始化
		if (!this._factionTurnService.isTurnSystemInitialized(playerRoom.id)) {
			this._sendError(clientId, "TURN_SYSTEM_NOT_INITIALIZED", "Turn system not initialized");
			return;
		}

		// 检查玩家是否有阵营
		if (!this._factionService.hasPlayerFaction(playerRoom.id, clientId)) {
			this._sendError(clientId, "NO_FACTION", "Player has no faction assigned");
			return;
		}

		const result = this._factionTurnService.playerEndTurn(playerRoom.id, clientId);
		if (!result.success) {
			this._sendError(clientId, "END_TURN_ERROR", "Failed to end turn");
		}
	}

	/**
	 * 处理玩家取消结束回合消息
	 */
	private async _handlePlayerCancelEndTurn(clientId: string, message: WSMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		// 检查回合系统是否已初始化
		if (!this._factionTurnService.isTurnSystemInitialized(playerRoom.id)) {
			this._sendError(clientId, "TURN_SYSTEM_NOT_INITIALIZED", "Turn system not initialized");
			return;
		}

		// 检查玩家是否有阵营
		if (!this._factionService.hasPlayerFaction(playerRoom.id, clientId)) {
			this._sendError(clientId, "NO_FACTION", "Player has no faction assigned");
			return;
		}

		const result = this._factionTurnService.playerCancelEndTurn(playerRoom.id, clientId);
		if (!result.success) {
			this._sendError(clientId, "CANCEL_END_TURN_ERROR", "Failed to cancel end turn");
		}
	}

	// ====== 游戏流程控制消息处理 ======

	/**
	 * 处理部署开始消息
	 */
	private async _handleDeploymentStart(clientId: string, message: DeploymentStartMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		if (!this._gameFlowService) {
			this._sendError(clientId, "GAME_FLOW_NOT_INITIALIZED", "Game flow service not initialized");
			return;
		}

		// 检查玩家是否为DM
		const player = this._playerService.getPlayer(clientId);
		if (!player?.isDMMode) {
			this._sendError(clientId, "NOT_DM", "Only DM can start deployment");
			return;
		}

		try {
			this._gameFlowService.startDeployment(playerRoom.id, message.payload.factions as string[]);
		} catch (error) {
			this._sendError(clientId, "DEPLOYMENT_ERROR", error instanceof Error ? error.message : "Failed to start deployment");
		}
	}

	/**
	 * 处理部署Token放置消息
	 */
	private async _handleDeploymentTokenPlaced(clientId: string, message: DeploymentTokenPlacedMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		// 记录部署的Token到GameFlowService
		if (this._gameFlowService && message.payload.faction && message.payload.tokenId) {
			try {
				this._gameFlowService.registerDeployedToken(
					playerRoom.id,
					message.payload.faction as string,
					message.payload.tokenId,
					clientId
				);
			} catch (error) {
				console.warn('[_handleDeploymentTokenPlaced] Failed to register token:', error);
			}
		}

		// 部署阶段Token可以自由放置，广播给其他玩家
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.DEPLOYMENT_TOKEN_PLACED,
			payload: {
				...message.payload,
				playerId: clientId,
				timestamp: Date.now(),
			},
		}, clientId);
	}

	/**
	 * 处理部署准备消息
	 */
	private async _handleDeploymentReady(clientId: string, message: DeploymentReadyMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		if (!this._gameFlowService) {
			this._sendError(clientId, "GAME_FLOW_NOT_INITIALIZED", "Game flow service not initialized");
			return;
		}

		this._gameFlowService.setDeploymentReady(
			playerRoom.id,
			message.payload.faction as string,
			clientId,
			message.payload.ready
		);

		// 检查是否所有阵营都准备好了
		if (this._gameFlowService.isDeploymentComplete(playerRoom.id)) {
			// 完成部署，开始游戏
			this._gameFlowService.completeDeployment(playerRoom.id);
			this._gameFlowService.startGame(playerRoom.id);
		}
	}

	/**
	 * 处理游戏阶段变更消息
	 */
	private async _handleGamePhaseChanged(clientId: string, message: GamePhaseChangedMessage): Promise<void> {
		// 游戏阶段变更由服务端发起，客户端只接收
		console.log(`Game phase changed: ${message.payload.previousPhase} -> ${message.payload.newPhase}`);
	}

	/**
	 * 处理回合阶段变更消息
	 */
	private async _handleTurnPhaseChanged(clientId: string, message: TurnPhaseChangedMessage): Promise<void> {
		// 回合阶段变更由服务端发起，客户端只接收
		console.log(`Turn phase changed: ${message.payload.previousPhase} -> ${message.payload.newPhase}`);
	}

	// ====== 行动系统消息处理 ======

	/**
	 * 处理舰船行动消息
	 */
	private async _handleShipAction(clientId: string, message: ShipActionMessage): Promise<void> {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) {
			this._sendError(clientId, "NOT_IN_ROOM", "Player is not in a room");
			return;
		}

		if (!this._gameFlowService) {
			this._sendError(clientId, "GAME_FLOW_NOT_INITIALIZED", "Game flow service not initialized");
			return;
		}

		const { shipId, actionType, actionData } = message.payload;

		// 获取舰船行动状态
		const actionState = this._gameFlowService.getShipActionState(playerRoom.id, shipId);
		if (!actionState) {
			this._sendError(clientId, "SHIP_NOT_FOUND", "Ship not found");
			return;
		}

		// 检查行动限制
		const { isActionRestricted } = await import('@vt/shared/protocol');
		const restriction = isActionRestricted(actionType as any, {
			isOverloaded: actionState.isOverloaded,
			isVenting: actionState.hasVented,
			hasFiredThisTurn: actionState.hasFired,
		});

		if (restriction.restricted) {
			// 发送行动失败结果
			if (this._wsServer) {
				this._wsServer.sendTo(clientId, {
					type: WS_MESSAGE_TYPES.SHIP_ACTION_RESULT,
					payload: {
						success: false,
						shipId,
						actionType,
						error: `Action restricted: ${restriction.reason}`,
						restrictionReason: restriction.reason,
						timestamp: Date.now(),
					},
				});
			}
			return;
		}

		// 执行行动
		try {
			let success = false;

			switch (actionType) {
				case 'move':
				case 'rotate':
					// 移动和转向通过现有的ship.move处理
					if (actionData) {
						const moveResult = await this._shipService.moveShip(shipId, actionData as any);
						success = moveResult.success;
					}
					break;
				case 'fire':
					// 开火处理
					success = true; // TODO: 实现开火逻辑
					break;
				case 'shield_toggle':
					// 护盾切换
					success = await this._shipService.toggleShield(shipId);
					break;
				case 'vent':
					// 主动排散
					success = await this._shipService.ventShip(shipId);
					break;
				case 'overload_reset':
					// 解除过载
					if (actionState.isOverloaded && actionState.overloadResetAvailable) {
						// TODO: 调用ShipService解除过载
						success = true;
					}
					break;
			}

			// 更新行动状态
			if (success) {
				const updates: Partial<typeof actionState> = {};

				switch (actionType) {
					case 'move':
						updates.hasMoved = true;
						break;
					case 'rotate':
						updates.hasRotated = true;
						break;
					case 'fire':
						updates.hasFired = true;
						break;
					case 'shield_toggle':
						updates.hasToggledShield = true;
						break;
					case 'vent':
						updates.hasVented = true;
						break;
					case 'overload_reset':
						updates.isOverloaded = false;
						updates.overloadResetAvailable = false;
						break;
				}

				this._gameFlowService.updateShipActionState(playerRoom.id, shipId, updates);
			}

			// 发送行动结果
			if (this._wsServer) {
				this._wsServer.sendTo(clientId, {
					type: WS_MESSAGE_TYPES.SHIP_ACTION_RESULT,
					payload: {
						success,
						shipId,
						actionType,
						timestamp: Date.now(),
					},
				});
			}
		} catch (error) {
			if (this._wsServer) {
				this._wsServer.sendTo(clientId, {
					type: WS_MESSAGE_TYPES.SHIP_ACTION_RESULT,
					payload: {
						success: false,
						shipId,
						actionType,
						error: error instanceof Error ? error.message : "Unknown error",
						timestamp: Date.now(),
					},
				});
			}
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

	// ====== 三阶段移动处理 ======

	private async _handleMovementStart(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'movement.start' }>['data']
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		// 广播移动阶段开始
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.MOVEMENT_PHASE_START,
			payload: {
				shipId: data.shipId,
				phase: data.phase,
				timestamp: Date.now(),
			},
		});

		return { success: true, phase: data.phase, shipId: data.shipId };
	}

	private async _handleMovementPreview(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'movement.preview' }>['data']
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		const status = this._shipService.getShipStatus(data.shipId);
		if (!status) throw new Error("Ship not found");

		// 计算预览位置
		let previewPosition = { ...status.position };
		let previewHeading = status.heading;

		if (data.type === 'straight' && data.distance) {
			const rad = (previewHeading * Math.PI) / 180;
			previewPosition = {
				x: previewPosition.x + Math.cos(rad) * data.distance,
				y: previewPosition.y + Math.sin(rad) * data.distance,
			};
		} else if (data.type === 'strafe' && data.distance) {
			const rad = ((previewHeading + 90) * Math.PI) / 180;
			previewPosition = {
				x: previewPosition.x + Math.cos(rad) * data.distance,
				y: previewPosition.y + Math.sin(rad) * data.distance,
			};
		} else if (data.type === 'rotate' && data.angle) {
			previewHeading = (previewHeading + data.angle + 360) % 360;
		}

		return {
			success: true,
			shipId: data.shipId,
			phase: data.phase,
			preview: {
				startPosition: status.position,
				endPosition: previewPosition,
				startHeading: status.heading,
				endHeading: previewHeading,
				path: [status.position, previewPosition],
				isValid: true,
			},
		};
	}

	private async _handleMovementCommit(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'movement.commit' }>['data']
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		// 执行移动
		const result = await this._shipService.moveShip(data.shipId, {
			shipId: data.shipId,
			phase: data.phase === 'translate_a' ? 1 : data.phase === 'rotate' ? 2 : 3,
			type: data.type,
			distance: data.distance,
			angle: data.angle,
		});

		if (!result.success) throw new Error(result.error ?? "Movement failed");

		const status = this._shipService.getShipStatus(data.shipId);

		// 广播移动提交
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.MOVEMENT_COMMIT,
			payload: {
				shipId: data.shipId,
				newPosition: status?.position ?? { x: 0, y: 0 },
				newHeading: status?.heading ?? 0,
				movementUsed: data.distance ?? 0,
				timestamp: Date.now(),
			},
		});

		return {
			success: true,
			shipId: data.shipId,
			newPosition: status?.position ?? { x: 0, y: 0 },
			newHeading: status?.heading ?? 0,
		};
	}

	private async _handleMovementCancel(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'movement.cancel' }>['data']
	) {
		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		// 广播移动取消
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.MOVEMENT_CANCEL,
			payload: {
				shipId: data.shipId,
				timestamp: Date.now(),
			},
		});

		return { success: true, shipId: data.shipId };
	}

	// ====== 战斗交互处理 ======

	private async _handleCombatSelectTarget(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.selectTarget' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		const selection = this._combatService.selectTarget(data.attackerId, data.targetId);

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.TARGET_SELECTED,
				payload: {
					attackerId: data.attackerId,
					targetId: data.targetId,
					targetInfo: selection.targetInfo,
					timestamp: Date.now(),
				},
			});
		}

		return {
			success: true,
			attackerId: data.attackerId,
			targetId: data.targetId,
			targetInfo: selection.targetInfo,
		};
	}

	private async _handleCombatClearTarget(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.clearTarget' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		this._combatService.clearTarget(data.attackerId);

		return { success: true, attackerId: data.attackerId };
	}

	private async _handleCombatSelectWeapon(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.selectWeapon' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		const selection = this._combatService.selectWeapon(data.shipId, data.weaponInstanceId);
		if (!selection) throw new Error("Failed to select weapon");

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.WEAPON_SELECTED,
				payload: {
					shipId: data.shipId,
					weaponInstanceId: data.weaponInstanceId,
					weaponInfo: selection.weaponInfo,
					timestamp: Date.now(),
				},
			});
		}

		return {
			success: true,
			shipId: data.shipId,
			weaponInstanceId: data.weaponInstanceId,
			weaponInfo: selection.weaponInfo,
		};
	}

	private async _handleCombatClearWeapon(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.clearWeapon' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		this._combatService.clearWeapon(data.shipId);

		return { success: true, shipId: data.shipId };
	}

	private async _handleCombatSelectQuadrant(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.selectQuadrant' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		const selection = this._combatService.selectQuadrant(
			data.attackerId,
			data.targetId,
			data.quadrant as 'front' | 'rear' | 'left' | 'right'
		);
		if (!selection) throw new Error("Failed to select quadrant");

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.QUADRANT_SELECTED,
				payload: {
					attackerId: data.attackerId,
					targetId: data.targetId,
					quadrant: data.quadrant,
					quadrantInfo: selection.quadrantInfo,
					timestamp: Date.now(),
				},
			});
		}

		return {
			success: true,
			attackerId: data.attackerId,
			targetId: data.targetId,
			quadrant: data.quadrant,
			quadrantInfo: selection.quadrantInfo,
		};
	}

	private async _handleCombatClearQuadrant(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.clearQuadrant' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		this._combatService.clearQuadrant(data.attackerId);

		return { success: true, attackerId: data.attackerId };
	}

	private async _handleCombatAttackPreview(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.attackPreview' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		const preview = this._combatService.getAttackPreview(
			data.attackerId,
			data.targetId,
			data.weaponInstanceId,
			data.targetQuadrant as 'front' | 'rear' | 'left' | 'right' | undefined
		);

		return {
			success: true,
			attackerId: data.attackerId,
			targetId: data.targetId,
			weaponInstanceId: data.weaponInstanceId,
			canAttack: preview.canAttack,
			preview: preview.preview,
			blockReason: preview.blockReason,
		};
	}

	private async _handleCombatConfirmAttack(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'combat.confirmAttack' }>['data']
	) {
		if (!this._combatService) throw new Error("Combat service not available");

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (!playerRoom) throw new Error("Player is not in a room");

		// 执行攻击
		const result = this._combatService.executeAttack({
			sourceShipId: data.attackerId,
			targetShipId: data.targetId,
			weaponMountId: data.weaponInstanceId,
			timestamp: Date.now(),
		}, playerRoom.id);

		// 广播攻击确认
		this._roomManager.broadcastToRoom(playerRoom.id, {
			type: WS_MESSAGE_TYPES.ATTACK_CONFIRMED,
			payload: {
				attackerId: data.attackerId,
				targetId: data.targetId,
				weaponInstanceId: data.weaponInstanceId,
				damage: result.hit ? {
					hit: true,
					baseDamage: result.damageResult.damage,
					shieldAbsorbed: result.damageResult.shieldAbsorbed,
					armorReduced: result.damageResult.armorReduced,
					hullDamage: result.damageResult.hullDamage,
					hitQuadrant: result.damageResult.hitQuadrant,
				} : undefined,
				timestamp: Date.now(),
			},
		});

		return {
			success: true,
			attackerId: data.attackerId,
			targetId: data.targetId,
			weaponInstanceId: data.weaponInstanceId,
			damage: result.hit ? {
				hit: true,
				baseDamage: result.damageResult.damage,
				shieldAbsorbed: result.damageResult.shieldAbsorbed,
				armorReduced: result.damageResult.armorReduced,
				hullDamage: result.damageResult.hullDamage,
				hitQuadrant: result.damageResult.hitQuadrant,
			} : undefined,
		};
	}

	// ====== 部署操作处理 ======

	private async _handleDeploymentDeployShip(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'deployment.deployShip' }>['data']
	) {
		if (!this._deploymentService) throw new Error("Deployment service not available");

		const result = this._deploymentService.deployShip({
			shipDefinitionId: data.shipDefinitionId,
			ownerId: data.ownerId,
			faction: data.faction,
			position: data.position,
			heading: data.heading,
			shipName: data.shipName,
		}, clientId);

		if (!result.success) {
			return { success: false, error: result.error };
		}

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom && result.token) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.DEPLOYMENT_TOKEN_PLACED,
				payload: {
					tokenId: result.token.id,
					playerId: clientId,
					faction: data.faction,
					position: data.position,
					heading: data.heading,
					timestamp: Date.now(),
				},
			});
		}

		return {
			success: true,
			token: result.token ? {
				id: result.token.id,
				type: result.token.type,
				position: result.token.position,
				heading: result.token.heading,
				ownerId: result.token.ownerId,
				faction: data.faction,
			} : undefined,
		};
	}

	private async _handleDeploymentRemoveShip(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'deployment.removeShip' }>['data']
	) {
		if (!this._deploymentService) throw new Error("Deployment service not available");

		const result = this._deploymentService.removeDeployedShip({
			tokenId: data.tokenId,
			requesterId: clientId,
		});

		return {
			success: result.success,
			tokenId: result.tokenId,
			error: result.error,
		};
	}

	private async _handleDeploymentSetReady(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'deployment.setReady' }>['data']
	) {
		if (!this._deploymentService) throw new Error("Deployment service not available");

		const success = this._deploymentService.setDeploymentReady({
			faction: data.faction,
			playerId: data.playerId,
			ready: data.ready,
		});

		const playerRoom = this._roomManager.getPlayerRoom(clientId);
		if (playerRoom) {
			this._roomManager.broadcastToRoom(playerRoom.id, {
				type: WS_MESSAGE_TYPES.DEPLOYMENT_READY,
				payload: {
					faction: data.faction,
					playerId: data.playerId,
					ready: data.ready,
					timestamp: Date.now(),
				},
			});
		}

		return { success, faction: data.faction, ready: data.ready };
	}

	private async _handleDeploymentGetState(
		clientId: string,
		data: Extract<RequestPayload, { operation: 'deployment.getState' }>['data']
	) {
		if (!this._deploymentService) throw new Error("Deployment service not available");

		const state = this._deploymentService.getState();

		return {
			isDeploymentPhase: state.isDeploymentPhase,
			deployedShips: Object.fromEntries(
				Object.entries(state.deployedShips).map(([faction, ships]) => [
					faction,
					ships.map(ship => ({
						id: ship.id,
						position: ship.position,
						heading: ship.heading,
						ownerId: ship.ownerId,
					})),
				])
			),
			readyStatus: state.readyStatus,
		};
	}
}

export default MessageHandler;
