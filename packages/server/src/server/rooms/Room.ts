/**
 * 游戏房间（使用 MutativeStateManager）
 */

import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../infra/simple-logger.js";
import { MutativeStateManager } from "../../core/state/MutativeStateManager.js";
import type { Server as IOServer } from "socket.io";
import type { GameRoomState, CombatToken, Faction, GamePhase, TokenRuntime } from "@vt/data";
import { processTokenTurnEnd } from "../../core/engine/rules/turnEnd.js";

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
	broadcastToFaction: (faction: string, message: any) => void;
	broadcastExcept: (excludePlayerId: string, message: any) => void;
	broadcastToSpectators: (message: any) => void;
	broadcastToPlayers: (message: any) => void;
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
			creatorName: "未知",
			...options,
		};

		this.logger = createLogger(`room-${this.id}`);

		this.stateManager = new MutativeStateManager(this.id, {
			roomId: this.id,
			ownerId: this.options.creatorSessionId,
			phase: "DEPLOYMENT",
			turnCount: 0,
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

	joinPlayer(connectionId: string, playerId: string, playerName: string): boolean {
		if (!this.isActive) return false;
		if (this.playerConnections.size >= this.options.maxPlayers) return false;
		if (this.playerConnections.has(playerId)) return false;

		this.emptiedAt = null;

		this.stateManager.addPlayer(playerId, {
			sessionId: connectionId,
			nickname: playerName,
			role: this.options.creatorSessionId === playerId ? "HOST" : "PLAYER",
			isReady: false,
			connected: true,
		});

		this.playerConnections.set(playerId, connectionId);

		this.logger.info("Player joined", { playerId, playerName, totalPlayers: this.playerConnections.size });

		this.callbacks.broadcast({
			type: "PLAYER_JOINED",
			payload: { playerId, playerName, joinedAt: Date.now(), totalPlayers: this.playerConnections.size },
		});

		return true;
	}

	leavePlayer(playerId: string): boolean {
		if (!this.playerConnections.has(playerId)) return false;

		this.stateManager.removePlayer(playerId);
		this.playerConnections.delete(playerId);

		this.logger.info("Player left", { playerId, totalPlayers: this.playerConnections.size });

		this.callbacks.broadcast({
			type: "PLAYER_LEFT",
			payload: { playerId, leftAt: Date.now(), totalPlayers: this.playerConnections.size },
		});

		if (this.playerConnections.size === 0) {
			this.emptiedAt = Date.now();
		}

		return true;
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
		const playerList = Object.keys(state.players).map(k => state.players[k]);
		const allReady = playerList.length > 0 && playerList.every(p => p?.isReady);

		this.callbacks.broadcast({
			type: "ALL_READY_STATUS",
			payload: { allReady, playerCount: playerList.length, readyCount: playerList.filter(p => p?.isReady).length },
		});
	}

	startGame(): void {
		this.stateManager.changeTurn(1);
		this.stateManager.changePhase("PLAYER_ACTION");
		this.logger.info("Game started");

		this.callbacks.broadcast({
			type: "GAME_STARTED",
			payload: { startedAt: Date.now(), turn: 1, activeFaction: "PLAYER" },
		});
	}

	advancePhase(): void {
		const currentPhase = this.stateManager.getState().phase;
		
		let nextPhase: typeof currentPhase;
		let incrementTurn = false;
		
		switch (currentPhase) {
			case "PLAYER_ACTION":
				nextPhase = "DM_ACTION";
				break;
			case "DM_ACTION":
				nextPhase = "PLAYER_ACTION";
				incrementTurn = true;
				break;
			case "TURN_END":
				nextPhase = "PLAYER_ACTION";
				incrementTurn = true;
				break;
			default:
				nextPhase = "PLAYER_ACTION";
		}
		
		this.stateManager.changePhase(nextPhase);
		
		if (incrementTurn) {
			this.processTurnEndLogic();
			const newTurn = this.stateManager.getState().turnCount + 1;
			this.stateManager.changeTurn(newTurn);
		}

		const newState = this.stateManager.getState();
		this.callbacks.broadcast({
			type: "TURN_CHANGED",
			payload: { turn: newState.turnCount, activeFaction: newState.activeFaction, phase: newState.phase, changedAt: Date.now() },
		});
	}

	nextTurn(): void {
		const currentPhase = this.stateManager.getState().phase;
		
		if (currentPhase !== "TURN_END") {
			this.stateManager.changePhase("TURN_END");
		}
		
		this.processTurnEndLogic();
		
		const newTurn = this.stateManager.getState().turnCount + 1;
		this.stateManager.changeTurn(newTurn);
		this.stateManager.changePhase("PLAYER_ACTION");
		
		const newState = this.stateManager.getState();
		this.callbacks.broadcast({
			type: "TURN_CHANGED",
			payload: { turn: newState.turnCount, activeFaction: newState.activeFaction, phase: newState.phase, changedAt: Date.now() },
		});
	}

	processTurnEndLogic(): void {
		const state = this.stateManager.getState();

		for (const tokenId of Object.keys(state.tokens)) {
			const token = state.tokens[tokenId];
			if (!token) continue;
			if (token.runtime && !token.runtime.destroyed) {
				const result = processTokenTurnEnd(token);

				const updates: Partial<TokenRuntime> = {
					fluxSoft: result.newFluxSoft,
					fluxHard: result.newFluxHard,
					venting: false,
					movement: {
						currentPhase: "A",
						hasMoved: false,
						phaseAUsed: 0,
						turnAngleUsed: 0,
						phaseCUsed: 0,
					},
					hasFired: false,
				};

				if (result.overloadEnded) {
					updates.overloaded = false;
					updates.overloadTime = 0;
				}

				if (result.weaponsUpdated && token.runtime.weapons) {
					updates.weapons = token.runtime.weapons;
				}

				this.stateManager.updateTokenRuntime(token.$id, updates);
			}
		}
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
			phase: state.phase,
			turn: state.turnCount,
			activeFaction: state.activeFaction,
			playerCount: this.playerConnections.size,
			maxPlayers: this.options.maxPlayers,
			mapSize: { width: this.options.mapWidth, height: this.options.mapHeight },
			creator: this.options.creatorSessionId,
		};
	}

	getPlayers(): any[] {
		const state = this.stateManager.getState();
		return Object.keys(state.players).map(k => {
			const player = state.players[k];
			return {
				id: player?.sessionId,
				name: player?.nickname,
				role: player?.role,
				faction: "PLAYER",
				ready: player?.isReady,
				connected: player?.connected,
			};
		});
	}

	getGameState(): GameRoomState {
		return this.stateManager.getState();
	}

	get gameState(): GameRoomState { return this.getGameState(); }

	getPlayerCount(): number {
		return this.playerConnections.size;
	}

	isRoomActive(): boolean {
		return this.isActive;
	}

	get name(): string { return this.options.roomName; }
	get creatorId(): string { return this.options.creatorSessionId; }
	set creatorId(value: string) {
		this.options.creatorSessionId = value;
		this.stateManager.changeHost(value);
	}
	get creatorName(): string { return this.options.creatorName; }
	get maxPlayers(): number { return this.options.maxPlayers; }
	get phase(): GamePhase { return this.stateManager.getState().phase; }

	getCombatTokens(): CombatToken[] {
		return Object.values(this.stateManager.getState().tokens);
	}

	getCombatToken(tokenId: string): CombatToken | undefined {
		return this.stateManager.getToken(tokenId);
	}

	updateCombatTokenRuntime(tokenId: string, updates: Partial<TokenRuntime>): void {
		this.stateManager.updateTokenRuntime(tokenId, updates);
	}

	addPlayer(playerState: { id: string; sessionId: string; nickname: string; role: "HOST" | "PLAYER"; isReady: boolean; connected: boolean }): boolean {
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
					if (this.stateManager.getState().phase !== "DEPLOYMENT") {
						this.callbacks.sendToPlayer(playerId, { type: "ERROR", payload: { code: "GAME_ALREADY_STARTED", message: "游戏已开始" }, requestId });
						return;
					}
					this.startGame();
					this.callbacks.sendToPlayer(playerId, { type: "START_GAME_SUCCESS", payload: { startedAt: Date.now() }, requestId });
					break;
				case "NEXT_TURN":
					this.nextTurn();
					this.callbacks.sendToPlayer(playerId, { type: "NEXT_TURN_SUCCESS", payload: { turn: this.stateManager.getState().turnCount }, requestId });
					break;
				default:
					this.callbacks.sendToPlayer(playerId, { type: "ERROR", payload: { code: "UNKNOWN_COMMAND", message: "未知命令" }, requestId });
			}
		} catch (error) {
			this.logger.error("Error handling player message", error, { playerId, messageType: type });
			this.callbacks.sendToPlayer(playerId, { type: "ERROR", payload: { code: "COMMAND_ERROR", message: "命令处理失败" }, requestId });
		}
	}

	cleanup(): void {
		if (!this.isActive) return;
		this.isActive = false;
		this.logger.info("Room cleaning up");
		this.callbacks.broadcast({ type: "ROOM_CLOSED", payload: { reason: "empty", closedAt: Date.now() } });
		this.playerConnections.clear();
	}
}