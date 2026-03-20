/**
 * 游戏房间实现
 *
 * 定义所有游戏操作：
 * - 玩家管理：join, leave, kick, setOwner
 * - 阵营系统：selectFaction, endTurn, cancelEndTurn
 * - 游戏流程：startGame, endGame, advancePhase
 * - 素材放置：spawnToken, removeToken, setTokenController
 * - 移动系统：moveShip, endShipAction
 * - 战斗系统：attack, ventFlux, toggleShield
 */

import { Room } from './Room';
import { op, onlyOwner, onlyDM } from '@vt/shared/room';
import { getTemplate, isTemplateAvailable } from '@vt/shared/room/assets';
import type {
  OperationMap,
  FactionId,
  ArmorQuadrant,
  Point,
} from '@vt/shared/types';
import type { TokenState, TokenType } from '@vt/shared/room';

// ==================== 辅助函数 ====================

/** 创建默认装甲 */
function createDefaultArmor(value: number): Record<ArmorQuadrant, number> {
  return {
    FRONT_TOP: value,
    FRONT_BOTTOM: value,
    LEFT_TOP: value,
    LEFT_BOTTOM: value,
    RIGHT_TOP: value,
    RIGHT_BOTTOM: value,
  };
}

/** 从模板创建 Token */
function createTokenFromTemplate(
  templateId: string,
  tokenId: string,
  position: Point,
  heading: number,
  controllingPlayerId: string | null,
  faction: FactionId | null,
  name?: string
): TokenState {
  const template = getTemplate(templateId);
  
  if (!template) {
    // 默认配置
    return {
      id: tokenId,
      type: 'ship',
      faction,
      position,
      heading,
      size: 50,
      controllingPlayerId,
      isEnemy: false,
      hull: 100,
      maxHull: 100,
      armor: createDefaultArmor(100),
      maxArmor: 100,
      shield: 100,
      maxShield: 100,
      flux: 0,
      maxFlux: 100,
      isShieldOn: true,
      isOverloaded: false,
      hasActed: false,
      movementRemaining: 3,
      name: name || `舰船 ${tokenId.slice(-4)}`,
      templateId,
    };
  }

  const config = template.config;
  const actualFaction = faction ?? template.faction;

  return {
    id: tokenId,
    type: template.type,
    faction: actualFaction,
    position,
    heading,
    size: config.size,
    controllingPlayerId,
    isEnemy: template.isEnemy,
    hull: config.hull,
    maxHull: config.hull,
    armor: createDefaultArmor(config.armor),
    maxArmor: config.armor,
    shield: config.shield,
    maxShield: config.shield,
    flux: 0,
    maxFlux: config.flux,
    isShieldOn: config.shield > 0,
    isOverloaded: false,
    hasActed: false,
    movementRemaining: 3,
    name: name || template.name,
    templateId,
  };
}

// ==================== 武器配置 ====================

const DEFAULT_WEAPONS = [
  { id: 'auto_cannon', name: '自动炮', damage: 20, range: 500, fluxCost: 10 },
  { id: 'pulse_laser', name: '脉冲激光', damage: 30, range: 600, fluxCost: 20 },
  { id: 'harpoon', name: '鱼叉导弹', damage: 50, range: 800, fluxCost: 30 },
];

// ==================== 操作定义 ====================

