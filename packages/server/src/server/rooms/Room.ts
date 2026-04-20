/**
 * 游戏房间（Socket.IO 适配版）
 *
 * 移除 ConnectionManager 依赖，改为通过回调函数与传输层交互。
 * 业务逻辑（玩家管理、游戏流程、消息处理）完全保留。
 */

import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../infra/simple-logger.js";
import { GameStateManager } from "../../core/state/GameStateManager.js";

/** 房间配置 */
export interface RoomOptions {
	roomName: string;
	maxPlayers?: number;
	mapWidth?: number;
	mapHeight?: number;
	creatorSessionId?: string;
}

/** 传输层回调（由 Socket.IO handler 注入） */
export interface RoomTransportCallbacks {
	/** 发送消息给指定玩家 */
	sendToPlayer: (playerId: string, message: any) => void;
	/** 广播给房间内所有人 */
	broadcast: (message: any) => void;
	/** 广播给特定阵营 */
	broadcastToFaction: (faction: string, message: any) => void;
	/** 广播给除某玩家外的所有人 */
	broadcastExcept: (excludePlayerId: string, message: any) => void;
	/** 广播给观察者 */
	broadcastToSpectators: (message: any) => void;
	/** 广播给非观察者玩家 */
	broadcastToPlayers: (message: any) => void;
}

export class Room {
	readonly id: string;
	readonly createdAt: number;

	private stateManager: GameStateManager;
	callbacks: RoomTransportCallbacks;
	private logger;

	private options: Required<RoomOptions>;
	private playerConnections = new Map<string, string>(); // playerId -> connectionId
	private isActive = true;

	constructor(
		callbacks: RoomTransportCallbacks,
		options: RoomOptions
	) {
		this.id = `room_${uuidv4().substring(0, 8)}`;
		this.createdAt = Date.now();
		this.callbacks = callbacks;

		this.options = {
			maxPlayers: 8,
			mapWidth: 2000,
			mapHeight: 2000,
			creatorSessionId: "",
			...options,
		};

		this.logger = createLogger(`room-${this.id}`);

		this.stateManager = new GameStateManager(
			this.id,
			this.options.roomName,
			this.options.maxPlayers
		);

		this.logger.info("Room created", {
			roomName: this.options.roomName,
			maxPlayers: this.options.maxPlayers,
			creator: this.options.creatorSessionId,
		});
	}

	// ==================== 玩家管理 ====================

	joinPlayer(connectionId: string, playerId: string, playerName: string): boolean {
		if (!this.isActive) {
			this.logger.warn("Room is not active, cannot join");
			return false;
		}

		if (this.playerConnections.size >= this.options.maxPlayers) {
			this.logger.warn("Room is full", { playerId, playerName });
			return false;
		}

		if (this.playerConnections.has(playerId)) {
			this.logger.warn("Player already in room", { playerId });
			return false;
		}

		this.stateManager.addPlayer({
			id: playerId,
			sessionId: connectionId,
			name: playerName,
			role: "PLAYER",
			faction: "PLAYER",
			ready: false,
			connected: true,
			pingMs: 0,
		});

		this.playerConnections.set(playerId, connectionId);

		this.logger.info("Player joined", {
			playerId,
			playerName,
			connectionId,
			totalPlayers: this.playerConnections.size,
		});

		this.callbacks.broadcast({
			type: "PLAYER_JOINED",
			payload: {
				playerId,
				playerName,
				joinedAt: Date.now(),
				totalPlayers: this.playerConnections.size,
			},
		});

		return true;
	}

	leavePlayer(playerId: string): boolean {
		if (!this.playerConnections.has(playerId)) {
			return false;
		}

		this.stateManager.removePlayer(playerId);
		this.playerConnections.delete(playerId);

		this.logger.info("Player left", {
			playerId,
			totalPlayers: this.playerConnections.size,
		});

		this.callbacks.broadcast({
			type: "PLAYER_LEFT",
			payload: {
				playerId,
				leftAt: Date.now(),
				totalPlayers: this.playerConnections.size,
			},
		});

		if (this.playerConnections.size === 0) {
			this.scheduleCleanup();
		}

		return true;
	}

