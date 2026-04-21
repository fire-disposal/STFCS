/**
 * 游戏状态管理器 - 基于 @vt/data schema设计
 */

import {
  GamePhase,
  Faction,
} from "@vt/data";

type TokenJSON = any;
type WeaponJSON = any;

import type {
  GameState,
  PlayerState,
} from "../types/common.js";

import type {
  Token,
  CombatToken,
} from "./Token.js";

import {
  createCombatToken,
  updateTokenRuntime,
  applyDamage
} from "./Token.js";

import { processTurnEndFlux } from "../engine/modules/flux.js";

import type {
  ComponentState,
  WeaponComponentState,
} from "./Component.js";

import {
  createWeaponComponentState,
  applyWeaponFire,
  updateWeaponCooldown
} from "./Component.js";

import {
  updateWeaponStateAtTurnEnd
} from "../engine/rules/weapon.js";

/**
 * 游戏状态管理器 - 基于schema设计
 */
export class GameStateManager {
  private state: GameState;

  constructor(roomId: string, roomName: string, maxPlayers: number = 8) {
    this.state = {
      id: roomId,
      phase: GamePhase.DEPLOYMENT,
      turn: 1,
      activeFaction: Faction.PLAYER,
      players: new Map(),
      tokens: new Map(),
      components: new Map(),
      globalModifiers: new Map<string, number>(),
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

  setGlobalModifier(key: string, value: number): void {
    if (!this.state.globalModifiers) {
      this.state.globalModifiers = new Map<string, number>();
    }
    this.state.globalModifiers.set(key, value);
  }

  getGlobalModifier(key: string): number | undefined {
    return this.state.globalModifiers?.get(key);
  }

  removeGlobalModifier(key: string): boolean {
    return this.state.globalModifiers?.delete(key) ?? false;
  }

  clearTokens(): void {
    this.state.tokens.clear();
    this.state.components.clear();
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
    this.state.tokens.set(token.id, token);
  }

  removeToken(tokenId: string): boolean {
    return this.state.tokens.delete(tokenId);
  }

  getToken(tokenId: string): Token | undefined {
    return this.state.tokens.get(tokenId);
  }

  getCombatToken(tokenId: string): CombatToken | undefined {
    const token = this.state.tokens.get(tokenId);
    return token?.type === "SHIP" ? token as CombatToken : undefined;
  }

  updateToken(tokenId: string, updates: Partial<Token>): boolean {
    const token = this.state.tokens.get(tokenId);
    if (!token) return false;

    Object.assign(token, updates);
    return true;
  }

  updateCombatToken(tokenId: string, runtimeUpdates: any): boolean {
    const combatToken = this.getCombatToken(tokenId);
    if (!combatToken) return false;

    const updatedToken = updateTokenRuntime(combatToken, runtimeUpdates);
    this.state.tokens.set(tokenId, updatedToken);
    return true;
  }

  // ==================== 组件管理 ====================

  addComponent(component: ComponentState): void {
    this.state.components.set(component.id, component);
  }

  removeComponent(componentId: string): boolean {
    return this.state.components.delete(componentId);
  }

  getComponent(componentId: string): ComponentState | undefined {
    return this.state.components.get(componentId);
  }

  getWeaponComponent(componentId: string): WeaponComponentState | undefined {
    const component = this.state.components.get(componentId);
    return component?.type === "WEAPON" ? component as WeaponComponentState : undefined;
  }

  updateComponent(componentId: string, updates: Partial<ComponentState>): boolean {
    const component = this.state.components.get(componentId);
    if (!component) return false;

    Object.assign(component, updates);
    return true;
  }

  // ==================== 游戏流程管理 ====================

  setPhase(phase: string): void {
    this.state.phase = phase as any;
  }

  setActiveFaction(faction: string): void {
    this.state.activeFaction = faction as any;
  }

  nextTurn(): void {
    this.state.turn++;

    this.updateAllComponentCooldowns();

    this.resetTokenTurnStates();

    this.updateAllWeaponStates();

    this.processAllFluxAtTurnEnd();
  }

  // ==================== 查询接口 ====================

  getAllPlayers(): PlayerState[] {
    return Array.from(this.state.players.values());
  }

  getAllTokens(): Token[] {
    return Array.from(this.state.tokens.values());
  }

  getCombatTokens(): CombatToken[] {
    return this.getAllTokens()
      .filter(token => token.type === "SHIP")
      .map(token => token as CombatToken);
  }

  getTokensByFaction(faction: string): Token[] {
    return this.getAllTokens().filter(token =>
      token.type === "SHIP" && (token as CombatToken).tokenJson.runtime?.faction === faction
    );
  }

  getCombatTokensByFaction(faction: string): CombatToken[] {
    return this.getCombatTokens().filter(ship =>
      ship.tokenJson.runtime?.faction === faction
    );
  }

  getAliveCombatTokens(): CombatToken[] {
    return this.getCombatTokens().filter(ship => !ship.tokenJson.runtime?.destroyed);
  }

  getPlayerTokens(playerId: string): Token[] {
    return this.getAllTokens().filter(token =>
      token.type === "SHIP" && (token as CombatToken).tokenJson.runtime?.ownerId === playerId
    );
  }

  getPlayerCombatTokens(playerId: string): CombatToken[] {
    return this.getCombatTokens().filter(ship =>
      ship.tokenJson.runtime?.ownerId === playerId
    );
  }

  getAllComponents(): ComponentState[] {
    return Array.from(this.state.components.values());
  }

  getWeaponComponents(): WeaponComponentState[] {
    return this.getAllComponents()
      .filter(comp => comp.type === "WEAPON")
      .map(comp => comp as WeaponComponentState);
  }

  getComponentsByToken(tokenId: string): ComponentState[] {
    return this.getAllComponents().filter(comp =>
      comp.mountId.startsWith(`${tokenId}_`)
    );
  }

  // ==================== 战斗相关方法 ====================

  applyDamageToCombatToken(
    combatTokenId: string,
    damage: number,
    armorDamage: number,
    armorQuadrant: number,
    fluxGenerated: number,
    shieldHit: boolean
  ): boolean {
    const combatToken = this.getCombatToken(combatTokenId);
    if (!combatToken) return false;

    const updatedToken = applyDamage(
      combatToken,
      damage,
      armorDamage,
      armorQuadrant,
      fluxGenerated,
      shieldHit
    );

    this.state.tokens.set(combatTokenId, updatedToken);
    return true;
  }

  fireWeapon(weaponComponentId: string): boolean {
    const weapon = this.getWeaponComponent(weaponComponentId);
    if (!weapon) return false;

    const updatedWeapon = applyWeaponFire(weapon);
    this.state.components.set(weaponComponentId, updatedWeapon);
    return true;
  }

  // ==================== 状态管理 ====================

  getState(): GameState {
    return { ...this.state };
  }

  getStateSnapshot(): GameState {
    return {
      ...this.state,
      players: Object.fromEntries(this.state.players.entries()) as any,
      tokens: Object.fromEntries(this.state.tokens.entries()) as any,
      components: Object.fromEntries(this.state.components.entries()) as any,
      globalModifiers: this.state.globalModifiers
        ? (Object.fromEntries(this.state.globalModifiers.entries()) as any)
        : undefined,
      metadata: { ...this.state.metadata },
    } as any;
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

    if (actionType.startsWith("TURN_") && this.state.activeFaction !== player.faction) {
      return { valid: false, error: "不是当前行动阵营" };
    }

    return { valid: true };
  }

  // ==================== 工具方法 ====================

  isGameOver(): boolean {
    const aliveShips = this.getAliveCombatTokens();
    const playerShips = aliveShips.filter(ship => ship.tokenJson.runtime?.faction === Faction.PLAYER);
    const enemyShips = aliveShips.filter(ship => ship.tokenJson.runtime?.faction === Faction.ENEMY);

    return playerShips.length === 0 || enemyShips.length === 0;
  }

  getWinner(): string | null {
    if (!this.isGameOver()) return null;

    const aliveShips = this.getAliveCombatTokens();
    const playerShips = aliveShips.filter(ship => ship.tokenJson.runtime?.faction === Faction.PLAYER);

    return playerShips.length > 0 ? Faction.PLAYER : Faction.ENEMY;
  }

  // ==================== 私有方法 ====================

  private updateAllComponentCooldowns(): void {
    for (const [componentId, component] of this.state.components.entries()) {
      if (component.type === "WEAPON") {
        const weapon = component as WeaponComponentState;
        const updatedWeapon = updateWeaponCooldown(weapon);
        this.state.components.set(componentId, updatedWeapon);
      }
    }
  }

  private processAllFluxAtTurnEnd(): void {
    for (const [, token] of this.state.tokens.entries()) {
      if (token.type === "SHIP") {
        const combatToken = token as CombatToken;
        if (!combatToken.tokenJson.runtime?.destroyed) {
          processTurnEndFlux(combatToken);
        }
      }
    }
  }

  private resetTokenTurnStates(): void {
    for (const [tokenId, token] of this.state.tokens.entries()) {
      if (token.type === "SHIP") {
        const combatToken = token as CombatToken;
        const updatedToken = updateTokenRuntime(combatToken, {
          movement: {
            currentPhase: "A",
            hasMoved: false,
            phaseAUsed: 0,
            turnAngleUsed: 0,
            phaseCUsed: 0,
            phaseALock: null,
            phaseCLock: null,
          } as any,
          hasFired: false,
        });
        this.state.tokens.set(tokenId, updatedToken);
      }
    }
  }

  private updateAllWeaponStates(): void {
    for (const [tokenId, token] of this.state.tokens.entries()) {
      if (token.type === "SHIP") {
        const combatToken = token as CombatToken;
        if (combatToken.tokenJson.runtime?.weapons) {
          const updatedWeapons = combatToken.tokenJson.runtime.weapons.map((weaponRuntime: any) => {
            const mount = combatToken.tokenJson.token.mounts?.find(
              (m: any) => m.id === weaponRuntime.mountId
            );
            const weaponSpec = mount
              ? typeof mount.weapon === "object"
                ? mount.weapon
                : weaponRuntime.weapon
              : weaponRuntime.weapon;
            return updateWeaponStateAtTurnEnd(weaponRuntime, weaponSpec || undefined) || weaponRuntime;
          });

          const updatedToken = updateTokenRuntime(combatToken, {
            weapons: updatedWeapons,
          });
          this.state.tokens.set(tokenId, updatedToken);
        }
      }
    }
  }

  // ==================== 工厂方法 ====================

  createCombatTokenFromJson(
    tokenJson: TokenJSON,
    position: { x: number; y: number },
    heading: number = 0,
    faction?: string,
    ownerId?: string
  ): CombatToken {
    const tokenId = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return createCombatToken(tokenId, tokenJson, position, heading, faction as any, ownerId);
  }

  createWeaponComponentFromJson(
    weaponJson: WeaponJSON,
    mountId: string,
    tokenId: string
  ): WeaponComponentState {
    const componentId = `weapon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMountId = `${tokenId}_${mountId}`;
    return createWeaponComponentState(componentId, fullMountId, weaponJson);
  }

  // ==================== 批量操作 ====================

  addTokenWithComponents(
    tokenJson: TokenJSON,
    position: { x: number; y: number },
    heading: number = 0,
    faction?: string,
    ownerId?: string
  ): { combatToken: CombatToken; components: WeaponComponentState[] } {
    const combatToken = this.createCombatTokenFromJson(tokenJson, position, heading, faction, ownerId);
    this.addToken(combatToken);

    const components: WeaponComponentState[] = [];
    const spec = tokenJson.token;

    if (spec.mounts) {
      for (const mount of spec.mounts) {
        if (mount.weapon && typeof mount.weapon !== "string") {
          const weaponComponent = this.createWeaponComponentFromJson(
            mount.weapon,
            mount.id,
            combatToken.id
          );
          this.addComponent(weaponComponent);
          components.push(weaponComponent);
        }
      }
    }

    return { combatToken, components };
  }

  removeTokenWithComponents(combatTokenId: string): boolean {
    const combatToken = this.getCombatToken(combatTokenId);
    if (!combatToken) return false;

    this.removeToken(combatTokenId);

    const components = this.getComponentsByToken(combatTokenId);
    for (const component of components) {
      this.removeComponent(component.id);
    }

    return true;
  }

  // ==================== 兼容别名 ====================

  /** @deprecated 使用 getCombatToken */
  getShipToken = this.getCombatToken;
  /** @deprecated 使用 updateCombatToken */
  updateShipToken = this.updateCombatToken;
  /** @deprecated 使用 getCombatTokens */
  getShipTokens = this.getCombatTokens;
  /** @deprecated 使用 getCombatTokensByFaction */
  getShipTokensByFaction = this.getCombatTokensByFaction;
  /** @deprecated 使用 getAliveCombatTokens */
  getAliveShipTokens = this.getAliveCombatTokens;
  /** @deprecated 使用 getPlayerCombatTokens */
  getPlayerShipTokens = this.getPlayerCombatTokens;
  /** @deprecated 使用 applyDamageToCombatToken */
  applyDamageToShip = this.applyDamageToCombatToken;
  /** @deprecated 使用 createCombatTokenFromJson */
  createShipTokenFromJson = this.createCombatTokenFromJson;
  /** @deprecated 使用 addTokenWithComponents */
  addShipWithComponents = this.addTokenWithComponents;
  /** @deprecated 使用 removeTokenWithComponents */
  removeShipWithComponents = this.removeTokenWithComponents;
}