export const GameRoomOperations = {
  // ==================== 玩家管理 ====================

  join: op((state, clientId, name: string) => {
    if (Object.keys(state.players).length >= 8) {
      throw new Error('房间已满');
    }

    if (state.players[clientId]) {
      state.players[clientId].isConnected = true;
      state.players[clientId].name = name || state.players[clientId].name;
      return;
    }

    state.players[clientId] = {
      id: clientId,
      name,
      isDM: false,
      faction: null,
      isReady: false,
      isConnected: true,
    };
  }),

  leave: op((state, clientId) => {
    delete state.players[clientId];

    // 清理该玩家控制的 Token
    for (const [tokenId, token] of Object.entries(state.game.tokens)) {
      if (token.controllingPlayerId === clientId) {
        token.controllingPlayerId = null;
      }
    }

    // 清理选择状态
    delete state.game.selectedTargets[clientId];
    delete state.game.selectedWeapons[clientId];
    delete state.game.selectedQuadrants[clientId];

    // 转移房主
    if (state.meta.ownerId === clientId) {
      const nextOwner = Object.keys(state.players)[0];
      if (nextOwner) {
        state.meta.ownerId = nextOwner;
        state.players[nextOwner].isDM = true;
      } else {
        state.meta.ownerId = '';
      }
    }
  }),

  kick: onlyOwner((state, _clientId, targetId: string) => {
    if (!state.players[targetId]) {
      throw new Error('玩家不存在');
    }
    if (targetId === state.meta.ownerId) {
      throw new Error('不能踢出房主');
    }

    delete state.players[targetId];
    delete state.game.selectedTargets[targetId];
    delete state.game.selectedWeapons[targetId];
    delete state.game.selectedQuadrants[targetId];
  }),

  setOwner: onlyOwner((state, _clientId, newOwnerId: string) => {
    if (!state.players[newOwnerId]) {
      throw new Error('玩家不存在');
    }

    const oldOwner = state.players[state.meta.ownerId];
    if (oldOwner) {
      oldOwner.isDM = false;
    }

    state.meta.ownerId = newOwnerId;
    state.players[newOwnerId].isDM = true;
  }),

  // ==================== 阵营系统 ====================

  selectFaction: op((state, clientId, faction: FactionId) => {
    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');
    if (player.isDM) throw new Error('DM 不能选择阵营');

    for (const [id, p] of Object.entries(state.players)) {
      if (id !== clientId && p.faction === faction) {
        throw new Error('阵营已被选择');
      }
    }

    player.faction = faction;
    player.isReady = true;
  }),

  cancelFaction: op((state, clientId) => {
    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');
    if (player.isDM) throw new Error('DM 不能取消阵营');

    player.faction = null;
    player.isReady = false;
  }),

  endTurn: op((state, clientId) => {
    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');
    if (!player.faction) throw new Error('请先选择阵营');

    player.isReady = true;

    for (const token of Object.values(state.game.tokens)) {
      if (token.controllingPlayerId === clientId) {
        token.hasActed = true;
      }
    }
  }),

  cancelEndTurn: op((state, clientId) => {
    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');

    player.isReady = false;

    for (const token of Object.values(state.game.tokens)) {
      if (token.controllingPlayerId === clientId) {
        token.hasActed = false;
      }
    }
  }),

  // ==================== 游戏流程 ====================

  startGame: onlyOwner((state) => {
    const readyPlayers = Object.values(state.players).filter(p => !p.isDM && p.isReady);
    if (readyPlayers.length < 2) {
      throw new Error('至少需要 2 名玩家');
    }

    state.meta.phase = 'deployment';
    state.meta.round = 1;
    state.meta.turnPhase = 'player_action';

    for (const player of Object.values(state.players)) {
      if (!player.isDM) {
        player.isReady = false;
      }
    }
  }),

  startBattle: onlyOwner((state) => {
    const playersWithFaction = Object.values(state.players).filter(p => !p.isDM && p.faction);
    const deployedFactions = new Set(
      Object.values(state.game.tokens)
        .filter(t => t.type === 'ship' && !t.isEnemy)
        .map(t => t.faction)
    );

    for (const player of playersWithFaction) {
      if (player.faction && !deployedFactions.has(player.faction)) {
        throw new Error(`${player.name} 尚未部署舰船`);
      }
    }

    state.meta.phase = 'playing';
    state.meta.turnPhase = 'player_action';

    const factions = Array.from(deployedFactions) as FactionId[];
    for (let i = factions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [factions[i], factions[j]] = [factions[j], factions[i]];
    }

    state.meta.currentFactionTurn = factions[0] || null;
  }),

  endGame: onlyOwner((state, _clientId, winner?: FactionId) => {
    state.meta.phase = 'ended';
  }),

  advancePhase: onlyDM((state) => {
    const phases: Array<'player_action' | 'dm_action' | 'resolution'> =
      ['player_action', 'dm_action', 'resolution'];
    const currentIndex = phases.indexOf(state.meta.turnPhase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];

    state.meta.turnPhase = nextPhase;

    if (nextPhase === 'player_action') {
      state.meta.round++;

      for (const token of Object.values(state.game.tokens)) {
        token.hasActed = false;
        token.movementRemaining = 3;

        const dissipation = token.maxFlux * 0.1;
        token.flux = Math.max(0, token.flux - dissipation);

        if (token.isOverloaded && token.flux < token.maxFlux * 0.5) {
          token.isOverloaded = false;
        }
      }

      for (const player of Object.values(state.players)) {
        player.isReady = false;
      }

      const factions = [...new Set(
        Object.values(state.game.tokens)
          .filter(t => t.type === 'ship' && !t.isEnemy)
          .map(t => t.faction)
      )] as FactionId[];

      if (factions.length > 0) {
        const currentIndex = factions.indexOf(state.meta.currentFactionTurn as FactionId);
        state.meta.currentFactionTurn = factions[(currentIndex + 1) % factions.length];
      }
    }
  }),

  // ==================== 素材放置 ====================

  /**
   * 放置素材（从素材库拖拽）
   * 
   * 权限规则：
   * - DM：全程可用，可放置任何素材
   * - 玩家：仅部署阶段，仅限自己阵营的舰船
   */
  spawnToken: op((state, clientId, templateId: string, tokenId: string, position: Point, heading: number, name?: string) => {
    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');

    const template = getTemplate(templateId);
    if (!template) throw new Error('素材模板不存在');

    // 检查权限
    if (!isTemplateAvailable(template, state.meta.phase, player.isDM, player.faction || undefined)) {
      if (state.meta.phase !== 'deployment') {
        throw new Error('仅部署阶段可放置素材');
      }
      throw new Error('无权使用此素材');
    }

    // 检查数量限制（玩家部署阶段）
    if (!player.isDM && state.meta.phase === 'deployment') {
      const playerShips = Object.values(state.game.tokens).filter(
        t => t.controllingPlayerId === clientId && t.type === 'ship'
      );
      if (playerShips.length >= 3) {
        throw new Error('最多部署 3 艘舰船');
      }
    }

    // 确定阵营和指挥权
    const faction = player.isDM ? template.faction : player.faction;
    const controllingPlayerId = template.isEnemy ? null : (player.isDM ? null : clientId);

    // 创建 Token
    state.game.tokens[tokenId] = createTokenFromTemplate(
      templateId,
      tokenId,
      position,
      heading,
      controllingPlayerId,
      faction,
      name
    );

    return { tokenId, templateId };
  }),

  /** 移除素材 */
  removeToken: op((state, clientId, tokenId: string) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('素材不存在');

    const player = state.players[clientId];
    if (!player) throw new Error('玩家不存在');

    // 权限检查
    if (!player.isDM) {
      // 玩家只能移除自己控制的 Token，且仅在部署阶段
      if (state.meta.phase !== 'deployment') {
        throw new Error('仅部署阶段可移除素材');
      }
      if (token.controllingPlayerId !== clientId) {
        throw new Error('只能移除自己的素材');
      }
    }

    delete state.game.tokens[tokenId];
  }),

  /**
   * 设置指挥权（仅 DM）
   * 
   * DM 可以强制重新指定 Token 的控制玩家
   */
  setTokenController: onlyDM((state, _clientId, tokenId: string, playerId: string | null) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('素材不存在');

    if (playerId !== null) {
      const player = state.players[playerId];
      if (!player) throw new Error('玩家不存在');
    }

    token.controllingPlayerId = playerId;
  }),

  /** 批量设置指挥权 */
  batchSetController: onlyDM((state, _clientId, assignments: Array<{ tokenId: string; playerId: string | null }>) => {
    for (const { tokenId, playerId } of assignments) {
      const token = state.game.tokens[tokenId];
      if (!token) continue;

      if (playerId !== null) {
        const player = state.players[playerId];
        if (!player) continue;
      }

      token.controllingPlayerId = playerId;
    }
  }),

  // ==================== 移动系统 ====================

  moveShip: op((state, clientId, tokenId: string, position: Point, heading?: number) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('舰船不存在');

    // 检查指挥权
    const player = state.players[clientId];
    if (!player?.isDM && token.controllingPlayerId !== clientId) {
      throw new Error('只能移动自己控制的舰船');
    }

    if (token.hasActed) throw new Error('本回合已行动');
    if (token.movementRemaining <= 0) throw new Error('移动点数不足');
    if (token.isOverloaded) throw new Error('舰船已过载，无法移动');

    token.position = position;
    if (heading !== undefined) {
      token.heading = heading;
    }
    token.movementRemaining--;
  }),

  endShipAction: op((state, clientId, tokenId: string) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('舰船不存在');

    const player = state.players[clientId];
    if (!player?.isDM && token.controllingPlayerId !== clientId) {
      throw new Error('只能操作自己控制的舰船');
    }

    token.hasActed = true;
  }),

  // ==================== 战斗系统 ====================

  selectTarget: op((state, clientId, targetId: string) => {
    const target = state.game.tokens[targetId];
    if (!target) throw new Error('目标不存在');

    const targets = state.game.selectedTargets[clientId] || [];
    if (!targets.includes(targetId)) {
      state.game.selectedTargets[clientId] = [...targets, targetId];
    }
  }),

  clearTarget: op((state, clientId, targetId?: string) => {
    if (targetId) {
      const targets = state.game.selectedTargets[clientId] || [];
      state.game.selectedTargets[clientId] = targets.filter(id => id !== targetId);
    } else {
      delete state.game.selectedTargets[clientId];
    }
  }),

  selectWeapon: op((state, clientId, weaponId: string) => {
    state.game.selectedWeapons[clientId] = weaponId;
  }),

  clearWeapon: op((state, clientId) => {
    delete state.game.selectedWeapons[clientId];
  }),

  selectQuadrant: op((state, clientId, quadrant: ArmorQuadrant) => {
    state.game.selectedQuadrants[clientId] = quadrant;
  }),

  clearQuadrant: op((state, clientId) => {
    delete state.game.selectedQuadrants[clientId];
  }),

  attack: op((state, clientId, attackerId: string, targetId: string, weaponId: string, quadrant: ArmorQuadrant) => {
    const attacker = state.game.tokens[attackerId];
    const target = state.game.tokens[targetId];

    if (!attacker || !target) throw new Error('舰船不存在');

    const player = state.players[clientId];
    if (!player?.isDM && attacker.controllingPlayerId !== clientId) {
      throw new Error('只能操作自己控制的舰船');
    }

    if (attacker.hasActed) throw new Error('本回合已行动');
    if (attacker.isOverloaded) throw new Error('舰船已过载，无法攻击');

    const weapon = DEFAULT_WEAPONS.find(w => w.id === weaponId) || DEFAULT_WEAPONS[0];
    const baseDamage = weapon.damage;

    if (attacker.flux + weapon.fluxCost > attacker.maxFlux) {
      throw new Error('辐能不足，无法开火');
    }

    attacker.flux += weapon.fluxCost;

    let damageToApply = baseDamage;

    if (target.isShieldOn && target.shield > 0) {
      const shieldAbsorb = Math.min(damageToApply, target.shield);
      target.shield -= shieldAbsorb;
      damageToApply -= shieldAbsorb;
      target.flux += shieldAbsorb * 0.5;
    }

    if (damageToApply > 0 && target.armor[quadrant] > 0) {
      const armorDamage = Math.min(damageToApply * 0.5, target.armor[quadrant]);
      target.armor[quadrant] -= armorDamage;
      damageToApply -= armorDamage;
    }

    if (damageToApply > 0) {
      target.hull -= damageToApply;
    }

    if (target.flux >= target.maxFlux && !target.isOverloaded) {
      target.isOverloaded = true;
    }

    attacker.hasActed = true;

    if (target.hull <= 0) {
      delete state.game.tokens[targetId];
      return { destroyed: true, targetId, damage: baseDamage };
    }

    return {
      destroyed: false,
      targetId,
      damage: baseDamage,
      targetFlux: target.flux,
      targetOverloaded: target.isOverloaded,
    };
  }),

  ventFlux: op((state, clientId, tokenId: string) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('舰船不存在');

    const player = state.players[clientId];
    if (!player?.isDM && token.controllingPlayerId !== clientId) {
      throw new Error('只能操作自己控制的舰船');
    }

    if (token.hasActed) throw new Error('本回合已行动');

    token.flux = 0;
    token.isOverloaded = false;
    token.hasActed = true;
  }),

  toggleShield: op((state, clientId, tokenId: string) => {
    const token = state.game.tokens[tokenId];
    if (!token) throw new Error('舰船不存在');

    const player = state.players[clientId];
    if (!player?.isDM && token.controllingPlayerId !== clientId) {
      throw new Error('只能操作自己控制的舰船');
    }

    if (token.isOverloaded) {
      throw new Error('舰船已过载，无法切换护盾');
    }

    token.isShieldOn = !token.isShieldOn;
  }),

} satisfies OperationMap;

export type GameRoomOperations = typeof GameRoomOperations;

// ==================== GameRoom 类 ====================

export class GameRoom extends Room<GameRoomOperations> {
  constructor(roomId: string, creatorId: string, name?: string) {
    super(roomId, creatorId, GameRoomOperations, name);
  }

  static get roomType() {
    return 'game';
  }

  static get maxPlayers() {
    return 8;
  }
}