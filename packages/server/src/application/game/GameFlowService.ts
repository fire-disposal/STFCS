/**
 * 游戏流程服务
 *
 * 管理游戏阶段状态机和阶段转换：
 * - 大厅等待 -> 部署阶段 -> 游戏进行中 -> 游戏结束
 * - 部署阶段管理
 * - 回合结算处理
 */

import type { FactionId } from '@vt/shared';
import type {
	GamePhase,
	TurnPhase,
	GameFlowState,
	ShipActionState,
} from '@vt/shared/protocol';
import {
	GamePhaseSchema,
	TurnPhaseSchema,
	GameFlowStateSchema,
	ShipActionStateSchema,
	isValidPhaseTransition,
	getNextTurnPhase,
} from '@vt/shared/protocol';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { IWSServer } from '@vt/shared/ws';
import type { RoomManager } from '../../infrastructure/ws/RoomManager';
import type { FactionTurnService } from '../turn/FactionTurnService';
import type { ShipService } from '../ship/ShipService';

/**
 * 回合结算结果
 */
export interface TurnResolutionResult {
	roundNumber: number;
	fluxDissipation: Array<{
		shipId: string;
		previousFlux: number;
		newFlux: number;
	}>;
	overloadResets: string[];
	ventCompletions: string[];
}

/**
 * 部署信息
 */
export interface DeploymentInfo {
	faction: FactionId;
	playerId: string;
	tokenIds: string[];
	ready: boolean;
}

/**
 * 游戏流程服务接口
 */
export interface IGameFlowService {
	// 游戏阶段管理
	getGameState(roomId: string): GameFlowState | undefined;
	startDeployment(roomId: string, factions: FactionId[]): void;
	completeDeployment(roomId: string): void;
	startGame(roomId: string): void;
	pauseGame(roomId: string): void;
	resumeGame(roomId: string): void;
	endGame(roomId: string, winner?: FactionId): void;

	// 部署阶段
	setDeploymentReady(roomId: string, faction: FactionId, playerId: string, ready: boolean): void;
	isDeploymentComplete(roomId: string): boolean;

	// 回合阶段管理
	getTurnPhase(roomId: string): TurnPhase | undefined;
	advanceTurnPhase(roomId: string): void;

	// 回合结算
	resolveTurn(roomId: string): TurnResolutionResult;

	// 清理
	clearRoomGameState(roomId: string): void;
}

export class GameFlowService implements IGameFlowService {
	private _gameStates: Map<string, GameFlowState>;
	private _deploymentInfo: Map<string, Map<string, DeploymentInfo>>;
	private _shipActionStates: Map<string, Map<string, ShipActionState>>;
	private _wsServer?: IWSServer;
	private _roomManager?: RoomManager;
	private _factionTurnService?: FactionTurnService;
	private _shipService?: ShipService;

	constructor() {
		this._gameStates = new Map();
		this._deploymentInfo = new Map();
		this._shipActionStates = new Map();
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	setFactionTurnService(factionTurnService: FactionTurnService): void {
		this._factionTurnService = factionTurnService;
	}

	setShipService(shipService: ShipService): void {
		this._shipService = shipService;
	}

	// ====== 游戏阶段管理 ======

	/**
	 * 获取游戏状态
	 */
	getGameState(roomId: string): GameFlowState | undefined {
		return this._gameStates.get(roomId);
	}

	/**
	 * 开始部署阶段
	 */
	startDeployment(roomId: string, factions: FactionId[]): void {
		const currentState = this._gameStates.get(roomId);

		// 验证阶段转换
		if (currentState && !isValidPhaseTransition(currentState.phase, 'deployment')) {
			throw new Error(`Cannot start deployment from phase: ${currentState.phase}`);
		}

		// 初始化部署信息
		const deploymentMap = new Map<string, DeploymentInfo>();
		for (const faction of factions) {
			// 初始化每个阵营的部署状态
			deploymentMap.set(faction, {
				faction,
				playerId: '',
				tokenIds: [],
				ready: false,
			});
		}
		this._deploymentInfo.set(roomId, deploymentMap);

		// 初始化游戏状态
		const newState: GameFlowState = {
			phase: 'deployment',
			turnPhase: 'player_action',
			roundNumber: 0,
			deploymentReady: Object.fromEntries(factions.map(f => [f, false])),
			startedAt: Date.now(),
		};

		this._gameStates.set(roomId, newState);

		// 广播部署开始消息
		this._broadcastDeploymentStart(roomId, factions);
	}

	/**
	 * 完成部署阶段
	 */
	completeDeployment(roomId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'deployment') {
			throw new Error('Not in deployment phase');
		}

		// 检查所有阵营是否都已准备
		if (!this.isDeploymentComplete(roomId)) {
			throw new Error('Not all factions are ready for deployment');
		}

		// 广播部署完成消息
		this._broadcastDeploymentComplete(roomId);
	}

