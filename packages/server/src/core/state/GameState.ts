/**
 * 游戏状态管理 - 基于 @vt/data 权威设计
 */

import { 
  PlayerRole,
} from "@vt/data";

import type { FactionType, GamePhaseType } from "@vt/data";
import type { GameState, PlayerState, ShipState, GameMetadata } from "../types/common.js";

/** 游戏状态管理器 */
export class GameStateManager {
  private state: GameState;

  constructor(roomId: string, roomName: string, maxPlayers: number = 8) {
    this.state = {
      id: roomId,
      phase: "DEPLOYMENT",
      turn: 1,
      activeFaction: "PLAYER", // 保留基本派系概念，但简化逻辑
      players: new Map(),
      ships: new Map(),
      metadata: {
        roomId,
        roomName,
        createdAt: Date.now(),
        maxPlayers,
        mapWidth: 2000,
        mapHeight: 2000,
      },
    };
  }

  // ==================== 玩家管理 ====================

  addPlayer(player: PlayerState): void {
    this.state.players.set(player.id, player);
  }

  removePlayer(playerId: string): boolean {
    return this.state.players.delete(playerId);
  }

  getPlayer(playerId: string): PlayerState | undefined {
    return this.state.players.get(playerId);
  }

  updatePlayer(playerId: string, updates: Partial<PlayerState>): boolean {
    const player = this.state.players.get(playerId);
    if (!player) return false;

    Object.assign(player, updates);
    return true;
  }

  // ==================== 舰船管理 ====================

  addShip(shipState: ShipState): void {
    this.state.ships.set(shipState.id, shipState);
  }

  removeShip(shipId: string): boolean {
    return this.state.ships.delete(shipId);
  }

  getShip(shipId: string): ShipState | undefined {
    return this.state.ships.get(shipId);
  }

  updateShip(shipId: string, updates: Partial<ShipState>): boolean {
    const ship = this.state.ships.get(shipId);
    if (!ship) return false;

    Object.assign(ship, updates);
    return true;
  }

  // ==================== 游戏流程管理 ====================

  setPhase(phase: GamePhase): void {
    this.state.phase = phase;
  }

  nextTurn(): void {
    this.state.turn++;
  }

  setActiveFaction(faction: Faction): void {
    this.state.activeFaction = faction;
  }

  // ==================== 查询接口 ====================

  getAllPlayers(): PlayerState[] {
    return Array.from(this.state.players.values());
  }

  getAllShips(): ShipState[] {
    return Array.from(this.state.ships.values());
  }

  getPlayerShips(playerId: string): ShipState[] {
    // 简化：假设玩家ID与舰船所有者ID相同
    return this.getAllShips().filter(ship => 
      ship.shipJson.ship.ownerId === playerId
    );
  }

  // ==================== 状态快照 ====================

  getState(): GameState {
    return { ...this.state };
  }

  getStateSnapshot(): GameState {
    // 返回深拷贝的状态快照
    return JSON.parse(JSON.stringify(this.state));
  }

  // ==================== 验证接口 ====================

  validateAction(playerId: string, actionType: string): { valid: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { valid: false, error: "玩家不存在" };
    }

    if (!player.connected) {
      return { valid: false, error: "玩家未连接" };
    }

    return { valid: true };
  }
}