import type { FactionId, FactionTurnState, PlayerFactionInfo, TurnHistoryEntry } from "@vt/shared/types";
import { FACTION_TURN_DEBOUNCE_MS } from "@vt/shared/constants";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";
import type { FactionService } from "../faction/FactionService";
import type { GameFlowService } from "../game/GameFlowService";

/**
 * 阵营回合服务 - 管理阵营回合逻辑
 *
 * 功能：
 * - 初始化回合系统
 * - 随机决定阵营行动顺序
 * - 玩家宣告结束/取消结束
 * - 防抖机制（所有玩家结束后 1 秒进入下一阵营）
 * - 阵营切换
 */
export interface IFactionTurnService {
	// 初始化回合系统
	initializeTurnSystem(roomId: string, factions: FactionId[], players: PlayerFactionInfo[]): void;
	// 获取回合状态
	getTurnState(roomId: string): FactionTurnState | undefined;
	// 玩家宣告结束
	playerEndTurn(roomId: string, playerId: string): { success: boolean; allEnded: boolean; playerInfo?: PlayerFactionInfo };
	// 玩家取消结束
	playerCancelEndTurn(roomId: string, playerId: string): { success: boolean; playerInfo?: PlayerFactionInfo };
	// 强制进入下一阵营（用于防抖后）
	advanceToNextFaction(roomId: string): void;
	// 开始新回合
	startNewRound(roomId: string): void;
	// 清理房间回合数据
	clearRoomTurnData(roomId: string): void;
	// 检查房间是否已初始化回合系统
	isTurnSystemInitialized(roomId: string): boolean;
}

export class FactionTurnService implements IFactionTurnService {
	private _turnStates: Map<string, FactionTurnState>;
	private _debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
	private _factionService: FactionService;
	private _wsServer?: IWSServer;
	private _roomManager?: RoomManager;
	private _gameFlowService?: GameFlowService;

