/**
 * 玩家档案服务
 */

import { MemoryStorage } from "../storage/MemoryStorage.js";
import { AssetService } from "./AssetService.js";

// 使用构建后的类型
// 简化类型定义
type PlayerProfile = any;
type GameSave = any;
type SaveCreationRequest = any;
type SaveUpdateRequest = any;
type SaveListItem = any;
type SaveExport = any;
type ShipJSON = any;
type WeaponJSON = any;

// 存档统计类型
interface SaveStats {
  total: number;
  byTag: Record<string, number>;
  totalSize: number;
  oldest: Date | null;
  newest: Date | null;
}

// 清理选项类型
interface CleanupOptions {
  maxAgeDays?: number;
  maxCount?: number;
  keepTags?: string[];
}

// 清理结果类型
interface CleanupResult {
  deleted: string[];
  kept: string[];
}

// 批量删除结果类型
interface BatchDeleteResult {
  success: string[];
  failed: string[];
}

export class PlayerProfileService {
  private storage: MemoryStorage;
  
  constructor(storage: MemoryStorage) {
    this.storage = storage;
  }
  
  // ========== 玩家档案管理 ==========
  
  async getOrCreateProfile(userId: string): Promise<PlayerProfile> {
    let profile = await this.storage.getPlayer(`player:${userId}`);
    
    if (!profile) {
      profile = await this.createNewProfile(userId);
      await this.storage.savePlayer(profile);
    }
    
    // 更新最后登录时间
    profile.lastLogin = Date.now();
    await this.storage.savePlayer(profile);
    
    return profile;
  }
  
