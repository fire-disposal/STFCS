import type { Point, TokenInfo, TurnPhase } from "@vt/shared/types";
import type { PlayerService } from "../player/PlayerService";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

export interface RoomTurnState {
	roomId: string;
	phase: TurnPhase;
	round: number;
	order: string[];
	currentIndex: number;
}

export interface DeploymentValidationResult {
	ok: boolean;
	reason?: string;
}

/**
 * 房间回合协同器（MAP P1/P3 最小闭环）
 * - 服务端权威维护阶段与当前行动者
 * - 部署阶段约束 Token 出生区域
 * - 移动阶段约束当前行动者与机动预算
 */
export class RoomTurnCoordinator {
	private readonly _states = new Map<string, RoomTurnState>();
	private readonly _playerService: PlayerService;
	private readonly _roomManager: RoomManager;

	constructor(playerService: PlayerService, roomManager: RoomManager) {
		this._playerService = playerService;
		this._roomManager = roomManager;
	}

	initialize(roomId: string): RoomTurnState {
		const room = this._roomManager.getRoom(roomId) ?? this._roomManager.createRoom(roomId);
		const order = Array.from(room.players.keys());
		const state: RoomTurnState = {
			roomId,
			phase: "deployment",
			round: 1,
			order,
			currentIndex: 0,
		};
		this._states.set(roomId, state);
		this._resetTokensForRound(roomId);
		return state;
	}

	getState(roomId: string): RoomTurnState {
		const existing = this._states.get(roomId);
		if (existing) {
			return existing;
		}
		return this.initialize(roomId);
	}

	setPhase(roomId: string, phase: TurnPhase): RoomTurnState {
		const state = this.getState(roomId);
		state.phase = phase;
		if (phase === "deployment") {
			state.round = 1;
			state.currentIndex = 0;
		}
		return state;
	}

	advanceTurn(roomId: string): RoomTurnState {
		const state = this.getState(roomId);
		if (state.order.length === 0) {
			return state;
		}
		state.currentIndex = (state.currentIndex + 1) % state.order.length;
		if (state.currentIndex === 0) {
			state.round += 1;
			this._resetTokensForRound(roomId);
		}
		return state;
	}

	canControlCurrentTurn(roomId: string, playerId: string): boolean {
		const state = this.getState(roomId);
		const player = this._playerService.getPlayer(playerId);
		if (player?.isDMMode) return true;
		const currentActor = state.order[state.currentIndex];
		return Boolean(currentActor && currentActor === playerId);
	}

	validateDeployment(roomId: string, ownerId: string, position: Point): DeploymentValidationResult {
		const state = this.getState(roomId);
		if (state.phase !== "deployment") {
			return { ok: false, reason: "Deployment is only allowed in deployment phase" };
		}

		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const ownerIndex = this._resolveOwnerIndex(roomId, ownerId);
		if (ownerIndex < 0) {
			return { ok: false, reason: "Owner is not in room turn order" };
		}

		const half = snapshot.map.height * 0.2;
		const startY = ownerIndex % 2 === 0 ? 0 : snapshot.map.height - half;
		const endY = startY + half;
		const withinY = position.y >= startY && position.y <= endY;
		const withinX = position.x >= 0 && position.x <= snapshot.map.width;

		if (!withinX || !withinY) {
			return {
				ok: false,
				reason: `Deployment position must be inside owner zone (x:0-${snapshot.map.width}, y:${startY}-${endY})`,
			};
		}

		return { ok: true };
	}

	validateMovement(
		roomId: string,
		playerId: string,
		token: TokenInfo | undefined,
		distance: number
	): DeploymentValidationResult {
		const state = this.getState(roomId);
		if (state.phase !== "movement") {
			return { ok: false, reason: "Token movement is only allowed in movement phase" };
		}

		if (!token) {
			return { ok: true };
		}

		if (!this.canControlCurrentTurn(roomId, playerId)) {
			return { ok: false, reason: "Only current turn actor (or DM) can move tokens" };
		}

		const player = this._playerService.getPlayer(playerId);
		const isDM = Boolean(player?.isDMMode);
		if (!isDM && token.ownerId !== playerId) {
			return { ok: false, reason: "You can only move your own token during movement phase" };
		}

		const budget = token.remainingMovement;
		if (distance > budget) {
			return { ok: false, reason: `Movement budget exceeded: ${distance.toFixed(1)} > ${budget.toFixed(1)}` };
		}

		return { ok: true };
	}

	consumeMovementBudget(roomId: string, tokenId: string, consumedDistance: number): TokenInfo | null {
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const token = snapshot.tokens.find((item) => item.id === tokenId);
		if (!token) return null;
		token.remainingMovement = Math.max(0, token.remainingMovement - consumedDistance);
		token.turnState = token.remainingMovement > 0 ? "moved" : "ended";
		return token;
	}

	private _resolveOwnerIndex(roomId: string, ownerId: string): number {
		const state = this.getState(roomId);
		const inOrder = state.order.indexOf(ownerId);
		if (inOrder >= 0) {
			return inOrder;
		}
		const room = this._roomManager.getRoom(roomId);
		if (!room) return -1;
		return Array.from(room.players.keys()).indexOf(ownerId);
	}

	private _resetTokensForRound(roomId: string): void {
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		for (const token of snapshot.tokens) {
			token.remainingMovement = token.maxMovement;
			token.remainingActions = token.actionsPerTurn;
			token.turnState = "waiting";
		}
	}
}