	togglePlayerReady(playerId: string): boolean {
		const player = this.stateManager.getPlayer(playerId);
		if (!player) return false;

		const newReadyState = !player.ready;
		this.stateManager.updatePlayer(playerId, { ready: newReadyState });

		this.callbacks.broadcast({
			type: "PLAYER_READY_CHANGED",
			payload: { playerId, ready: newReadyState },
		});

		this.checkAllPlayersReady();
		return true;
	}

	private checkAllPlayersReady(): void {
		const allPlayers = this.stateManager.getAllPlayers();
		const allReady = allPlayers.length > 0 && allPlayers.every((p) => p.ready);

		if (allReady && this.stateManager.getState().phase === "DEPLOYMENT") {
			this.startGame();
		}
	}

	// ==================== 游戏流程 ====================

	startGame(): void {
		this.stateManager.setPhase("DEPLOYMENT");
		this.logger.info("Game started");

		this.callbacks.broadcast({
			type: "GAME_STARTED",
			payload: {
				startedAt: Date.now(),
				turn: 1,
				activeFaction: "PLAYER",
			},
		});
	}

	nextTurn(): void {
		this.stateManager.nextTurn();
		const state = this.stateManager.getState();

		this.callbacks.broadcast({
			type: "TURN_CHANGED",
			payload: {
				turn: state.turn,
				activeFaction: state.activeFaction,
				changedAt: Date.now(),
			},
		});
	}

	switchActiveFaction(faction: string): void {
		this.stateManager.setActiveFaction(faction);
		this.callbacks.broadcast({
			type: "ACTIVE_FACTION_CHANGED",
			payload: { faction, changedAt: Date.now() },
		});
	}

	// ==================== 消息处理（核心入口） ====================

	/** 处理玩家消息 —— 由 Socket.IO handler 直接调用 */
	handlePlayerMessage(playerId: string, message: any): void {
		if (!this.isActive) return;

		const { type, payload, requestId } = message;

		try {
			switch (type) {
				case "TOGGLE_READY":
					this.handleToggleReady(playerId, payload, requestId);
					break;
				case "START_GAME":
					this.handleStartGame(playerId, payload, requestId);
					break;
				case "NEXT_TURN":
					this.handleNextTurn(playerId, payload, requestId);
					break;
				case "GAME_COMMAND":
					this.handleGameCommand(playerId, payload, requestId);
					break;
				default:
					this.sendError(playerId, "UNKNOWN_COMMAND", "未知命令", requestId);
			}
		} catch (error) {
			this.logger.error("Error handling player message", error, { playerId, messageType: type });
			this.sendError(playerId, "COMMAND_ERROR", "命令处理失败", requestId);
		}
	}

	private handleToggleReady(playerId: string, _payload: any, requestId?: string): void {
		const success = this.togglePlayerReady(playerId);
		if (success) {
			this.callbacks.sendToPlayer(playerId, {
				type: "TOGGLE_READY_SUCCESS",
				payload: { ready: this.stateManager.getPlayer(playerId)?.ready },
				requestId,
			});
		} else {
			this.sendError(playerId, "TOGGLE_READY_FAILED", "切换准备状态失败", requestId);
		}
	}

	private handleStartGame(playerId: string, _payload: any, requestId?: string): void {
		const state = this.stateManager.getState();
		if (state.phase !== "DEPLOYMENT") {
			this.sendError(playerId, "GAME_ALREADY_STARTED", "游戏已开始", requestId);
			return;
		}
		this.startGame();
		this.callbacks.sendToPlayer(playerId, {
			type: "START_GAME_SUCCESS",
			payload: { startedAt: Date.now() },
			requestId,
		});
	}

	private handleNextTurn(playerId: string, _payload: any, requestId?: string): void {
		const player = this.stateManager.getPlayer(playerId);
		const state = this.stateManager.getState();
		if (player?.faction !== state.activeFaction) {
			this.sendError(playerId, "NOT_YOUR_TURN", "不是你的回合", requestId);
			return;
		}
		this.nextTurn();
		this.callbacks.sendToPlayer(playerId, {
			type: "NEXT_TURN_SUCCESS",
			payload: { turn: state.turn + 1 },
			requestId,
		});
	}