  private async createNewProfile(userId: string): Promise<PlayerProfile> {
    // 加载预设数据
    const presetShips = await this.loadPresetShips();
    const presetWeapons = await this.loadPresetWeapons();
    
    // 创建玩家专属副本
    const playerShips = presetShips.map(ship => {
      const baseMeta = ship.metadata || { name: '未命名舰船' };
      return {
        ...ship,
        $id: `ship:player_${userId}_${ship.$id.replace('preset:', '')}`,
        metadata: {
          name: baseMeta.name,
          description: baseMeta.description || '',
          author: baseMeta.author || '',
          createdAt: baseMeta.createdAt || Date.now(),
          updatedAt: baseMeta.updatedAt || Date.now(),
          tags: [...(baseMeta.tags || []), 'preset'],
          owner: `player:${userId}`,
          isPresetCopy: true,
          originalPresetId: ship.$id
        }
      };
    });
    
    const playerWeapons = presetWeapons.map(weapon => {
      const baseMeta = weapon.metadata || { name: '未命名武器' };
      return {
        ...weapon,
        $id: `weapon:player_${userId}_${weapon.$id.replace('preset:', '')}`,
        metadata: {
          name: baseMeta.name,
          description: baseMeta.description || '',
          author: baseMeta.author || '',
          createdAt: baseMeta.createdAt || Date.now(),
          updatedAt: baseMeta.updatedAt || Date.now(),
          tags: [...(baseMeta.tags || []), 'preset'],
          owner: `player:${userId}`,
          isPresetCopy: true,
          originalPresetId: weapon.$id
        }
      };
    });
    
    return {
      $schema: 'player-v1',
      $id: `player:${userId}`,
      username: userId,
      displayName: userId,
      ships: playerShips,
      weapons: playerWeapons,
      saves: [],
      stats: {
        gamesPlayed: 0,
        wins: 0,
        totalDamage: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  
  // ========== 舰船管理 ==========
  
  async createCustomShip(
    userId: string,
    baseShipId: string,
    name: string
  ): Promise<ShipJSON> {
    const baseShip = await this.storage.getPlayerShip(`player:${userId}`, baseShipId);
    if (!baseShip) {
      throw new Error('Base ship not found');
    }
    
    const customShip: ShipJSON = {
      ...baseShip,
      $id: `ship:custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        ...baseShip.metadata,
        name,
        isPresetCopy: false,
        tags: ['custom']
      }
    };
    
    await this.storage.savePlayerShip(`player:${userId}`, customShip);
    return customShip;
  }
  
  async updateShip(
    userId: string,
    shipId: string,
    updates: Partial<ShipJSON>
  ): Promise<ShipJSON | null> {
    const ship = await this.storage.getPlayerShip(`player:${userId}`, shipId);
    if (!ship) return null;
    
    const updatedShip: ShipJSON = {
      ...ship,
      ...updates,
      metadata: {
        ...ship.metadata,
        ...updates['metadata']
      }
    };
    
    await this.storage.savePlayerShip(`player:${userId}`, updatedShip);
    return updatedShip;
  }
  
  async restorePresetShip(userId: string, shipId: string): Promise<ShipJSON | null> {
    const ship = await this.storage.getPlayerShip(`player:${userId}`, shipId);
    if (!ship || !ship.metadata.isPresetCopy) {
      return null;
    }
    
    const originalPresetId = ship.metadata.originalPresetId;
    if (!originalPresetId) return null;
    
    // 重新加载预设
    const presetShips = await this.loadPresetShips();
    const presetShip = presetShips.find(s => s.$id === originalPresetId);
    if (!presetShip) return null;
    
    // 恢复为预设副本
    const baseMeta = presetShip.metadata || { name: '未命名舰船' };
    const restoredShip: ShipJSON = {
      ...presetShip,
      $id: shipId,  // 保持相同ID
      metadata: {
        name: baseMeta.name,
        description: baseMeta.description || '',
        author: baseMeta.author || '',
        createdAt: baseMeta.createdAt || Date.now(),
        updatedAt: baseMeta.updatedAt || Date.now(),
        tags: [...(baseMeta.tags || []), 'preset'],
        owner: `player:${userId}`,
        isPresetCopy: true,
        originalPresetId
      }
    };
    
    await this.storage.savePlayerShip(`player:${userId}`, restoredShip);
    return restoredShip;
  }
  
  async getPlayerShip(userId: string, shipId: string): Promise<ShipJSON | null> {
    return this.storage.getPlayerShip(`player:${userId}`, shipId);
  }
  
  async listPlayerShips(userId: string, filter?: { tags?: string[] }): Promise<ShipJSON[]> {
    const profile = await this.getOrCreateProfile(userId);
    
    let ships = profile.ships;
    
    if (filter?.tags) {
      ships = ships.filter((ship: ShipJSON) => 
        filter.tags!.every(tag => ship.metadata.tags?.includes(tag))
      );
    }
    
    return ships;
  }
  
  // ========== 武器管理 ==========
  
  async createCustomWeapon(
    userId: string,
    baseWeaponId: string,
    name: string
  ): Promise<WeaponJSON> {
    const baseWeapon = await this.storage.getPlayerWeapon(`player:${userId}`, baseWeaponId);
    if (!baseWeapon) {
      throw new Error('Base weapon not found');
    }
    
    const customWeapon: WeaponJSON = {
      ...baseWeapon,
      $id: `weapon:custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        ...baseWeapon.metadata,
        name,
        isPresetCopy: false,
        tags: ['custom']
      }
    };
    
    await this.storage.savePlayerWeapon(`player:${userId}`, customWeapon);
    return customWeapon;
  }
  
  async getPlayerWeapon(userId: string, weaponId: string): Promise<WeaponJSON | null> {
    return this.storage.getPlayerWeapon(`player:${userId}`, weaponId);
  }
  
  async restorePresetWeapon(userId: string, weaponId: string): Promise<WeaponJSON | null> {
    const weapon = await this.storage.getPlayerWeapon(`player:${userId}`, weaponId);
    if (!weapon || !weapon.metadata?.isPresetCopy) {
      return null;
    }
    
    const originalPresetId = weapon.metadata?.originalPresetId;
    if (!originalPresetId) return null;
    
    const presetWeapons = await this.loadPresetWeapons();
    const presetWeapon = presetWeapons.find(w => w.$id === originalPresetId);
    if (!presetWeapon) return null;
    
    const baseMeta = presetWeapon.metadata || { name: '未命名武器' };
    const restoredWeapon: WeaponJSON = {
      ...presetWeapon,
      $id: weaponId,
      metadata: {
        name: baseMeta.name,
        description: baseMeta.description || '',
        author: baseMeta.author || '',
        createdAt: baseMeta.createdAt || Date.now(),
        updatedAt: baseMeta.updatedAt || Date.now(),
        tags: [...(baseMeta.tags || []), 'preset'],
        owner: `player:${userId}`,
        isPresetCopy: true,
        originalPresetId
      }
    };
    
    await this.storage.savePlayerWeapon(`player:${userId}`, restoredWeapon);
    return restoredWeapon;
  }
  
  // ========== 存档管理 ==========
  
  // ========== 存档管理 ==========
  
  async createSave(
    userId: string,
    request: SaveCreationRequest,
    gameState: any
  ): Promise<GameSave> {
    const playerId = `player:${userId}`;
    
    // 提取玩家信息
    const players = this.extractPlayerInfo(gameState);
    
    const save: GameSave = {
      $schema: 'save-v1',
      $id: `save:${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      metadata: {
        name: request.name,
        description: request.description || '',
        tags: request.tags || ['auto-save'],
        thumbnail: request.thumbnail
      },
      gameState,
      gameInfo: {
        turn: gameState.turn || 1,
        phase: gameState.phase || 'DEPLOYMENT',
        activeFaction: gameState.activeFaction,
        playerCount: players.length,
        mapSize: gameState.mapSize || { width: 2000, height: 2000 },
        victoryCondition: gameState.victoryCondition,
        gameMode: gameState.gameMode || 'STANDARD',
        scenario: gameState.scenario
      },
      players,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalTurns: gameState.turn || 1,
        totalDamage: this.calculateTotalDamage(gameState),
        shipsDestroyed: this.countDestroyedShips(gameState),
        totalShips: this.countTotalShips(gameState),
        totalPlayers: players.length
      }
    };
    
    await this.storage.savePlayerSave(playerId, save);
    return save;
  }
  
  async createSaveFromGame(
    userId: string,
    name: string,
    description: string,
    gameState: any
  ): Promise<GameSave> {
    const request: SaveCreationRequest = {
      name,
      description,
      tags: ['manual-save'],
      gameState
    };
    
    return this.createSave(userId, request, gameState);
  }
  
  async updateSave(
    userId: string,
    saveId: string,
    updates: SaveUpdateRequest
  ): Promise<GameSave | null> {
    const save = await this.loadSave(userId, saveId);
    if (!save) return null;
    
    // 更新元数据
    if (updates.name !== undefined) save.metadata.name = updates.name;
    if (updates.description !== undefined) save.metadata.description = updates.description;
    if (updates.tags !== undefined) save.metadata.tags = updates.tags;
    if (updates.thumbnail !== undefined) save.metadata.thumbnail = updates.thumbnail;
    
    save.updatedAt = Date.now();
    
    await this.storage.savePlayerSave(`player:${userId}`, save);
    return save;
  }
  
  async loadSave(userId: string, saveId: string): Promise<GameSave | null> {
    const save = await this.storage.getPlayerSave(`player:${userId}`, saveId);
    
    if (save) {
      // 更新最后加载时间
      save.lastLoaded = Date.now();
      await this.storage.savePlayerSave(`player:${userId}`, save);
    }
    
    return save;
  }
  
  async getSaveInfo(userId: string, saveId: string): Promise<SaveListItem | null> {
    const save = await this.loadSave(userId, saveId);
    if (!save) return null;
    
    return {
      $id: save.$id,
      metadata: save.metadata,
      gameInfo: {
        turn: save.gameInfo.turn,
        phase: save.gameInfo.phase,
        playerCount: save.gameInfo.playerCount,
        mapSize: save.gameInfo.mapSize,
        gameMode: save.gameInfo.gameMode
      },
      createdAt: save.createdAt,
      updatedAt: save.updatedAt,
      lastLoaded: save.lastLoaded,
      size: this.calculateSaveSize(save)
    };
  }
  
  async deleteSave(userId: string, saveId: string): Promise<boolean> {
    return this.storage.deletePlayerSave(`player:${userId}`, saveId);
  }
  
  async deleteSaves(userId: string, saveIds: string[]): Promise<BatchDeleteResult> {
    const results = { success: [] as string[], failed: [] as string[] };
    
    for (const saveId of saveIds) {
      try {
        const deleted = await this.deleteSave(userId, saveId);
        if (deleted) {
          results.success.push(saveId);
        } else {
          results.failed.push(saveId);
        }
      } catch (error) {
        results.failed.push(saveId);
      }
    }
    
    return results;
  }
  
  async duplicateSave(userId: string, saveId: string, newName?: string): Promise<GameSave | null> {
    const originalSave = await this.loadSave(userId, saveId);
    if (!originalSave) return null;
    
    const newSave: GameSave = {
      ...originalSave,
      $id: `save:${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      metadata: {
        ...originalSave.metadata,
        name: newName || `${originalSave.metadata.name} (副本)`,
        tags: [...(originalSave.metadata.tags || []), 'duplicate']
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await this.storage.savePlayerSave(`player:${userId}`, newSave);
    return newSave;
  }
  
  async listSaves(userId: string, filter?: { tags?: string[], search?: string, sortBy?: 'createdAt' | 'updatedAt' | 'name', sortOrder?: 'asc' | 'desc' }): Promise<SaveListItem[]> {
    const saves = await this.storage.listPlayerSaves(`player:${userId}`);
    
    let filteredSaves = saves;
    
    // 应用标签过滤
    if (filter?.tags && filter.tags.length > 0) {
      filteredSaves = filteredSaves.filter(save => 
        filter.tags!.some(tag => save.metadata.tags?.includes(tag))
      );
    }
    
    // 应用搜索过滤
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filteredSaves = filteredSaves.filter(save => 
        save.metadata.name.toLowerCase().includes(searchLower) ||
        (save.metadata.description && save.metadata.description.toLowerCase().includes(searchLower))
      );
    }
    
    // 应用排序
    const sortBy = filter?.sortBy || 'updatedAt';
    const sortOrder = filter?.sortOrder || 'desc';
    
    filteredSaves.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.metadata.name.toLowerCase();
          bValue = b.metadata.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.updatedAt || a.createdAt;
          bValue = b.updatedAt || b.createdAt;
          break;
        default:
          aValue = a.updatedAt || a.createdAt;
          bValue = b.updatedAt || b.createdAt;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    // 转换为列表项格式
    return filteredSaves.map(save => ({
      $id: save.$id,
      metadata: save.metadata,
      gameInfo: {
        turn: save.gameInfo.turn,
        phase: save.gameInfo.phase,
        playerCount: save.gameInfo.playerCount,
        mapSize: save.gameInfo.mapSize,
        gameMode: save.gameInfo.gameMode
      },
      createdAt: save.createdAt,
      updatedAt: save.updatedAt,
      lastLoaded: save.lastLoaded,
      size: this.calculateSaveSize(save)
    }));
  }
  
  async getSaveCount(userId: string): Promise<number> {
    const saves = await this.storage.listPlayerSaves(`player:${userId}`);
    return saves.length;
  }
  
  async getSaveStats(userId: string): Promise<SaveStats> {
    const saves = await this.storage.listPlayerSaves(`player:${userId}`);
    
    if (saves.length === 0) {
      return {
        total: 0,
        byTag: {},
        totalSize: 0,
        oldest: null,
        newest: null
      };
    }
    
    const byTag: Record<string, number> = {};
    let totalSize = 0;
    let oldestDate = saves[0].createdAt;
    let newestDate = saves[0].createdAt;
    
    for (const save of saves) {
      // 统计标签
      if (save.metadata.tags && Array.isArray(save.metadata.tags)) {
        for (const tag of save.metadata.tags) {
          if (typeof tag === 'string') {
            byTag[tag] = (byTag[tag] || 0) + 1;
          }
        }
      }
      
      // 计算总大小
      totalSize += this.calculateSaveSize(save);
      
      // 查找最旧和最新的存档
      if (save.createdAt < oldestDate) oldestDate = save.createdAt;
      if (save.createdAt > newestDate) newestDate = save.createdAt;
    }
    
    return {
      total: saves.length,
      byTag,
      totalSize,
      oldest: new Date(oldestDate),
      newest: new Date(newestDate)
    };
  }
  
  async cleanupOldSaves(userId: string, options: CleanupOptions): Promise<CleanupResult> {
    const saves = await this.storage.listPlayerSaves(`player:${userId}`);
    
    if (saves.length === 0) {
      return { deleted: [], kept: [] };
    }
    
    const maxCount = options.maxCount;
    const keepTags = options.keepTags || [];
    // 当前未使用，保留供未来扩展
    // const now = Date.now();
    // const maxAgeMs = options.maxAgeDays ? options.maxAgeDays * 24 * 60 * 60 * 1000 : undefined;
    
    // 首先，标记必须保留的存档（带保留标签的）
    const mustKeep = new Set<string>();
    const candidates: Array<{ id: string; time: number; tags: string[] }> = [];
    
    for (const save of saves) {
      const saveTags = save.metadata.tags || [];
      const saveTime = save.updatedAt || save.createdAt;
      
      // 检查是否必须保留（带保留标签）
      const hasKeepTag = keepTags.length > 0 && saveTags.some((tag: string) => keepTags.includes(tag));
      
      if (hasKeepTag) {
        mustKeep.add(save.$id);
      }
      
      // 检查是否因年龄而保留（当前未使用，保留供未来扩展）
      // const isWithinAge = maxAgeMs ? (now - saveTime) < maxAgeMs : true;
      
      candidates.push({
        id: save.$id,
        time: saveTime,
        tags: saveTags
      });
    }
    
    // 按时间排序（从新到旧）
    candidates.sort((a, b) => b.time - a.time);
    
    const toKeep: string[] = [];
    const toDelete: string[] = [];
    
    // 首先添加必须保留的
    for (const candidate of candidates) {
      if (mustKeep.has(candidate.id)) {
        toKeep.push(candidate.id);
      }
    }
    
    // 然后添加其他存档，直到达到最大数量
    for (const candidate of candidates) {
      if (!mustKeep.has(candidate.id)) {
        if (maxCount === undefined || toKeep.length < maxCount) {
          toKeep.push(candidate.id);
        } else {
          toDelete.push(candidate.id);
        }
      }
    }
    
    // 如果设置了最大数量且超过了，删除最旧的（不包括必须保留的）
    if (maxCount !== undefined && toKeep.length > maxCount) {
      // 重新排序：必须保留的在前，然后按时间从新到旧
      const sortedToKeep = [...toKeep].sort((aId, bId) => {
        const aMustKeep = mustKeep.has(aId);
        const bMustKeep = mustKeep.has(bId);
        
        if (aMustKeep && !bMustKeep) return -1;
        if (!aMustKeep && bMustKeep) return 1;
        
        const aCandidate = candidates.find(c => c.id === aId);
        const bCandidate = candidates.find(c => c.id === bId);
        return (bCandidate?.time || 0) - (aCandidate?.time || 0);
      });
      
      // 保留前maxCount个
      const newToKeep = sortedToKeep.slice(0, maxCount);
      const newToDelete = [...toDelete, ...sortedToKeep.slice(maxCount)];
      
      // 执行删除
      const deleteResults = await this.deleteSaves(userId, newToDelete);
      return {
        deleted: deleteResults.success,
        kept: newToKeep
      };
    }
    
    // 执行删除
    const deleteResults = await this.deleteSaves(userId, toDelete);
    return {
      deleted: deleteResults.success,
      kept: toKeep
    };
  }
  
  async exportSave(userId: string, saveId: string): Promise<SaveExport | null> {
    const save = await this.loadSave(userId, saveId);
    if (!save) return null;
    
    return {
      $schema: 'save-export-v1',
      save,
      exportedAt: Date.now(),
      exportedBy: userId,
      gameVersion: '1.0.0' // TODO: 从配置获取实际版本
    };
  }
  
  async importSave(userId: string, saveExport: SaveExport): Promise<GameSave | null> {
    const save = saveExport.save;
    
    // 修改存档ID为当前用户
    save.$id = `save:${userId}_${Date.now()}_imported`;
    save.createdAt = Date.now();
    
    // 可选：修改玩家信息为当前用户
    // 这里可以根据需要调整玩家数据
    
    await this.storage.savePlayerSave(`player:${userId}`, save);
    return save;
  }
  
  // ========== 辅助方法 ==========
  
  private extractPlayerInfo(gameState: any): Array<{
    id: string;
    name: string;
    faction: string;
    role: string;
    ships: string[];
    score?: number;
  }> {
    const players: Array<{
      id: string;
      name: string;
      faction: string;
      role: string;
      ships: string[];
      score?: number;
    }> = [];
    
    if (gameState.players && typeof gameState.players === 'object') {
      // 处理Map或普通对象
      const playerMap = gameState.players instanceof Map 
        ? gameState.players 
        : new Map(Object.entries(gameState.players));
      
      playerMap.forEach((player: any, id: string) => {
        players.push({
          id,
          name: player.name || id,
          faction: player.faction || 'NEUTRAL',
          role: player.role || 'PLAYER',
          ships: player.ships || [],
          score: player.score
        });
      });
    }
    
    return players;
  }
  
  private calculateTotalDamage(_gameState: any): number {
    // 简化实现：从游戏状态计算总伤害
    // TODO: 实现实际的计算逻辑
    return 0;
  }
  
  private countDestroyedShips(_gameState: any): number {
    // 简化实现：计算被摧毁的舰船数量
    // TODO: 实现实际的计算逻辑
    return 0;
  }
  
  private countTotalShips(_gameState: any): number {
    // 简化实现：计算总舰船数量
    // TODO: 实现实际的计算逻辑
    return 0;
  }
  
  private calculateSaveSize(save: GameSave): number {
    // 估算存档大小
    const jsonString = JSON.stringify(save);
    return new Blob([jsonString]).size;
  }
  
  // ========== 资产上传（已迁移到AssetService） ==========
  
  // 注意：这些方法已迁移到AssetService
  // 保留向后兼容的接口，实际调用AssetService
  
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    // 创建AssetService实例
    const assetService = new AssetService(this.storage);
    return assetService.uploadAvatar(userId, buffer, filename, mimeType);
  }
  
  async uploadShipTexture(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    // 创建AssetService实例
    const assetService = new AssetService(this.storage);
    return assetService.uploadShipTexture(userId, buffer, filename, mimeType);
  }
  
  async getAssetData(assetId: string): Promise<Buffer | null> {
    // 创建AssetService实例
    const assetService = new AssetService(this.storage);
    return assetService.getAssetData(assetId);
  }
  
  // ========== 预设加载（简化实现） ==========
  
  private async loadPresetShips(): Promise<ShipJSON[]> {
    // 硬编码预设舰船
    return [
      {
        $schema: 'ship-v2',
        $id: 'preset:frigate_001',
        ship: {
          size: 'FRIGATE',
          class: 'STRIKE',
          maxHitPoints: 1000,
          armorMaxPerQuadrant: 200,
          maxSpeed: 120,
          maxTurnRate: 90,
          fluxCapacity: 500,
          fluxDissipation: 100,
          mounts: [
            {
              id: 'mount_1',
              position: { x: 0, y: 20 },
              mountType: 'HARDPOINT',
              size: 'SMALL'
            }
          ]
        },
        metadata: {
          name: '基础护卫舰',
          description: '标准护卫舰型号'
        }
      },
      {
        $schema: 'ship-v2',
        $id: 'preset:destroyer_001',
        ship: {
          size: 'DESTROYER',
          class: 'ASSAULT',
          maxHitPoints: 2000,
          armorMaxPerQuadrant: 300,
          maxSpeed: 100,
          maxTurnRate: 75,
          fluxCapacity: 800,
          fluxDissipation: 150,
          mounts: [
            {
              id: 'mount_1',
              position: { x: -15, y: 30 },
              mountType: 'HARDPOINT',
              size: 'MEDIUM'
            },
            {
              id: 'mount_2',
              position: { x: 15, y: 30 },
              mountType: 'HARDPOINT',
              size: 'SMALL'
            }
          ]
        },
        metadata: {
          name: '基础驱逐舰',
          description: '标准驱逐舰型号'
        }
      }
    ];
  }
  
  private async loadPresetWeapons(): Promise<WeaponJSON[]> {
    // 硬编码预设武器
    return [
      {
        $schema: 'weapon-v2',
        $id: 'preset:light_cannon',
        weapon: {
          category: 'BALLISTIC',
          damageType: 'KINETIC',
          size: 'SMALL',
          damage: 100,
          range: 800,
          fluxCostPerShot: 50,
          cooldown: 1
        },
        metadata: {
          name: '轻型加农炮',
          description: '标准动能武器'
        }
      },
      {
        $schema: 'weapon-v2',
        $id: 'preset:heavy_cannon',
        weapon: {
          category: 'BALLISTIC',
          damageType: 'KINETIC',
          size: 'MEDIUM',
          damage: 200,
          range: 1000,
          fluxCostPerShot: 100,
          cooldown: 2
        },
        metadata: {
          name: '重型加农炮',
          description: '高威力动能武器'
        }
      },
      {
        $schema: 'weapon-v2',
        $id: 'preset:laser',
        weapon: {
          category: 'ENERGY',
          damageType: 'ENERGY',
          size: 'SMALL',
          damage: 80,
          range: 600,
          fluxCostPerShot: 30,
          cooldown: 0
        },
        metadata: {
          name: '激光炮',
          description: '能量武器，无冷却'
        }
      }
    ];
  }
}