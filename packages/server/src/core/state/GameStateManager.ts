/**
 * 游戏状态管理器 - 基于 @vt/data schema设计
 */

import { 
  GamePhase, 
  Faction,
} from "@vt/data";

// 使用any类型绕过TypeScript导入问题
type ShipJSON = any;
type WeaponJSON = any;

import type { 
  GameState, 
  PlayerState, 
} from "../types/common.js";

import type { 
  TokenState, 
  ShipTokenState,
} from "./Token.js";

import { 
  createShipTokenState,
  updateShipRuntime,
  applyDamageToShip
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
      tokens: new Map(),      // 使用tokens替代ships
      components: new Map(),  // 组件管理
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

  addToken(token: TokenState): void {
    this.state.tokens.set(token.id, token);
  }

  removeToken(tokenId: string): boolean {
    return this.state.tokens.delete(tokenId);
  }

  getToken(tokenId: string): TokenState | undefined {
    return this.state.tokens.get(tokenId);
  }

  getShipToken(tokenId: string): ShipTokenState | undefined {
    const token = this.state.tokens.get(tokenId);
    return token?.type === "SHIP" ? token as ShipTokenState : undefined;
  }

  updateToken(tokenId: string, updates: Partial<TokenState>): boolean {
    const token = this.state.tokens.get(tokenId);
    if (!token) return false;

    Object.assign(token, updates);
    return true;
  }

  updateShipToken(tokenId: string, runtimeUpdates: any): boolean {
    const shipToken = this.getShipToken(tokenId);
    if (!shipToken) return false;

    const updatedToken = updateShipRuntime(shipToken, runtimeUpdates);
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
    
    // 回合结束时更新所有组件冷却
    this.updateAllComponentCooldowns();
    
    // 重置Token移动状态
    this.resetTokenTurnStates();
    
    // 更新所有武器状态（处理 "FIRED" → "READY"/"COOLDOWN" 转换）
    this.updateAllWeaponStates();
    
    // 处理辐能系统（辐散、过载结束）
    this.processAllFluxAtTurnEnd();
  }



  // ==================== 查询接口 ====================

  getAllPlayers(): PlayerState[] {
    return Array.from(this.state.players.values());
  }

  getAllTokens(): TokenState[] {
    return Array.from(this.state.tokens.values());
  }

  getShipTokens(): ShipTokenState[] {
    return this.getAllTokens()
      .filter(token => token.type === "SHIP")
      .map(token => token as ShipTokenState);
  }

  getTokensByFaction(faction: string): TokenState[] {
    return this.getAllTokens().filter(token => 
      token.metadata.faction === faction
    );
  }

  getShipTokensByFaction(faction: string): ShipTokenState[] {
    return this.getShipTokens().filter(ship => 
      ship.runtime.faction === faction
    );
  }

  getAliveShipTokens(): ShipTokenState[] {
    return this.getShipTokens().filter(ship => !ship.runtime.destroyed);
  }

  getPlayerTokens(playerId: string): TokenState[] {
    return this.getAllTokens().filter(token => 
      token.metadata.ownerId === playerId
    );
  }

  getPlayerShipTokens(playerId: string): ShipTokenState[] {
    return this.getShipTokens().filter(ship => 
      ship.runtime.ownerId === playerId
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

  applyDamageToShip(
    shipTokenId: string,
    damage: number,
    armorDamage: number,
    armorQuadrant: number,
    fluxGenerated: number,
    shieldHit: boolean
  ): boolean {
    const shipToken = this.getShipToken(shipTokenId);
    if (!shipToken) return false;

    const updatedToken = applyDamageToShip(
      shipToken,
      damage,
      armorDamage,
      armorQuadrant,
      fluxGenerated,
      shieldHit
    );

    this.state.tokens.set(shipTokenId, updatedToken);
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

    // 检查回合权限
    if (actionType.startsWith("TURN_") && this.state.activeFaction !== player.faction) {
      return { valid: false, error: "不是当前行动阵营" };
    }

    return { valid: true };
  }

  // ==================== 工具方法 ====================

  isGameOver(): boolean {
    const aliveShips = this.getAliveShipTokens();
    const playerShips = aliveShips.filter(ship => ship.runtime.faction === Faction.PLAYER);
    const enemyShips = aliveShips.filter(ship => ship.runtime.faction === Faction.ENEMY);

    return playerShips.length === 0 || enemyShips.length === 0;
  }

  getWinner(): string | null {
    if (!this.isGameOver()) return null;

    const aliveShips = this.getAliveShipTokens();
    const playerShips = aliveShips.filter(ship => ship.runtime.faction === Faction.PLAYER);
    
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
        const shipToken = token as ShipTokenState;
        if (!shipToken.runtime.destroyed) {
          // 使用 flux.ts 中的 processTurnEndFlux 函数
          processTurnEndFlux(shipToken);
        }
      }
    }
  }

  private resetTokenTurnStates(): void {
    for (const [tokenId, token] of this.state.tokens.entries()) {
      if (token.type === "SHIP") {
        const shipToken = token as ShipTokenState;
        const updatedToken = updateShipRuntime(shipToken, {
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
        const shipToken = token as ShipTokenState;
        if (shipToken.runtime.weapons) {
          const updatedWeapons = shipToken.runtime.weapons.map((weaponRuntime: any) => {
            // 找到对应的武器规格
            const mount = shipToken.shipJson.ship.mounts?.find(
              (m: any) => m.id === weaponRuntime.mountId
            );
            const weaponSpec = mount
              ? typeof mount.weapon === "object"
                ? mount.weapon
                : weaponRuntime.weapon
              : weaponRuntime.weapon;
            return updateWeaponStateAtTurnEnd(weaponRuntime, weaponSpec || undefined) || weaponRuntime;
          });

          const updatedToken = updateShipRuntime(shipToken, {
            weapons: updatedWeapons,
          });
          this.state.tokens.set(tokenId, updatedToken);
        }
      }
    }
  }

  // ==================== 工厂方法 ====================

  createShipTokenFromJson(
    shipJson: ShipJSON,
    position: { x: number; y: number },
    heading: number = 0,
    faction?: string,
    ownerId?: string
  ): ShipTokenState {
    const tokenId = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return createShipTokenState(tokenId, shipJson, position, heading, faction as any, ownerId);
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

  addShipWithComponents(
    shipJson: ShipJSON,
    position: { x: number; y: number },
    heading: number = 0,
    faction?: string,
    ownerId?: string
  ): { shipToken: ShipTokenState; components: WeaponComponentState[] } {
    // 创建舰船Token
    const shipToken = this.createShipTokenFromJson(shipJson, position, heading, faction, ownerId);
    this.addToken(shipToken);

    // 创建武器组件
    const components: WeaponComponentState[] = [];
    const spec = shipJson.ship;
    
    if (spec.mounts) {
      for (const mount of spec.mounts) {
        if (mount.weapon && typeof mount.weapon !== "string") {
          const weaponComponent = this.createWeaponComponentFromJson(
            mount.weapon,
            mount.id,
            shipToken.id
          );
          this.addComponent(weaponComponent);
          components.push(weaponComponent);
        }
      }
    }

    return { shipToken, components };
  }

  removeShipWithComponents(shipTokenId: string): boolean {
    const shipToken = this.getShipToken(shipTokenId);
    if (!shipToken) return false;

    // 移除舰船Token
    this.removeToken(shipTokenId);

    // 移除相关组件
    const components = this.getComponentsByToken(shipTokenId);
    for (const component of components) {
      this.removeComponent(component.id);
    }

    return true;
  }
}
