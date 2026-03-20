/**
 * 行动服务
 *
 * 管理舰船行动的执行和验证：
 * - 行动权限验证
 * - 行动执行
 * - 行动状态更新
 * - 过载解除
 */

import type { FactionId } from '@vt/shared';
import type {
	ShipActionType,
	ShipActionState,
	ActionResult,
	ActionRestrictionReason,
} from '@vt/shared/protocol';
import {
	isActionRestricted,
	ACTION_RESTRICTIONS,
} from '@vt/shared/protocol';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { IWSServer } from '@vt/shared/ws';
import type { RoomManager } from '../../infrastructure/ws/RoomManager';
import type { ShipService } from '../ship/ShipService';
import type { GameFlowService } from '../game/GameFlowService';
import type { FactionTurnService } from '../turn/FactionTurnService';
import type { CombatService, FireWeaponResult } from '../combat/CombatService';

/**
 * 行动执行上下文
 */
export interface ActionContext {
	roomId: string;
	playerId: string;
	shipId: string;
	actionType: ShipActionType;
	actionData?: Record<string, unknown>;
}

/**
 * 行动验证结果
 */
export interface ActionValidationResult {
	valid: boolean;
	reason?: ActionRestrictionReason;
	message?: string;
}

/**
 * 行动服务接口
 */
export interface IActionService {
	// 行动验证
	validateAction(context: ActionContext): Promise<ActionValidationResult>;

	// 行动执行
	executeAction(context: ActionContext): Promise<ActionResult>;

	// 过载解除
	resetOverload(roomId: string, shipId: string, playerId: string): Promise<ActionResult>;

	// 获取舰船行动状态
	getShipActionState(roomId: string, shipId: string): ShipActionState | undefined;

	// 检查玩家是否可以控制舰船
	canPlayerControlShip(roomId: string, playerId: string, shipId: string): boolean;
}

export class ActionService implements IActionService {
	private _wsServer?: IWSServer;
	private _roomManager?: RoomManager;
	private _shipService?: ShipService;
	private _gameFlowService?: GameFlowService;
	private _factionTurnService?: FactionTurnService;
	private _combatService?: CombatService;

	constructor() {}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	setShipService(shipService: ShipService): void {
		this._shipService = shipService;
	}

	setGameFlowService(gameFlowService: GameFlowService): void {
		this._gameFlowService = gameFlowService;
	}

	setFactionTurnService(factionTurnService: FactionTurnService): void {
		this._factionTurnService = factionTurnService;
	}

	setCombatService(combatService: CombatService): void {
		this._combatService = combatService;
	}

	/**
	 * 验证行动
	 */
	async validateAction(context: ActionContext): Promise<ActionValidationResult> {
		const { roomId, playerId, shipId, actionType } = context;

		// 1. 检查玩家是否可以控制该舰船
		if (!this.canPlayerControlShip(roomId, playerId, shipId)) {
			return {
				valid: false,
				reason: 'not_your_ship',
				message: 'You do not control this ship',
			};
		}

		// 2. 检查是否为该玩家阵营的回合
		if (!this._isPlayerFactionTurn(roomId, playerId)) {
			return {
				valid: false,
				reason: 'not_your_turn',
				message: 'It is not your faction\'s turn',
			};
		}

		// 3. 获取舰船行动状态
		const actionState = this.getShipActionState(roomId, shipId);
		if (!actionState) {
			return {
				valid: false,
				message: 'Ship not found',
			};
		}

		// 4. 检查行动限制
		const restriction = isActionRestricted(actionType, {
			isOverloaded: actionState.isOverloaded,
			isVenting: actionState.hasVented,
			hasFiredThisTurn: actionState.hasFired,
		});

		if (restriction.restricted) {
			return {
				valid: false,
				reason: restriction.reason,
				message: `Action restricted: ${restriction.reason}`,
			};
		}

		// 5. 检查剩余行动次数
		if (actionState.remainingActions <= 0 && actionType !== 'overload_reset') {
			return {
				valid: false,
				reason: 'no_actions_remaining',
				message: 'No actions remaining this turn',
			};
		}

		return { valid: true };
	}

