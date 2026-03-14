/**
 * WS 事件处理器
 * 订阅领域事件并广播到 WebSocket
 */

import type { IWSServer, WSMessage } from "@vt/shared/ws";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { EventBus } from "./EventBus";
import type {
	DomainEvent,
	ShipMovedEvent,
	ShieldToggledEvent,
	FluxOverloadedEvent,
	FluxStateUpdatedEvent,
	PlayerJoinedEvent,
	PlayerLeftEvent,
	PlayerDMModeChangedEvent,
	ObjectSelectedEvent,
	ObjectDeselectedEvent,
} from "./DomainEvents";
import type { RoomManager } from "../ws/RoomManager";

export class WSEventHandler {
	private _wsServer: IWSServer;
	private _roomManager: RoomManager;
	private _eventBus: EventBus;

	constructor(wsServer: IWSServer, roomManager: RoomManager, eventBus: EventBus) {
		this._wsServer = wsServer;
		this._roomManager = roomManager;
		this._eventBus = eventBus;
		this._subscribeToEvents();
	}

	private _subscribeToEvents(): void {
		this._eventBus.subscribe<ShipMovedEvent>("SHIP_MOVED", this._handleShipMoved.bind(this));
		this._eventBus.subscribe<ShieldToggledEvent>("SHIELD_TOGGLED", this._handleShieldToggled.bind(this));
		this._eventBus.subscribe<FluxOverloadedEvent>("FLUX_OVERLOADED", this._handleFluxOverloaded.bind(this));
		this._eventBus.subscribe<FluxStateUpdatedEvent>("FLUX_STATE_UPDATED", this._handleFluxStateUpdated.bind(this));
		this._eventBus.subscribe<PlayerJoinedEvent>("PLAYER_JOINED", this._handlePlayerJoined.bind(this));
		this._eventBus.subscribe<PlayerLeftEvent>("PLAYER_LEFT", this._handlePlayerLeft.bind(this));
		this._eventBus.subscribe<PlayerDMModeChangedEvent>(
			"PLAYER_DM_MODE_CHANGED",
			this._handlePlayerDMModeChanged.bind(this)
		);
		this._eventBus.subscribe<ObjectSelectedEvent>("OBJECT_SELECTED", this._handleObjectSelected.bind(this));
		this._eventBus.subscribe<ObjectDeselectedEvent>("OBJECT_DESELECTED", this._handleObjectDeselected.bind(this));
	}

	private _handleShipMoved(event: ShipMovedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.SHIP_MOVED,
			payload: {
				shipId: event.shipId,
				phase: event.phase,
				type: event.phase === 2 ? "rotate" : "straight",
				angle: event.phase === 2 ? event.newHeading - event.previousHeading : undefined,
				newX: event.newPosition.x,
				newY: event.newPosition.y,
				newHeading: event.newHeading,
				timestamp: event.timestamp,
			},
		};
		this._broadcastToRoom("default", message);
	}

	private _handleShieldToggled(event: ShieldToggledEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
			payload: {
				shipId: event.shipId,
				active: event.isActive,
				type: "front", // TODO: 从事件中获取
				coverageAngle: 0, // TODO: 从事件中获取
			},
		};
		this._broadcastToRoom("default", message);
	}

	private _handleFluxOverloaded(event: FluxOverloadedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.FLUX_STATE,
			payload: {
				shipId: event.shipId,
				fluxState: "overloaded",
				currentFlux: event.fluxLevel,
				softFlux: event.fluxLevel,
				hardFlux: 0,
			},
		};
		this._broadcastToRoom("default", message);
	}

	private _handleFluxStateUpdated(event: FluxStateUpdatedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.FLUX_STATE,
			payload: {
				shipId: event.shipId,
				fluxState: event.fluxState,
				currentFlux: event.currentFlux,
				softFlux: event.softFlux,
				hardFlux: event.hardFlux,
			},
		};
		this._broadcastToRoom("default", message);
	}

	private _handlePlayerJoined(event: PlayerJoinedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.PLAYER_JOINED,
			payload: {
				id: event.playerId,
				name: event.playerName,
				joinedAt: event.timestamp,
				isActive: true,
				isDMMode: false,
			},
		};
		this._broadcastToRoom(event.roomId, message);
	}

	private _handlePlayerLeft(event: PlayerLeftEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.PLAYER_LEFT,
			payload: {
				playerId: event.playerId,
				reason: event.reason,
			},
		};
		this._broadcastToRoom(event.roomId, message);
	}

	private _handlePlayerDMModeChanged(event: PlayerDMModeChangedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.DM_TOGGLE,
			payload: {
				playerId: event.playerId,
				playerName: event.playerName,
				enable: event.isDMMode,
				timestamp: event.timestamp,
			},
		};
		this._broadcastToAll(message);
	}

	private _handleObjectSelected(event: ObjectSelectedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.OBJECT_SELECTED,
			payload: {
				playerId: event.playerId,
				playerName: event.playerName,
				tokenId: event.tokenId,
				timestamp: event.timestamp,
				forceOverride: event.forceOverride,
			},
		};
		this._broadcastToRoom(event.roomId, message);
	}

	private _handleObjectDeselected(event: ObjectDeselectedEvent): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.OBJECT_DESELECTED,
			payload: {
				playerId: event.playerId,
				tokenId: event.tokenId,
				timestamp: event.timestamp,
				reason: event.reason,
			},
		};
		this._broadcastToRoom(event.roomId, message);
	}

	private _broadcastToRoom(roomId: string, message: WSMessage): void {
		this._roomManager.broadcastToRoom(roomId, message);
	}

	private _broadcastToAll(message: WSMessage): void {
		this._wsServer.broadcast(message);
	}

	dispose(): void {
		this._eventBus.clear();
	}
}

export default WSEventHandler;
