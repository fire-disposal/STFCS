/**
 * 游戏房间（使用 MutativeStateManager）
 */

import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../infra/simple-logger.js";
import { MutativeStateManager } from "../../core/state/MutativeStateManager.js";
import type { Server as IOServer } from "socket.io";
import type { GameRoomState, CombatToken, TokenRuntime } from "@vt/data";
import { GameMode, type GameMode as GameModeType, Faction, createBattleLogEvent } from "@vt/data";
import { executeTurnAdvance } from "../../core/engine/flow/TurnFlowController.js";

export interface RoomOptions {
	roomName: string;
	maxPlayers?: number;
	mapWidth?: number;
	mapHeight?: number;
	creatorSessionId?: string;
	creatorName?: string;
}

export interface RoomTransportCallbacks {
	sendToPlayer: (playerId: string, message: any) => void;
	broadcast: (message: any) => void;
}

export class Room {
	readonly id: string;
	readonly createdAt: number;
	emptiedAt: number | null = null;

	private stateManager: MutativeStateManager;
	callbacks: RoomTransportCallbacks;
	private logger;

	private options: Required<RoomOptions>;
	private playerConnections = new Map<string, string>();
	private playerHistory = new Set<string>();
	private isActive = true;

	constructor(callbacks: RoomTransportCallbacks, options: RoomOptions) {
		this.id = `room_${uuidv4().substring(0, 8)}`;
		this.createdAt = Date.now();
		this.callbacks = callbacks;

		this.options = {
			maxPlayers: 8,
			mapWidth: 2000,
			mapHeight: 2000,
			creatorSessionId: "",
			creatorName: "未知",
			...options,
		};

		this.logger = createLogger(`room-${this.id}`);

		this.stateManager = new MutativeStateManager(this.id, {
			roomId: this.id,
			ownerId: this.options.creatorSessionId,
			mode: GameMode.DEPLOYMENT,
			players: {},
			tokens: {},
			globalModifiers: {},
			createdAt: this.createdAt,
		});

		this.logger.info("Room created", {
			roomName: this.options.roomName,
			maxPlayers: this.options.maxPlayers,
			creator: this.options.creatorSessionId,
		});
	}

	setIo(io: IOServer): void {
		this.stateManager.setIo(io);
	}

	getStateManager(): MutativeStateManager {
		return this.stateManager;
	}

