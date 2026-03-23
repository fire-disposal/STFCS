import type { TurnUnit, TurnPhase, UnitTurnState } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

/**
 * 回合服务 - 管理游戏的回合顺序和状态
 * 
 * 功能：
 * - 初始化回合顺序（按先攻值排序）
 * - 管理当前回合单位
 * - 支持循环轮换
 * - 支持动态添加/移除单位
 */
export interface TurnOrderConfig {
	roundNumber?: number;
	phase?: TurnPhase;
}

export interface InitializeTurnOrderResult {
	success: boolean;
	order?: TurnOrderData;
	error?: string;
}

export interface TurnOrderData {
	currentIndex: number;
	units: TurnUnit[];
	roundNumber: number;
	phase: TurnPhase;
	isComplete: boolean;
}

export interface ITurnService {
	initializeTurnOrder(
		roomId: string,
		units: TurnUnit[],
		config?: TurnOrderConfig
	): InitializeTurnOrderResult;
	getTurnOrder(roomId: string): TurnOrderData | null;
	getCurrentUnit(roomId: string): TurnUnit | null;
	getCurrentIndex(roomId: string): number;
	nextTurn(roomId: string): TurnUnit | null;
	previousTurn(roomId: string): TurnUnit | null;
	setCurrentIndex(roomId: string, index: number): boolean;
	updateUnitState(
		roomId: string,
		unitId: string,
		state: UnitTurnState
	): boolean;
	addUnit(roomId: string, unit: TurnUnit): boolean;
	removeUnit(roomId: string, unitId: string): boolean;
	incrementRound(roomId: string): TurnOrderData | null;
	setPhase(roomId: string, phase: TurnPhase): boolean;
	resetTurnOrder(roomId: string): boolean;
}

export class TurnService implements ITurnService {
	private _turnOrders: Map<string, TurnOrderData>;
	private _wsServer?: IWSServer;
	private _roomManager?: RoomManager;