	constructor(factionService: FactionService) {
		this._turnStates = new Map();
		this._debounceTimers = new Map();
		this._factionService = factionService;
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	setGameFlowService(gameFlowService: GameFlowService): void {
		this._gameFlowService = gameFlowService;
	}

	/**
	 * 初始化回合系统
	 */
	initializeTurnSystem(roomId: string, factions: FactionId[], players: PlayerFactionInfo[]): void {
		if (!roomId || factions.length === 0) {
			return;
		}

		// 清理现有状态
		this.clearRoomTurnData(roomId);

		// 随机决定阵营行动顺序
		const factionOrder = this._determineFactionOrder(factions);

		// 初始化玩家结束状态
		const playerEndStatus: Record<FactionId, PlayerFactionInfo[]> = {} as Record<FactionId, PlayerFactionInfo[]>;
		for (const faction of factions) {
			playerEndStatus[faction] = players
				.filter(p => p.faction === faction)
				.map(p => ({
					...p,
					hasEndedTurn: false,
					endedAt: undefined,
				}));
		}

		// 创建初始状态
		const initialState: FactionTurnState = {
			roundNumber: 1,
			currentFaction: factionOrder[0],
			factionOrder,
			currentFactionIndex: 0,
			phase: "action",
			playerEndStatus,
			debounceStartTime: undefined,
			history: [],
		};

		this._turnStates.set(roomId, initialState);

		// 广播阵营顺序确定消息
		this._broadcastFactionOrderDetermined(roomId, initialState.roundNumber, factionOrder);

		// 广播回合开始消息
		this._broadcastRoundStart(roomId, initialState.roundNumber, factionOrder);

		// 广播当前阵营回合开始
		this._broadcastFactionTurnStart(roomId, initialState);
	}

	/**
	 * 获取回合状态
	 */
	getTurnState(roomId: string): FactionTurnState | undefined {
		return this._turnStates.get(roomId);
	}

	/**
	 * 玩家宣告结束
	 */
	playerEndTurn(roomId: string, playerId: string): { success: boolean; allEnded: boolean; playerInfo?: PlayerFactionInfo } {
		const state = this._turnStates.get(roomId);
		if (!state) {
			return { success: false, allEnded: false };
		}

		// 获取玩家阵营信息
		const playerInfo = this._factionService.getPlayerFactionInfo(roomId, playerId);
		if (!playerInfo) {
			return { success: false, allEnded: false };
		}

		// 检查玩家是否属于当前阵营
		if (playerInfo.faction !== state.currentFaction) {
			return { success: false, allEnded: false };
		}

		// 检查玩家是否已经结束
		if (playerInfo.hasEndedTurn) {
			return { success: true, allEnded: false, playerInfo };
		}

		// 更新玩家结束状态
		const updatedInfo = this._factionService.updatePlayerEndStatus(roomId, playerId, true);
		if (!updatedInfo) {
			return { success: false, allEnded: false };
		}

		// 更新状态中的玩家结束状态
		const factionPlayers = state.playerEndStatus[state.currentFaction];
		const playerInState = factionPlayers?.find(p => p.playerId === playerId);
		if (playerInState) {
			playerInState.hasEndedTurn = true;
			playerInState.endedAt = Date.now();
		}

		// 广播玩家结束消息
		this._broadcastPlayerEndTurn(roomId, updatedInfo);

		// 检查当前阵营是否所有玩家都已结束
		const allEnded = this._checkAllPlayersEnded(roomId, state.currentFaction);

		if (allEnded) {
			// 启动防抖计时器
			this._startDebounceTimer(roomId);
		}

		return { success: true, allEnded, playerInfo: updatedInfo };
	}

	/**
	 * 玩家取消结束
	 */
	playerCancelEndTurn(roomId: string, playerId: string): { success: boolean; playerInfo?: PlayerFactionInfo } {
		const state = this._turnStates.get(roomId);
		if (!state) {
			return { success: false };
		}

		// 获取玩家阵营信息
		const playerInfo = this._factionService.getPlayerFactionInfo(roomId, playerId);
		if (!playerInfo) {
			return { success: false };
		}

		// 检查玩家是否属于当前阵营
		if (playerInfo.faction !== state.currentFaction) {
			return { success: false };
		}

		// 检查玩家是否已经结束
		if (!playerInfo.hasEndedTurn) {
			return { success: true, playerInfo };
		}

		// 清除防抖计时器
		this._clearDebounceTimer(roomId);

		// 更新玩家结束状态
		const updatedInfo = this._factionService.updatePlayerEndStatus(roomId, playerId, false);
		if (!updatedInfo) {
			return { success: false };
		}

		// 更新状态中的玩家结束状态
		const factionPlayers = state.playerEndStatus[state.currentFaction];
		const playerInState = factionPlayers?.find(p => p.playerId === playerId);
		if (playerInState) {
			playerInState.hasEndedTurn = false;
			playerInState.endedAt = undefined;
		}

		// 清除防抖开始时间
		state.debounceStartTime = undefined;

		// 广播玩家取消结束消息
		this._broadcastPlayerCancelEndTurn(roomId, updatedInfo);

		return { success: true, playerInfo: updatedInfo };
	}

	/**
	 * 强制进入下一阵营
	 */
	advanceToNextFaction(roomId: string): void {
		const state = this._turnStates.get(roomId);
		if (!state) {
			return;
		}

		// 清除防抖计时器
		this._clearDebounceTimer(roomId);

		// 记录历史
		const historyEntry: TurnHistoryEntry = {
			roundNumber: state.roundNumber,
			faction: state.currentFaction,
			startedAt: state.history.length > 0 
				? state.history[state.history.length - 1].endedAt ?? Date.now() 
				: Date.now(),
			endedAt: Date.now(),
			endedPlayers: state.playerEndStatus[state.currentFaction]
				?.filter(p => p.hasEndedTurn)
				.map(p => p.playerId) ?? [],
		};
		state.history.push(historyEntry);

		// 广播阵营回合结束
		this._broadcastFactionTurnEnd(roomId, state.currentFaction, state.roundNumber, historyEntry.endedPlayers);

		// 计算下一个阵营索引
		const nextIndex = state.currentFactionIndex + 1;

		if (nextIndex >= state.factionOrder.length) {
			// 所有阵营都已行动，开始新回合
			this.startNewRound(roomId);
		} else {
			// 进入下一个阵营
			state.currentFactionIndex = nextIndex;
			state.currentFaction = state.factionOrder[nextIndex];
			state.phase = "action";
			state.debounceStartTime = undefined;

			// 重置新阵营玩家的结束状态
			this._resetFactionPlayersEndStatus(roomId, state.currentFaction);

			// 广播新阵营回合开始
			this._broadcastFactionTurnStart(roomId, state);
		}
	}

	/**
	 * 开始新回合
	 */
	startNewRound(roomId: string): void {
		const state = this._turnStates.get(roomId);
		if (!state) {
			return;
		}

		// 清除防抖计时器
		this._clearDebounceTimer(roomId);

		// 触发回合结算（通过GameFlowService）
		// 结算内容包括：辐能下降、过载结束、主动排散结束等
		if (this._gameFlowService) {
			const resolution = this._gameFlowService.resolveTurn(roomId);
			// 广播回合结算结果
			this._broadcastTurnResolution(roomId, resolution);
		}

		// 增加回合数
		state.roundNumber += 1;
		state.currentFactionIndex = 0;
		state.currentFaction = state.factionOrder[0];
		state.phase = "action";
		state.debounceStartTime = undefined;

		// 重新随机决定阵营顺序
		state.factionOrder = this._determineFactionOrder(state.factionOrder);

		// 重置所有玩家的结束状态
		this._factionService.resetAllPlayersEndStatus(roomId);

		// 重置状态中的玩家结束状态
		for (const faction of state.factionOrder) {
			this._resetFactionPlayersEndStatus(roomId, faction);
		}

		// 广播阵营顺序确定消息
		this._broadcastFactionOrderDetermined(roomId, state.roundNumber, state.factionOrder);

		// 广播回合开始消息
		this._broadcastRoundStart(roomId, state.roundNumber, state.factionOrder);

		// 广播当前阵营回合开始
		this._broadcastFactionTurnStart(roomId, state);
	}

	/**
	 * 清理房间回合数据
	 */
	clearRoomTurnData(roomId: string): void {
		this._clearDebounceTimer(roomId);
		this._turnStates.delete(roomId);
	}

	/**
	 * 检查房间是否已初始化回合系统
	 */
	isTurnSystemInitialized(roomId: string): boolean {
		return this._turnStates.has(roomId);
	}

	// ====== 私有方法 ======

	/**
	 * 随机决定阵营行动顺序
	 */
	private _determineFactionOrder(factions: FactionId[]): FactionId[] {
		return [...factions].sort(() => Math.random() - 0.5);
	}

	/**
	 * 检查阵营内所有玩家是否都已结束
	 */
	private _checkAllPlayersEnded(roomId: string, faction: FactionId): boolean {
		const state = this._turnStates.get(roomId);
		if (!state) return false;

		const players = state.playerEndStatus[faction];
		if (!players || players.length === 0) return false;

		return players.every(p => p.hasEndedTurn);
	}

	/**
	 * 启动防抖计时器
	 */
	private _startDebounceTimer(roomId: string): void {
		// 清除现有计时器
		this._clearDebounceTimer(roomId);

		const state = this._turnStates.get(roomId);
		if (state) {
			state.debounceStartTime = Date.now();
		}

		const timer = setTimeout(() => {
			this.advanceToNextFaction(roomId);
		}, FACTION_TURN_DEBOUNCE_MS);

		this._debounceTimers.set(roomId, timer);
	}

	/**
	 * 清除防抖计时器
	 */
	private _clearDebounceTimer(roomId: string): void {
		const timer = this._debounceTimers.get(roomId);
		if (timer) {
			clearTimeout(timer);
			this._debounceTimers.delete(roomId);
		}
	}

	/**
	 * 重置阵营玩家的结束状态
	 */
	private _resetFactionPlayersEndStatus(roomId: string, faction: FactionId): void {
		const state = this._turnStates.get(roomId);
		if (!state) return;

		const players = state.playerEndStatus[faction];
		if (players) {
			for (const player of players) {
				player.hasEndedTurn = false;
				player.endedAt = undefined;
			}
		}
	}

	// ====== 广播方法 ======

	/**
	 * 广播阵营顺序确定消息
	 */
	private _broadcastFactionOrderDetermined(roomId: string, roundNumber: number, factionOrder: FactionId[]): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.FACTION_ORDER_DETERMINED,
			payload: {
				roundNumber,
				factionOrder,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播回合开始消息
	 */
	private _broadcastRoundStart(roomId: string, roundNumber: number, factionOrder: FactionId[]): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.ROUND_START,
			payload: {
				roundNumber,
				factionOrder,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播阵营回合开始消息
	 */
	private _broadcastFactionTurnStart(roomId: string, state: FactionTurnState): void {
		if (!this._roomManager) return;

		// 获取当前阵营的玩家结束状态
		const currentPlayerStatus = state.playerEndStatus[state.currentFaction] ?? [];

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.FACTION_TURN_START,
			payload: {
				faction: state.currentFaction,
				roundNumber: state.roundNumber,
				playerEndStatus: currentPlayerStatus,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播阵营回合结束消息
	 */
	private _broadcastFactionTurnEnd(roomId: string, faction: FactionId, roundNumber: number, endedPlayers: string[]): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.FACTION_TURN_END,
			payload: {
				faction,
				roundNumber,
				endedPlayers,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播玩家结束回合消息
	 */
	private _broadcastPlayerEndTurn(roomId: string, playerInfo: PlayerFactionInfo): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.PLAYER_END_TURN,
			payload: {
				playerId: playerInfo.playerId,
				playerName: playerInfo.playerName,
				faction: playerInfo.faction,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播玩家取消结束回合消息
	 */
	private _broadcastPlayerCancelEndTurn(roomId: string, playerInfo: PlayerFactionInfo): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.PLAYER_CANCEL_END_TURN,
			payload: {
				playerId: playerInfo.playerId,
				playerName: playerInfo.playerName,
				faction: playerInfo.faction,
				timestamp: Date.now(),
			},
		});
	}

	/**
	 * 广播回合结算消息
	 */
	private _broadcastTurnResolution(roomId: string, resolution: {
		roundNumber: number;
		fluxDissipation: Array<{ shipId: string; previousFlux: number; newFlux: number }>;
		overloadResets: string[];
		ventCompletions: string[];
	}): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TURN_RESOLUTION,
			payload: {
				...resolution,
				timestamp: Date.now(),
			},
		});
	}
}

export default FactionTurnService;