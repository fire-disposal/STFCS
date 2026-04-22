/**
 * 游戏状态管理 - 基于 @vt/data 权威设计
 */

import type { Faction, GamePhase } from "@vt/data";
import type { GameState, PlayerState } from "../types/common.js";
import type { Token, CombatToken } from "./Token.js";
import { isCombatToken } from "./Token.js";

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
      tokens: new Map(),
      components: new Map(),
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

  // ==================== Token管理 ====================

  addToken(token: Token): void {
    this.state.tokens.set(token.$id, token);
  }

  removeToken(tokenId: string): boolean {
    return this.state.tokens.delete(tokenId);
  }

  getToken(tokenId: string): Token | undefined {
    return this.state.tokens.get(tokenId);
  }

  updateToken(tokenId: string, updates: Partial<Token>): boolean {
    const token = this.state.tokens.get(tokenId);
    if (!token) return false;

    Object.assign(token, updates);
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

  getAllTokens(): Token[] {
    return Array.from(this.state.tokens.values());
  }

  getPlayerShips(playerId: string): CombatToken[] {
    return this.getAllTokens()
      .filter(isCombatToken)
      .filter(ship => ship.runtime?.ownerId === playerId);
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

  validateAction(playerId: string, _actionType: string): { valid: boolean; error?: string } {
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