	joinPlayer(connectionId: string, playerId: string, playerName: string, avatar?: string): boolean {
		if (!this.isActive) return false;
		if (this.playerConnections.size >= this.options.maxPlayers) return false;

		const existingPlayer = this.stateManager.getPlayer(playerId);
		if (existingPlayer) {
			if (existingPlayer.connected) return false;
			return this.reconnectPlayer(connectionId, playerId, playerName, avatar);
		}

		this.emptiedAt = null;

		const playerData: {
			sessionId: string;
			nickname: string;
			role: "HOST" | "PLAYER";
			isReady: boolean;
			connected: boolean;
			avatar?: string;
		} = {
			sessionId: connectionId,
			nickname: playerName,
			role: this.options.creatorSessionId === playerId ? "HOST" : "PLAYER",
			isReady: false,
			connected: true,
		};
		if (avatar) playerData.avatar = avatar;

		this.stateManager.addPlayer(playerId, playerData);

		this.playerConnections.set(playerId, connectionId);
		this.playerHistory.add(playerId);

		this.logger.info("Player joined", {
			playerId,
			playerName,
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

		this.stateManager.appendLog(
			createBattleLogEvent("player_joined", {
				playerId,
				playerName,
				totalPlayers: this.playerConnections.size,
			})
		);

		return true;
	}

	reconnectPlayer(
		connectionId: string,
		playerId: string,
		playerName: string,
		avatar?: string
	): boolean {
		const existingPlayer = this.stateManager.getPlayer(playerId);
		if (!existingPlayer) return false;

		this.emptiedAt = null;

		const updates: Partial<{
			sessionId: string;
			nickname: string;
			connected: boolean;
			avatar: string;
		}> = {
			sessionId: connectionId,
			nickname: playerName,
			connected: true,
		};
		if (avatar) updates.avatar = avatar;

		this.stateManager.updatePlayer(playerId, updates);

		this.playerConnections.set(playerId, connectionId);

		this.logger.info("Player reconnected", { playerId, playerName });

		this.callbacks.broadcast({
			type: "PLAYER_RECONNECTED",
			payload: { playerId, playerName, reconnectedAt: Date.now() },
		});

		this.stateManager.appendLog(
			createBattleLogEvent("player_reconnected", {
				playerId,
				playerName,
			})
		);

		return true;
	}

	leavePlayer(playerId: string): boolean {
		if (!this.playerConnections.has(playerId)) return false;

		const playerState = this.stateManager.getPlayer(playerId);
		const playerName = playerState?.nickname ?? playerId;

		this.stateManager.removePlayer(playerId);
		this.playerConnections.delete(playerId);
		this.playerHistory.delete(playerId);

		this.logger.info("Player left", {
			playerId,
			playerName,
			totalPlayers: this.playerConnections.size,
		});

		this.callbacks.broadcast({
			type: "PLAYER_LEFT",
			payload: {
				playerId,
				playerName,
				leftAt: Date.now(),
				totalPlayers: this.playerConnections.size,
			},
		});

		this.stateManager.appendLog(
			createBattleLogEvent("player_left", {
				playerId,
				playerName,
				totalPlayers: this.playerConnections.size,
			})
		);

		if (this.playerConnections.size === 0) {
			this.emptiedAt = Date.now();
		}

		return true;
	}

	disconnectPlayer(playerId: string): boolean {
		if (!this.playerConnections.has(playerId)) return false;

		const playerState = this.stateManager.getPlayer(playerId);
		const playerName = playerState?.nickname ?? playerId;

		this.stateManager.updatePlayerConnection(playerId, false);
		this.playerConnections.delete(playerId);

		this.logger.info("Player disconnected (kept in state)", { playerId, playerName });

		this.callbacks.broadcast({
			type: "PLAYER_DISCONNECTED",
			payload: { playerId, playerName, disconnectedAt: Date.now() },
		});

		this.stateManager.appendLog(
			createBattleLogEvent("player_disconnected", {
				playerId,
				playerName,
			})
		);

		if (this.options.creatorSessionId === playerId && this.playerConnections.size > 0) {
			this.transferHostOnDisconnect();
		}

		if (this.playerConnections.size === 0) {
			this.emptiedAt = Date.now();
		}

		return true;
	}

	private transferHostOnDisconnect(): void {
		const remainingPlayers = Array.from(this.playerConnections.keys());
		if (remainingPlayers.length === 0) return;

		const newHostId = remainingPlayers[0]!;
		const newHostState = this.stateManager.getPlayer(newHostId);

		this.options.creatorSessionId = newHostId;
		this.stateManager.changeHost(newHostId);
		if (newHostState) {
			this.stateManager.updatePlayer(newHostId, { role: "HOST" });
		}

		const newHostName = newHostState?.nickname ?? newHostId;
		this.logger.info("Host transferred due to disconnect", { newHostId, newHostName });

		this.callbacks.broadcast({
			type: "HOST_CHANGED",
			payload: { newHostId, newHostName, previousHostDisconnected: true },
		});

		this.stateManager.appendLog(
			createBattleLogEvent("host_changed", {
				newHostId,
				newHostName,
				previousHostDisconnected: true,
			})
		);
	}

	wasPlayerInRoom(playerId: string): boolean {
		return this.playerHistory.has(playerId);
	}

	getPlayerHistory(): string[] {
		return Array.from(this.playerHistory);
	}

	togglePlayerReady(playerId: string): boolean {
		const state = this.stateManager.getState();
		const player = state.players[playerId];
		if (!player) return false;

		const newReady = !player.isReady;
		this.stateManager.updatePlayer(playerId, { isReady: newReady });

		this.callbacks.broadcast({
			type: "PLAYER_READY_CHANGED",
			payload: { playerId, ready: newReady },
		});

		this.checkAllPlayersReady();
		return true;
	}

	private checkAllPlayersReady(): void {
		const state = this.stateManager.getState();
		const playerList = Object.keys(state.players).map((k) => state.players[k]);
		const allReady = playerList.length > 0 && playerList.every((p) => p?.isReady);

		this.callbacks.broadcast({
			type: "ALL_READY_STATUS",
			payload: {
				allReady,
				playerCount: playerList.length,
				readyCount: playerList.filter((p) => p?.isReady).length,
			},
		});
	}

	startGame(): void {
		this.stateManager.changeTurn(1);
		this.stateManager.setMode(GameMode.COMBAT);
		this.stateManager.resetAllPlayersReady();
		this.logger.info("Game started");

		this.callbacks.broadcast({
			type: "GAME_STARTED",
			payload: { startedAt: Date.now(), turn: 1, activeFaction: Faction.PLAYER_ALLIANCE },
		});
	}

	advancePhase(): void {
		const state = this.stateManager.getState();
		const result = executeTurnAdvance(state);

		// 应用状态更新
		if (result.modeChanged) {
			this.stateManager.setMode(result.newMode);
		} else if (result.turnIncremented || result.factionChanged) {
			this.stateManager.advanceTurn();
		}

		// 应用舰船状态更新
		for (const [tokenId, updates] of result.stateUpdates) {
			this.stateManager.updateTokenRuntime(tokenId, updates);
		}

		// 写入日志
		for (const logEvent of result.logEvents) {
			this.stateManager.appendLog(logEvent);
		}

		// 广播回合变更
		const newState = this.stateManager.getState();
		this.callbacks.broadcast({
			type: "TURN_CHANGED",
			payload: {
				turn: newState.turn?.number ?? 0,
				factionIndex: newState.turn?.factionIndex ?? 0,
				mode: newState.mode,
				changedAt: Date.now(),
			},
		});
	}

	switchActiveFaction(faction: Faction): void {
		this.stateManager.changeFaction(faction);
		this.callbacks.broadcast({
			type: "ACTIVE_FACTION_CHANGED",
			payload: { faction, changedAt: Date.now() },
		});
	}

	getInfo(): any {
		const state = this.stateManager.getState();
		return {
			id: this.id,
			name: this.options.roomName,
			createdAt: this.createdAt,
			phase: state.mode,
			turn: state.turn?.number ?? 0,
			factionIndex: state.turn?.factionIndex ?? 0,
			playerCount: this.playerConnections.size,
			maxPlayers: this.options.maxPlayers,
			mapSize: { width: this.options.mapWidth, height: this.options.mapHeight },
			creator: this.options.creatorSessionId,
		};
	}

	getPlayers(): any[] {
		const state = this.stateManager.getState();
		return Object.keys(state.players).map((k) => {
			const player = state.players[k];
			return {
				id: player?.sessionId,
				name: player?.nickname,
				role: player?.role,
				faction: player?.faction ?? undefined,
				ready: player?.isReady,
				connected: player?.connected,
			};
		});
	}

	getGameState(): GameRoomState {
		return this.stateManager.getState();
	}

	get gameState(): GameRoomState {
		return this.getGameState();
	}

	getPlayerCount(): number {
		return this.playerConnections.size;
	}

	isRoomActive(): boolean {
		return this.isActive;
	}

	get name(): string {
		return this.options.roomName;
	}
	get creatorId(): string {
		return this.options.creatorSessionId;
	}
	set creatorId(value: string) {
		this.options.creatorSessionId = value;
		this.stateManager.changeHost(value);
	}
	get creatorName(): string {
		return this.options.creatorName;
	}
	get maxPlayers(): number {
		return this.options.maxPlayers;
	}
	get mode(): GameModeType {
		return this.stateManager.getState().mode;
	}

	getCombatTokens(): CombatToken[] {
		return Object.values(this.stateManager.getState().tokens);
	}

	getCombatToken(tokenId: string): CombatToken | undefined {
		return this.stateManager.getToken(tokenId);
	}

	updateCombatTokenRuntime(tokenId: string, updates: Partial<TokenRuntime>): void {
		this.stateManager.updateTokenRuntime(tokenId, updates);
	}

	addPlayer(playerState: {
		id: string;
		sessionId: string;
		nickname: string;
		role: "HOST" | "PLAYER";
		isReady: boolean;
		connected: boolean;
		avatar?: string;
	}): boolean {
		this.stateManager.addPlayer(playerState.id, playerState);
		this.playerConnections.set(playerState.id, playerState.sessionId);
		return true;
	}

	removePlayer(playerId: string): boolean {
		return this.leavePlayer(playerId);
	}

	send(playerId: string, message: any): void {
		this.callbacks.sendToPlayer(playerId, message);
	}

	sendError(playerId: string, code: string, message: string, requestId?: string): void {
		this.callbacks.sendToPlayer(playerId, { type: "ERROR", payload: { code, message }, requestId });
	}

	broadcast(message: any): void {
		this.callbacks.broadcast(message);
	}

	handlePlayerMessage(playerId: string, message: any): void {
		if (!this.isActive) return;

		const { type, requestId } = message;

		try {
			switch (type) {
				case "TOGGLE_READY":
					const success = this.togglePlayerReady(playerId);
					this.callbacks.sendToPlayer(playerId, {
						type: success ? "TOGGLE_READY_SUCCESS" : "TOGGLE_READY_FAILED",
						payload: { ready: this.stateManager.getState().players[playerId]?.isReady },
						requestId,
					});
					break;
				case "START_GAME":
					if (this.stateManager.getState().mode !== GameMode.DEPLOYMENT) {
						this.callbacks.sendToPlayer(playerId, {
							type: "ERROR",
							payload: { code: "GAME_ALREADY_STARTED", message: "游戏已开始" },
							requestId,
						});
						return;
					}
					this.startGame();
					this.callbacks.sendToPlayer(playerId, {
						type: "START_GAME_SUCCESS",
						payload: { startedAt: Date.now() },
						requestId,
					});
					break;
				case "NEXT_TURN":
					this.advancePhase();
					this.callbacks.sendToPlayer(playerId, {
						type: "NEXT_TURN_SUCCESS",
						payload: { turn: this.stateManager.getState().turn?.number ?? 0 },
						requestId,
					});
					break;
				default:
					this.callbacks.sendToPlayer(playerId, {
						type: "ERROR",
						payload: { code: "UNKNOWN_COMMAND", message: "未知命令" },
						requestId,
					});
			}
		} catch (error) {
			this.logger.error("Error handling player message", error, { playerId, messageType: type });
			this.callbacks.sendToPlayer(playerId, {
				type: "ERROR",
				payload: { code: "COMMAND_ERROR", message: "命令处理失败" },
				requestId,
			});
		}
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
	}
}
