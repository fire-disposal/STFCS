/**
 * 游戏操作类型定义
 *
 * 定义客户端可调用的操作签名
 * 服务端实现这些操作，客户端调用它们
 */

import type { FactionId, ArmorQuadrant, Point } from '../types/index.js';

// ==================== 操作参数类型 ====================

/** 玩家管理操作 */
export interface PlayerOperations {
  join: [name: string];
  leave: [];
  kick: [targetId: string];
  setOwner: [newOwnerId: string];
}

/** 阵营系统操作 */
export interface FactionOperations {
  selectFaction: [faction: FactionId];
  cancelFaction: [];
  endTurn: [];
  cancelEndTurn: [];
}

/** 游戏流程操作 */
export interface GameFlowOperations {
  startGame: [];
  startBattle: [];
  endGame: [winner?: FactionId];
  advancePhase: [];
}

/** 素材放置操作 */
export interface AssetOperations {
  spawnToken: [templateId: string, tokenId: string, position: Point, heading: number, name?: string];
  removeToken: [tokenId: string];
  setTokenController: [tokenId: string, playerId: string | null];
  batchSetController: [assignments: Array<{ tokenId: string; playerId: string | null }>];
}

/** 移动系统操作 */
export interface MovementOperations {
  moveShip: [tokenId: string, position: Point, heading?: number];
  endShipAction: [tokenId: string];
}

/** 战斗系统操作 */
export interface CombatOperations {
  selectTarget: [targetId: string];
  clearTarget: [targetId?: string];
  selectWeapon: [weaponId: string];
  clearWeapon: [];
  selectQuadrant: [quadrant: ArmorQuadrant];
  clearQuadrant: [];
  attack: [attackerId: string, targetId: string, weaponId: string, quadrant: ArmorQuadrant];
  ventFlux: [tokenId: string];
  toggleShield: [tokenId: string];
}

/** 所有游戏操作 */
export interface GameOperations
  extends PlayerOperations,
    FactionOperations,
    GameFlowOperations,
    AssetOperations,
    MovementOperations,
    CombatOperations {}

/** 操作名称 */
export type GameOperationName = keyof GameOperations;

/** 获取操作参数类型 */
export type GameOperationArgs<K extends GameOperationName> = GameOperations[K];

/** 操作结果类型映射 */
export interface OperationResultMap {
  spawnToken: { tokenId: string; templateId: string };
  attack: {
    destroyed: boolean;
    targetId: string;
    damage: number;
    targetFlux?: number;
    targetOverloaded?: boolean;
  };
}

/** 获取操作返回类型 */
export type OperationReturn<K extends GameOperationName> = K extends keyof OperationResultMap
  ? OperationResultMap[K]
  : void;