	/**
	 * 执行行动
	 */
	async executeAction(context: ActionContext): Promise<ActionResult> {
		const { roomId, playerId, shipId, actionType, actionData } = context;

		// 验证行动
		const validation = await this.validateAction(context);
		if (!validation.valid) {
			return {
				success: false,
				actionType,
				shipId,
				error: validation.message,
				restrictionReason: validation.reason,
			};
		}

		// 执行行动
		try {
			let success = false;
			const actionState = this.getShipActionState(roomId, shipId)!;

			switch (actionType) {
				case 'move':
					success = await this._executeMove(roomId, shipId, actionData);
					break;
				case 'rotate':
					success = await this._executeRotate(roomId, shipId, actionData);
					break;
				case 'fire':
					success = await this._executeFire(roomId, shipId, actionData);
					break;
				case 'shield_toggle':
					success = await this._executeShieldToggle(roomId, shipId);
					break;
				case 'vent':
					success = await this._executeVent(roomId, shipId);
					break;
				case 'overload_reset':
					success = await this._executeOverloadReset(roomId, shipId);
					break;
				default:
					return {
						success: false,
						actionType,
						shipId,
						error: `Unknown action type: ${actionType}`,
					};
			}

			// 更新行动状态
			if (success && this._gameFlowService) {
				const updates = this._getActionStateUpdates(actionType, actionState);
				this._gameFlowService.updateShipActionState(roomId, shipId, updates);

				// 广播行动状态更新
				this._broadcastActionStateUpdate(roomId, shipId);
			}

			return {
				success,
				actionType,
				shipId,
				newState: this.getShipActionState(roomId, shipId),
			};
		} catch (error) {
			return {
				success: false,
				actionType,
				shipId,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * 解除过载
	 */
	async resetOverload(roomId: string, shipId: string, playerId: string): Promise<ActionResult> {
		return this.executeAction({
			roomId,
			playerId,
			shipId,
			actionType: 'overload_reset',
		});
	}

	/**
	 * 获取舰船行动状态
	 */
	getShipActionState(roomId: string, shipId: string): ShipActionState | undefined {
		if (!this._gameFlowService) return undefined;
		return this._gameFlowService.getShipActionState(roomId, shipId);
	}

	/**
	 * 检查玩家是否可以控制舰船
	 */
	canPlayerControlShip(roomId: string, playerId: string, shipId: string): boolean {
		if (!this._roomManager) return false;

		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const token = snapshot.tokens.find(t => t.id === shipId);

		if (!token) return false;

		// 检查Token的所有者
		if (token.ownerId === playerId) return true;

		// TODO: 检查玩家是否为DM且舰船为敌方
		// 这需要从Token的faction字段判断

		return false;
	}

	// ====== 私有方法 ======

	/**
	 * 检查是否为玩家阵营的回合
	 */
	private _isPlayerFactionTurn(roomId: string, playerId: string): boolean {
		if (!this._factionTurnService || !this._roomManager) return true; // 如果没有回合系统，允许行动

		const turnState = this._factionTurnService.getTurnState(roomId);
		if (!turnState) return true;

		// 获取玩家的阵营
		const snapshot = this._roomManager.getMapSnapshot(roomId);
		const playerTokens = snapshot.tokens.filter(t => t.ownerId === playerId);

		if (playerTokens.length === 0) return false;

		// 检查玩家是否有任何Token属于当前行动阵营
		return playerTokens.some(token => {
			const tokenFaction = token.faction || 'federation'; // 默认阵营
			return tokenFaction === turnState.currentFaction;
		});
	}

	/**
	 * 执行移动
	 */
	private async _executeMove(roomId: string, shipId: string, actionData?: Record<string, unknown>): Promise<boolean> {
		if (!this._shipService || !actionData) return false;

		const result = await this._shipService.moveShip(shipId, actionData as any);
		return result.success;
	}

	/**
	 * 执行转向
	 */
	private async _executeRotate(roomId: string, shipId: string, actionData?: Record<string, unknown>): Promise<boolean> {
		if (!this._shipService || !actionData) return false;

		const result = await this._shipService.moveShip(shipId, {
			...actionData,
			type: 'rotate',
		} as any);
		return result.success;
	}

	/**
	 * 执行开火
	 */
	private async _executeFire(roomId: string, shipId: string, actionData?: Record<string, unknown>): Promise<boolean> {
		if (!actionData) {
			console.warn('[_executeFire] No action data provided');
			return false;
		}

		const targetShipId = actionData.targetShipId as string;
		const weaponMountId = actionData.weaponMountId as string;

		if (!targetShipId || !weaponMountId) {
			console.warn('[_executeFire] Missing targetShipId or weaponMountId');
			return false;
		}

		// 如果有 CombatService，使用它执行攻击
		if (this._combatService) {
			const result = this._combatService.executeAttack({
				sourceShipId: shipId,
				targetShipId,
				weaponMountId,
				timestamp: Date.now(),
			}, roomId);

			// 广播开火消息
			if (this._roomManager) {
				this._roomManager.broadcastToRoom(roomId, {
					type: WS_MESSAGE_TYPES.WEAPON_FIRED,
					payload: {
						sourceShipId: shipId,
						targetShipId,
						weaponId: weaponMountId,
						mountId: weaponMountId,
						timestamp: Date.now(),
					},
				});

				// 如果命中，广播伤害结果
				if (result.hit) {
					this._roomManager.broadcastToRoom(roomId, {
						type: WS_MESSAGE_TYPES.DAMAGE_DEALT,
						payload: {
							targetShipId,
							sourceShipId: shipId,
							hit: result.hit,
							damage: result.damageResult.damage,
							shieldAbsorbed: result.damageResult.shieldAbsorbed,
							armorReduced: result.damageResult.armorReduced,
							hullDamage: result.damageResult.hullDamage,
							hitQuadrant: result.damageResult.hitQuadrant,
							softFluxGenerated: result.damageResult.softFluxGenerated,
							hardFluxGenerated: result.damageResult.hardFluxGenerated,
							timestamp: Date.now(),
						},
					});
				}
			}

			return true;
		}

		// 回退：没有 CombatService 时，只广播开火消息
		if (this._roomManager) {
			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.WEAPON_FIRED,
				payload: {
					sourceShipId: shipId,
					targetShipId,
					weaponId: weaponMountId,
					mountId: weaponMountId,
					timestamp: Date.now(),
				},
			});
		}

		return true;
	}

	/**
	 * 执行护盾切换
	 */
	private async _executeShieldToggle(roomId: string, shipId: string): Promise<boolean> {
		if (!this._shipService) return false;
		return await this._shipService.toggleShield(shipId);
	}

	/**
	 * 执行主动排散
	 */
	private async _executeVent(roomId: string, shipId: string): Promise<boolean> {
		if (!this._shipService) return false;
		return await this._shipService.ventShip(shipId);
	}

	/**
	 * 执行过载解除
	 */
	private async _executeOverloadReset(roomId: string, shipId: string): Promise<boolean> {
		if (!this._shipService || !this._gameFlowService) return false;

		const actionState = this.getShipActionState(roomId, shipId);
		if (!actionState || !actionState.isOverloaded || !actionState.overloadResetAvailable) {
			return false;
		}

		// 调用ShipService解除过载
		// TODO: 需要在ShipService中添加解除过载的方法
		// await this._shipService.resetOverload(shipId);

		// 更新状态
		this._gameFlowService.updateShipActionState(roomId, shipId, {
			isOverloaded: false,
			overloadResetAvailable: false,
		});

		// 广播过载解除
		if (this._roomManager) {
			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.FLUX_STATE,
				payload: {
					shipId,
					fluxState: 'normal',
					currentFlux: 0, // TODO: 获取实际值
					softFlux: 0,
					hardFlux: 0,
				},
			});
		}

		return true;
	}

	/**
	 * 获取行动状态更新
	 */
	private _getActionStateUpdates(actionType: ShipActionType, currentState: ShipActionState): Partial<ShipActionState> {
		const updates: Partial<ShipActionState> = {};

		switch (actionType) {
			case 'move':
				updates.hasMoved = true;
				updates.remainingActions = Math.max(0, currentState.remainingActions - 1);
				break;
			case 'rotate':
				updates.hasRotated = true;
				updates.remainingActions = Math.max(0, currentState.remainingActions - 1);
				break;
			case 'fire':
				updates.hasFired = true;
				updates.remainingActions = Math.max(0, currentState.remainingActions - 1);
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

		return updates;
	}

	/**
	 * 广播行动状态更新
	 */
	private _broadcastActionStateUpdate(roomId: string, shipId: string): void {
		if (!this._roomManager || !this._gameFlowService) return;

		const actionState = this._gameFlowService.getShipActionState(roomId, shipId);
		if (!actionState) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.SHIP_ACTION_STATE_UPDATE,
			payload: {
				...actionState,
				timestamp: Date.now(),
			},
		});
	}
}

export default ActionService;