	constructor() {
		this._turnOrders = new Map();
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	/**
	 * 初始化回合顺序
	 * 按先攻值降序排序所有单位
	 */
	initializeTurnOrder(
		roomId: string,
		units: TurnUnit[],
		config: TurnOrderConfig = {}
	): InitializeTurnOrderResult {
		if (!roomId) {
			return { success: false, error: "Room ID is required" };
		}

		if (units.length === 0) {
			return { success: false, error: "At least one unit is required" };
		}

		// 按先攻值降序排序
		const sortedUnits = [...units].sort((a, b) => b.initiative - a.initiative);

		const order: TurnOrderData = {
			currentIndex: 0,
			units: sortedUnits,
			roundNumber: config.roundNumber ?? 1,
			phase: config.phase ?? "deployment",
			isComplete: false,
		};

		this._turnOrders.set(roomId, order);

		// 广播回合顺序初始化
		this._broadcastTurnOrderInitialized(roomId, order);

		return { success: true, order };
	}

	/**
	 * 获取回合顺序
	 */
	getTurnOrder(roomId: string): TurnOrderData | null {
		return this._turnOrders.get(roomId) ?? null;
	}

	/**
	 * 获取当前回合单位
	 */
	getCurrentUnit(roomId: string): TurnUnit | null {
		const order = this.getTurnOrder(roomId);
		if (!order || order.units.length === 0) {
			return null;
		}
		return order.units[order.currentIndex];
	}

	/**
	 * 获取当前回合索引
	 */
	getCurrentIndex(roomId: string): number {
		const order = this.getTurnOrder(roomId);
		return order?.currentIndex ?? -1;
	}

	/**
	 * 前进到下一回合
	 * 支持循环（最后一个单位的下一个是第一个单位）
	 */
	nextTurn(roomId: string): TurnUnit | null {
		const order = this.getTurnOrder(roomId);
		if (!order || order.units.length === 0) {
			return null;
		}

		const previousIndex = order.currentIndex;
		// 循环索引
		order.currentIndex = (order.currentIndex + 1) % order.units.length;

		// 更新当前单位状态为 active
		order.units.forEach((unit, index) => {
			if (index === order.currentIndex) {
				unit.state = "active";
			} else if (index === previousIndex) {
				unit.state = "ended";
			} else if (unit.state === "active") {
				unit.state = "waiting";
			}
		});

		// 广播回合变更
		this._broadcastTurnIndexChanged(roomId, order.currentIndex, previousIndex);
		this._broadcastUnitStateChanged(roomId, order.units[order.currentIndex].id, "active");

		return order.units[order.currentIndex];
	}

	/**
	 * 返回上一回合
	 * 支持循环（第一个单位的上一個是最后一个单位）
	 */
	previousTurn(roomId: string): TurnUnit | null {
		const order = this.getTurnOrder(roomId);
		if (!order || order.units.length === 0) {
			return null;
		}

		const previousIndex = order.currentIndex;
		// 循环索引（处理负数）
		order.currentIndex =
			((order.currentIndex - 1) % order.units.length + order.units.length) %
			order.units.length;

		// 更新状态
		order.units.forEach((unit, index) => {
			if (index === order.currentIndex) {
				unit.state = "active";
			} else if (index === previousIndex) {
				unit.state = "waiting";
			}
		});

		// 广播回合变更
		this._broadcastTurnIndexChanged(roomId, order.currentIndex, previousIndex);
		this._broadcastUnitStateChanged(roomId, order.units[order.currentIndex].id, "active");

		return order.units[order.currentIndex];
	}

	/**
	 * 设置当前回合索引
	 */
	setCurrentIndex(roomId: string, index: number): boolean {
		const order = this.getTurnOrder(roomId);
		if (!order || order.units.length === 0) {
			return false;
		}

		const normalizedIndex =
			((index % order.units.length) + order.units.length) % order.units.length;
		const previousIndex = order.currentIndex;
		order.currentIndex = normalizedIndex;

		// 广播变更
		this._broadcastTurnIndexChanged(roomId, normalizedIndex, previousIndex);

		return true;
	}

	/**
	 * 更新单位状态
	 */
	updateUnitState(
		roomId: string,
		unitId: string,
		state: UnitTurnState
	): boolean {
		const order = this.getTurnOrder(roomId);
		if (!order) {
			return false;
		}

		const unit = order.units.find((u) => u.id === unitId);
		if (!unit) {
			return false;
		}

		unit.state = state;

		// 广播状态变更
		this._broadcastUnitStateChanged(roomId, unitId, state);

		return true;
	}

	/**
	 * 添加单位到回合顺序
	 */
	addUnit(roomId: string, unit: TurnUnit): boolean {
		const order = this.getTurnOrder(roomId);
		if (!order) {
			// 如果没有回合顺序，创建一个
			const result = this.initializeTurnOrder(roomId, [unit]);
			return result.success;
		}

		// 检查是否已存在
		const exists = order.units.some((u) => u.id === unit.id);
		if (exists) {
			return false;
		}

		order.units.push(unit);
		// 重新排序
		order.units.sort((a, b) => b.initiative - a.initiative);

		// 调整当前索引（如果添加的单位在当前单位之前）
		const newIndex = order.units.findIndex((u) => u.id === unit.id);
		if (newIndex <= order.currentIndex) {
			order.currentIndex = (order.currentIndex + 1) % order.units.length;
		}

		// 广播更新
		this._broadcastTurnOrderUpdated(roomId, order);

		return true;
	}

	/**
	 * 从回合顺序移除单位
	 */
	removeUnit(roomId: string, unitId: string): boolean {
		const order = this.getTurnOrder(roomId);
		if (!order) {
			return false;
		}

		const unitIndex = order.units.findIndex((u) => u.id === unitId);
		if (unitIndex < 0) {
			return false;
		}

		order.units.splice(unitIndex, 1);

		// 调整当前索引
		if (order.units.length === 0) {
			order.currentIndex = 0;
			order.isComplete = true;
		} else if (unitIndex <= order.currentIndex) {
			order.currentIndex = Math.max(0, order.currentIndex - 1);
		}

		// 广播更新
		this._broadcastTurnOrderUpdated(roomId, order);

		return true;
	}

	/**
	 * 增加回合数
	 * 重置所有单位状态并回到第一个单位
	 */
	incrementRound(roomId: string): TurnOrderData | null {
		const order = this.getTurnOrder(roomId);
		if (!order) {
			return null;
		}

		order.roundNumber += 1;
		order.currentIndex = 0;
		order.phase = "planning";
		order.isComplete = false;

		// 重置所有单位状态
		order.units.forEach((unit) => {
			unit.state = "waiting";
		});

		// 设置第一个单位为 active
		if (order.units.length > 0) {
			order.units[0].state = "active";
		}

		// 广播更新
		this._broadcastTurnOrderUpdated(roomId, order);

		return order;
	}

	/**
	 * 设置回合阶段
	 */
	setPhase(roomId: string, phase: TurnPhase): boolean {
		const order = this.getTurnOrder(roomId);
		if (!order) {
			return false;
		}

		order.phase = phase;

		// 广播更新
		this._broadcastTurnOrderUpdated(roomId, order);

		return true;
	}

	/**
	 * 重置回合顺序
	 */
	resetTurnOrder(roomId: string): boolean {
		const existed = this._turnOrders.has(roomId);
		this._turnOrders.delete(roomId);

		if (existed && this._wsServer) {
			// 可以广播重置消息
		}

		return true;
	}

	// ====== 私有广播方法 ======

	private _broadcastTurnOrderInitialized(roomId: string, order: TurnOrderData) {
		if (!this._wsServer) return;

		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED,
			payload: {
				units: order.units.map((u) => ({
					id: u.id,
					name: u.name,
					ownerId: u.ownerId,
					ownerName: u.ownerName,
					unitType: u.unitType,
					state: u.state,
					initiative: u.initiative,
				})),
				roundNumber: order.roundNumber,
				phase: order.phase,
			},
		});
	}

	private _broadcastTurnOrderUpdated(roomId: string, order: TurnOrderData) {
		if (!this._wsServer) return;

		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.TURN_ORDER_UPDATED,
			payload: {
				units: order.units.map((u) => ({
					id: u.id,
					name: u.name,
					ownerId: u.ownerId,
					ownerName: u.ownerName,
					unitType: u.unitType,
					state: u.state,
					initiative: u.initiative,
				})),
				roundNumber: order.roundNumber,
				phase: order.phase,
			},
		});
	}

	private _broadcastTurnIndexChanged(
		roomId: string,
		currentIndex: number,
		previousIndex: number
	) {
		if (!this._wsServer) return;

		const order = this.getTurnOrder(roomId);
		if (!order) return;

		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.TURN_INDEX_CHANGED,
			payload: {
				currentIndex,
				previousIndex,
				roundNumber: order.roundNumber,
			},
		});
	}

	private _broadcastUnitStateChanged(
		roomId: string,
		unitId: string,
		state: UnitTurnState
	) {
		if (!this._wsServer) return;

		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.UNIT_STATE_CHANGED,
			payload: {
				unitId,
				state,
			},
		});
	}
}

export default TurnService;