	/**
	 * 开始游戏
	 */
	startGame(roomId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || !isValidPhaseTransition(state.phase, 'playing')) {
			throw new Error(`Cannot start game from phase: ${state?.phase}`);
		}

		// 更新游戏状态
		state.phase = 'playing';
		state.turnPhase = 'player_action';
		state.roundNumber = 1;

		// 初始化舰船行动状态
		this._initializeShipActionStates(roomId);

		// 广播游戏阶段变更
		this._broadcastGamePhaseChanged(roomId, 'deployment', 'playing');

		// 初始化阵营回合系统
		if (this._factionTurnService && this._roomManager) {
			const room = this._roomManager.getRoom(roomId);
			if (room) {
				const factions = Object.keys(state.deploymentReady) as FactionId[];
				const players = Array.from(room.players.values()).map(p => ({
					playerId: p.id,
					playerName: p.name,
					faction: 'federation' as FactionId, // TODO: 从玩家数据获取阵营
					hasEndedTurn: false,
				}));
				this._factionTurnService.initializeTurnSystem(roomId, factions, players);
			}
		}
	}

	/**
	 * 暂停游戏
	 */
	pauseGame(roomId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'playing') {
			throw new Error('Game is not in playing phase');
		}

		state.phase = 'paused';
		state.pausedAt = Date.now();

		this._broadcastGamePhaseChanged(roomId, 'playing', 'paused');
	}

	/**
	 * 恢复游戏
	 */
	resumeGame(roomId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'paused') {
			throw new Error('Game is not paused');
		}

		state.phase = 'playing';
		state.pausedAt = undefined;

		this._broadcastGamePhaseChanged(roomId, 'paused', 'playing');
	}

	/**
	 * 结束游戏
	 */
	endGame(roomId: string, winner?: FactionId): void {
		const state = this._gameStates.get(roomId);
		if (!state) {
			return;
		}

		state.phase = 'ended';
		state.endedAt = Date.now();
		state.winner = winner;

		this._broadcastGamePhaseChanged(roomId, state.phase, 'ended');
	}

	// ====== 部署阶段 ======

	/**
	 * 设置部署准备状态
	 */
	setDeploymentReady(roomId: string, faction: FactionId, playerId: string, ready: boolean): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'deployment') {
			throw new Error('Not in deployment phase');
		}

		// 更新部署准备状态
		state.deploymentReady[faction] = ready;

		// 更新部署信息
		const deploymentMap = this._deploymentInfo.get(roomId);
		if (deploymentMap) {
			const info = deploymentMap.get(faction);
			if (info) {
				info.playerId = playerId;
				info.ready = ready;
			}
		}

		// 广播部署准备状态
		this._broadcastDeploymentReady(roomId, faction, playerId, ready);
	}

	/**
	 * 检查部署是否完成
	 */
	isDeploymentComplete(roomId: string): boolean {
		const state = this._gameStates.get(roomId);
		if (!state) return false;

		// 检查所有阵营是否都已准备
		const allReady = Object.values(state.deploymentReady).every(ready => ready);
		if (!allReady) return false;

		// 检查每个阵营是否都放置了至少一个Token
		const deploymentMap = this._deploymentInfo.get(roomId);
		if (!deploymentMap) return false;

		for (const [faction, info] of deploymentMap) {
			if (!info.tokenIds || info.tokenIds.length === 0) {
				return false;
			}
		}

		return true;
	}

	/**
	 * 记录部署的Token
	 */
	registerDeployedToken(roomId: string, faction: FactionId, tokenId: string, playerId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'deployment') {
			throw new Error('Not in deployment phase');
		}

		const deploymentMap = this._deploymentInfo.get(roomId);
		if (!deploymentMap) return;

		const info = deploymentMap.get(faction);
		if (info) {
			if (!info.tokenIds) {
				info.tokenIds = [];
			}
			if (!info.tokenIds.includes(tokenId)) {
				info.tokenIds.push(tokenId);
			}
			info.playerId = playerId;
		}
	}

	/**
	 * 移除部署的Token
	 */
	unregisterDeployedToken(roomId: string, faction: FactionId, tokenId: string): void {
		const deploymentMap = this._deploymentInfo.get(roomId);
		if (!deploymentMap) return;

		const info = deploymentMap.get(faction);
		if (info && info.tokenIds) {
			const index = info.tokenIds.indexOf(tokenId);
			if (index !== -1) {
				info.tokenIds.splice(index, 1);
			}
		}
	}

	// ====== 回合阶段管理 ======

	/**
	 * 获取回合阶段
	 */
	getTurnPhase(roomId: string): TurnPhase | undefined {
		const state = this._gameStates.get(roomId);
		return state?.turnPhase;
	}

	/**
	 * 推进回合阶段
	 */
	advanceTurnPhase(roomId: string): void {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'playing') {
			throw new Error('Game is not in playing phase');
		}

		const previousPhase = state.turnPhase;
		const nextPhase = getNextTurnPhase(previousPhase);

		if (nextPhase === null) {
			// 回合结束，执行结算
			const resolution = this.resolveTurn(roomId);

			// 广播回合结算
			this._broadcastTurnResolution(roomId, resolution);

			// 重置回合阶段
			state.turnPhase = 'player_action';

			// 通知阵营回合服务开始新回合
			if (this._factionTurnService) {
				this._factionTurnService.startNewRound(roomId);
			}
		} else {
			state.turnPhase = nextPhase;
			this._broadcastTurnPhaseChanged(roomId, previousPhase, nextPhase);

			// 如果进入DM行动阶段，执行DM行动
			if (nextPhase === 'dm_action') {
				this._executeDMActions(roomId);
			}
		}
	}

	/**
	 * 执行DM控制的敌方单位行动
	 * 在dm_action阶段自动执行，或由DM手动触发
	 */
	private _executeDMActions(roomId: string): void {
		if (!this._roomManager) return;

		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const enemyTokens = snapshot.tokens.filter(t => t.isEnemy);

		// 如果没有敌方单位，直接进入结算阶段
		if (enemyTokens.length === 0) {
			// 延迟一小段时间后自动推进
			setTimeout(() => {
				this.advanceTurnPhase(roomId);
			}, 500);
			return;
		}

		// 广播DM行动开始
		if (this._roomManager) {
			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.SHIP_ACTION,
				payload: {
					shipId: 'dm_actions',
					actionType: 'dm_phase_start',
					actionData: { enemyCount: enemyTokens.length },
					timestamp: Date.now(),
				},
			});
		}

		// TODO: 实现敌方AI行动逻辑
		// 目前只是占位，实际实现需要：
		// 1. 获取敌方单位的AI行为配置
		// 2. 执行移动、攻击等行动
		// 3. 广播行动结果

		// 延迟后自动推进到结算阶段
		setTimeout(() => {
			const currentState = this._gameStates.get(roomId);
			if (currentState && currentState.turnPhase === 'dm_action') {
				this.advanceTurnPhase(roomId);
			}
		}, 2000);
	}

	/**
	 * DM手动控制敌方单位行动
	 * @param roomId 房间ID
	 * @param enemyTokenId 敌方单位ID
	 * @param action 行动类型
	 * @param targetId 目标ID（可选）
	 * @param position 目标位置（可选）
	 */
	executeDMEnemyAction(
		roomId: string,
		enemyTokenId: string,
		action: 'move' | 'attack' | 'ability',
		targetId?: string,
		position?: { x: number; y: number }
	): { success: boolean; error?: string } {
		const state = this._gameStates.get(roomId);
		if (!state || state.phase !== 'playing') {
			return { success: false, error: 'Game is not in playing phase' };
		}

		if (state.turnPhase !== 'dm_action') {
			return { success: false, error: 'Not in DM action phase' };
		}

		if (!this._roomManager) {
			return { success: false, error: 'Room manager not available' };
		}

		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const enemyToken = snapshot.tokens.find(t => t.id === enemyTokenId && t.isEnemy);

		if (!enemyToken) {
			return { success: false, error: 'Enemy token not found' };
		}

		// 执行行动
		switch (action) {
			case 'move':
				if (position) {
					// 更新敌方单位位置
					this._roomManager.upsertTokenPosition(
						roomId,
						enemyTokenId,
						position,
						enemyToken.heading,
						enemyToken.ownerId,
						enemyToken.type,
						enemyToken.size
					);
					// 广播移动
					this._roomManager.broadcastToRoom(roomId, {
						type: WS_MESSAGE_TYPES.TOKEN_MOVED,
						payload: {
							tokenId: enemyTokenId,
							previousPosition: enemyToken.position,
							newPosition: position,
							previousHeading: enemyToken.heading,
							newHeading: enemyToken.heading,
							timestamp: Date.now(),
						},
					});
				}
				break;

			case 'attack':
				if (targetId && this._shipService) {
					// TODO: 实现敌方攻击逻辑
					// 广播攻击
					this._roomManager.broadcastToRoom(roomId, {
						type: WS_MESSAGE_TYPES.WEAPON_FIRED,
						payload: {
							sourceShipId: enemyTokenId,
							targetShipId: targetId,
							weaponId: 'enemy_weapon',
							mountId: 'enemy_mount',
							timestamp: Date.now(),
						},
					});
				}
				break;

			case 'ability':
				// TODO: 实现敌方能力逻辑
				break;
		}

		return { success: true };
	}

	// ====== 回合结算 ======

	/**
	 * 执行回合结算
	 */
	resolveTurn(roomId: string): TurnResolutionResult {
		const state = this._gameStates.get(roomId);
		if (!state) {
			throw new Error('Game state not found');
		}

		const result: TurnResolutionResult = {
			roundNumber: state.roundNumber,
			fluxDissipation: [],
			overloadResets: [],
			ventCompletions: [],
		};

		// 获取所有舰船的行动状态
		const actionStates = this._shipActionStates.get(roomId);
		if (!actionStates) {
			return result;
		}

		// 遍历所有舰船执行结算
		for (const [shipId, actionState] of actionStates.entries()) {
			// 1. 处理主动排散完成
			if (actionState.hasVented) {
				result.ventCompletions.push(shipId);
				// 主动排散完成，辐能清空
				if (this._shipService) {
					const status = this._shipService.getShipStatus(shipId);
					if (status) {
						const previousFlux = status.flux.current;
						this._shipService.completeVent(shipId);
						result.fluxDissipation.push({
							shipId,
							previousFlux,
							newFlux: 0,
						});
					}
				}
			}

			// 2. 处理过载结束
			if (actionState.isOverloaded) {
				result.overloadResets.push(shipId);
				// 过载结束，辐能降至一半
				if (this._shipService) {
					const status = this._shipService.getShipStatus(shipId);
					if (status) {
						const previousFlux = status.flux.current;
						this._shipService.resetOverload(shipId);
						const newFlux = Math.floor(status.flux.capacity / 2);
						result.fluxDissipation.push({
							shipId,
							previousFlux,
							newFlux,
						});
					}
				}
			}

			// 3. 正常辐能下降（非过载、非排散状态）
			if (!actionState.isOverloaded && !actionState.hasVented && this._shipService) {
				const status = this._shipService.getShipStatus(shipId);
				if (status && status.flux.softFlux > 0) {
					const previousFlux = status.flux.current;
					// 执行辐能下降
					this._shipService.dissipateFlux(shipId);
					const newFlux = Math.max(0, previousFlux - status.flux.dissipation);
					result.fluxDissipation.push({
						shipId,
						previousFlux,
						newFlux,
					});
				}
			}

			// 4. 重置行动状态
			actionState.hasMoved = false;
			actionState.hasRotated = false;
			actionState.hasFired = false;
			actionState.hasToggledShield = false;
			actionState.hasVented = false;
			actionState.isOverloaded = false;
			actionState.overloadResetAvailable = false;
			// 从舰船配置获取每回合行动次数
			actionState.remainingActions = 3; // TODO: 从舰船配置获取
		}

		return result;
	}

	// ====== 舰船行动状态管理 ======

	/**
	 * 获取舰船行动状态
	 */
	getShipActionState(roomId: string, shipId: string): ShipActionState | undefined {
		const actionStates = this._shipActionStates.get(roomId);
		return actionStates?.get(shipId);
	}

	/**
	 * 更新舰船行动状态
	 */
	updateShipActionState(roomId: string, shipId: string, updates: Partial<ShipActionState>): void {
		const actionStates = this._shipActionStates.get(roomId);
		if (!actionStates) return;

		const currentState = actionStates.get(shipId);
		if (!currentState) return;

		Object.assign(currentState, updates);

		// 广播状态更新
		this._broadcastShipActionStateUpdate(roomId, currentState);
	}

	/**
	 * 设置过载重置可用状态
	 */
	setOverloadResetAvailable(roomId: string, shipId: string, available: boolean): void {
		this.updateShipActionState(roomId, shipId, { overloadResetAvailable: available });

		// 广播过载重置可用状态
		if (this._roomManager) {
			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.OVERLOAD_RESET_AVAILABLE,
				payload: {
					shipId,
					available,
					timestamp: Date.now(),
				},
			});
		}
	}

	// ====== 清理 ======

	/**
	 * 清理房间游戏状态
	 */
	clearRoomGameState(roomId: string): void {
		this._gameStates.delete(roomId);
		this._deploymentInfo.delete(roomId);
		this._shipActionStates.delete(roomId);
	}

	// ====== 私有方法 ======

	/**
	 * 初始化舰船行动状态
	 */
	private _initializeShipActionStates(roomId: string): void {
		if (!this._roomManager) return;

		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const actionStates = new Map<string, ShipActionState>();

		for (const token of snapshot.tokens) {
			if (token.type === 'ship') {
				actionStates.set(token.id, {
					shipId: token.id,
					hasMoved: false,
					hasRotated: false,
					hasFired: false,
					hasToggledShield: false,
					hasVented: false,
					isOverloaded: false,
					overloadResetAvailable: false,
					remainingActions: token.actionsPerTurn,
					movementRemaining: token.maxMovement,
				});
			}
		}

		this._shipActionStates.set(roomId, actionStates);
	}

	// ====== 广播方法 ======

	private _broadcastGamePhaseChanged(roomId: string, previousPhase: GamePhase, newPhase: GamePhase): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.GAME_PHASE_CHANGED,
			payload: {
				previousPhase,
				newPhase,
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastDeploymentStart(roomId: string, factions: FactionId[]): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.DEPLOYMENT_START,
			payload: {
				factions,
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastDeploymentReady(roomId: string, faction: FactionId, playerId: string, ready: boolean): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.DEPLOYMENT_READY,
			payload: {
				faction,
				playerId,
				ready,
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastDeploymentComplete(roomId: string): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.DEPLOYMENT_COMPLETE,
			payload: {
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastTurnPhaseChanged(roomId: string, previousPhase: TurnPhase, newPhase: TurnPhase): void {
		if (!this._roomManager) return;

		const state = this._gameStates.get(roomId);

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TURN_PHASE_CHANGED,
			payload: {
				previousPhase,
				newPhase,
				roundNumber: state?.roundNumber ?? 1,
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastTurnResolution(roomId: string, result: TurnResolutionResult): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.TURN_RESOLUTION,
			payload: {
				...result,
				timestamp: Date.now(),
			},
		});
	}

	private _broadcastShipActionStateUpdate(roomId: string, state: ShipActionState): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.SHIP_ACTION_STATE_UPDATE,
			payload: {
				...state,
				timestamp: Date.now(),
			},
		});
	}
}

export default GameFlowService;