	private handleGameCommand(playerId: string, payload: any, requestId?: string): void {
		this.callbacks.broadcast({
			type: "GAME_COMMAND_EXECUTED",
			payload: {
				playerId,
				command: payload,
				executedAt: Date.now(),
			},
			requestId,
		});
	}

	// ==================== 消息发送（委托给回调）====================

	send(playerId: string, message: any): void {
		this.callbacks.sendToPlayer(playerId, message);
	}

	sendError(playerId: string, code: string, message: string, requestId?: string): void {
		this.callbacks.sendToPlayer(playerId, {
			type: "ERROR",
			payload: { code, message },
			requestId,
		});
	}

	broadcast(message: any): void {
		this.callbacks.broadcast(message);
	}

	broadcastToFaction(faction: string, message: any): void {
		this.callbacks.broadcastToFaction(faction, message);
	}

	broadcastExcept(excludePlayerId: string, message: any): void {
		this.callbacks.broadcastExcept(excludePlayerId, message);
	}

	broadcastToSpectators(message: any): void {
		this.callbacks.broadcastToSpectators(message);
	}

	broadcastToPlayers(message: any): void {
		this.callbacks.broadcastToPlayers(message);
	}

	sendToPlayer(playerId: string, message: any): void {
		this.callbacks.sendToPlayer(playerId, message);
	}

	// ==================== 查询 ====================

	getInfo(): any {
		const state = this.stateManager.getState();
		return {
			id: this.id,
			name: this.options.roomName,
			createdAt: this.createdAt,
			phase: state.phase,
			turn: state.turn,
			activeFaction: state.activeFaction,
			playerCount: this.playerConnections.size,
			maxPlayers: this.options.maxPlayers,
			mapSize: { width: this.options.mapWidth, height: this.options.mapHeight },
			creator: this.options.creatorSessionId,
		};
	}

	getPlayers(): any[] {
		return this.stateManager.getAllPlayers().map((player) => ({
			id: player.id,
			name: player.name,
			role: player.role,
			faction: player.faction,
			ready: player.ready,
			connected: player.connected,
			pingMs: player.pingMs,
		}));
	}

	getGameState(): any {
		return this.stateManager.getStateSnapshot();
	}

	getStateManager() {
		return this.stateManager;
	}

	getPlayerCount(): number {
		return this.playerConnections.size;
	}

	getPlayerBySessionId(sessionId: string): any {
		for (const [playerId, connectionId] of this.playerConnections.entries()) {
			if (connectionId === sessionId) {
				return this.stateManager.getPlayer(playerId);
			}
		}
		return null;
	}

	isRoomActive(): boolean {
		return this.isActive;
	}

	get name(): string { return this.options.roomName; }
	get creatorId(): string { return this.options.creatorSessionId; }
	get maxPlayers(): number { return this.options.maxPlayers; }
	get isPrivate(): boolean { return false; }
	get password(): string | undefined { return undefined; }
	get gameState(): any { return this.getGameState(); }
	getShipTokens() { return this.stateManager.getShipTokens(); }
	getShipToken(shipId: string) { return this.stateManager.getShipToken(shipId); }

	updateShipTokenRuntime(shipId: string, runtimeUpdates: Record<string, unknown>): boolean {
		const token = this.stateManager.getShipToken(shipId);
		if (!token) return false;
		this.stateManager.updateShipToken(shipId, {
			...token,
			runtime: { ...token.runtime, ...runtimeUpdates },
		});
		return true;
	}

	addPlayer(playerState: any): boolean {
		return this.joinPlayer(playerState.sessionId, playerState.id, playerState.name);
	}

	removePlayer(playerId: string): boolean {
		return this.leavePlayer(playerId);
	}

	// ==================== 生命周期 ====================

	private scheduleCleanup(delay: number = 30000): void {
		setTimeout(() => {
			if (this.playerConnections.size === 0) this.cleanup();
		}, delay);
	}

	cleanup(): void {
		if (!this.isActive) return;
		this.isActive = false;
		this.logger.info("Room cleaning up");
		this.callbacks.broadcast({
			type: "ROOM_CLOSED",
			payload: { reason: "empty", closedAt: Date.now() },
		});
		this.playerConnections.clear();
		this.logger.info("Room cleaned up");
	}
}
