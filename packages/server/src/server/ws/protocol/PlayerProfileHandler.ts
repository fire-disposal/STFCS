/**
 * 玩家档案WebSocket处理器
 */

import type { Connection } from "../connection.js";
import type { ConnectionManager } from "../connection.js";
import type { PlayerProfileService } from "../../../services/PlayerProfileService.js";

export class PlayerProfileHandler {
  constructor(
    private connMgr: ConnectionManager,
    private profileService: PlayerProfileService
  ) {}
  
  // ========== 玩家档案操作 ==========
  
  async handleGetProfile(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const profile = await this.profileService.getOrCreateProfile(userId);
      
      // 发送简化信息
      this.sendResponse(conn, 'PLAYER_PROFILE', {
        username: profile.username,
        displayName: profile.displayName,
        avatarAssetId: profile.avatarAssetId,
        stats: profile.stats,
        shipCount: profile.ships.length,
        weaponCount: profile.weapons.length,
        saveCount: profile.saves.length
      }, msg.id);
    } catch (error) {
      this.sendError(conn, 'PROFILE_ERROR', 'Failed to load profile', msg.id);
    }
  }
  
  async handleGetShips(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const filter = msg.payload?.filter;
      const ships = await this.profileService.listPlayerShips(userId, filter);
      
      // 发送舰船列表（简略信息）
      const shipList = ships.map(ship => ({
        id: ship.$id,
        name: ship.metadata.name,
        tags: ship.metadata.tags,
        spec: {
          size: ship.ship.size,
          class: ship.ship.class,
          maxHitPoints: ship.ship.maxHitPoints
        }
      }));
      
      this.sendResponse(conn, 'PLAYER_SHIPS', { ships: shipList }, msg.id);
    } catch (error) {
      this.sendError(conn, 'SHIPS_ERROR', 'Failed to load ships', msg.id);
    }
  }
  
  async handleGetShip(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const shipId = msg.payload?.shipId;
    
    if (!userId || !shipId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const ship = await this.profileService.getPlayerShip(userId, shipId);
      
      if (!ship) {
        return this.sendError(conn, 'SHIP_NOT_FOUND', 'Ship not found', msg.id);
      }
      
      this.sendResponse(conn, 'SHIP_DETAILS', ship, msg.id);
    } catch (error) {
      this.sendError(conn, 'SHIP_ERROR', 'Failed to load ship', msg.id);
    }
  }
  
  async handleCreateCustomShip(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { baseShipId, name } = msg.payload || {};
    
    if (!userId || !baseShipId || !name) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const ship = await this.profileService.createCustomShip(userId, baseShipId, name);
      this.sendResponse(conn, 'CUSTOM_SHIP_CREATED', ship, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'CREATE_FAILED', error.message || 'Failed to create ship', msg.id);
    }
  }
  
  async handleUpdateShip(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { shipId, updates } = msg.payload || {};
    
    if (!userId || !shipId || !updates) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const updatedShip = await this.profileService.updateShip(userId, shipId, updates);
      
      if (!updatedShip) {
        return this.sendError(conn, 'SHIP_NOT_FOUND', 'Ship not found', msg.id);
      }
      
      this.sendResponse(conn, 'SHIP_UPDATED', updatedShip, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPDATE_FAILED', error.message || 'Failed to update ship', msg.id);
    }
  }
  
  async handleRestorePresetShip(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { shipId } = msg.payload || {};
    
    if (!userId || !shipId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const restored = await this.profileService.restorePresetShip(userId, shipId);
      
      if (!restored) {
        return this.sendError(conn, 'RESTORE_FAILED', 'Cannot restore ship', msg.id);
      }
      
      this.sendResponse(conn, 'PRESET_RESTORED', {
        objectType: 'ship',
        objectId: shipId,
        restored: true
      }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'RESTORE_ERROR', error.message || 'Failed to restore preset', msg.id);
    }
  }
  
  // ========== 武器操作 ==========
  
  async handleGetWeapons(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const profile = await this.profileService.getOrCreateProfile(userId);
      
      // 发送武器列表（简略信息）
      const weaponList = profile.weapons.map((weapon: any) => ({
        id: weapon.$id,
        name: weapon.metadata?.['name'] || '未命名武器',
        tags: weapon.metadata?.['tags'],
        spec: {
          category: weapon.weapon?.category,
          damageType: weapon.weapon.damageType,
          size: weapon.weapon.size,
          damage: weapon.weapon.damage
        }
      }));
      
      this.sendResponse(conn, 'PLAYER_WEAPONS', { weapons: weaponList }, msg.id);
    } catch (error) {
      this.sendError(conn, 'WEAPONS_ERROR', 'Failed to load weapons', msg.id);
    }
  }
  
  async handleCreateCustomWeapon(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { baseWeaponId, name } = msg.payload || {};
    
    if (!userId || !baseWeaponId || !name) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const weapon = await this.profileService.createCustomWeapon(userId, baseWeaponId, name);
      this.sendResponse(conn, 'CUSTOM_WEAPON_CREATED', weapon, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'CREATE_FAILED', error.message || 'Failed to create weapon', msg.id);
    }
  }
  
  async handleRestorePresetWeapon(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { weaponId } = msg.payload || {};
    
    if (!userId || !weaponId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing parameters', msg.id);
    }
    
    try {
      const restored = await this.profileService.restorePresetWeapon(userId, weaponId);
      
      if (!restored) {
        return this.sendError(conn, 'RESTORE_FAILED', 'Cannot restore weapon', msg.id);
      }
      
      this.sendResponse(conn, 'PRESET_RESTORED', {
        objectType: 'weapon',
        objectId: weaponId,
        restored: true
      }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'RESTORE_ERROR', error.message || 'Failed to restore preset', msg.id);
    }
  }
  
  // ========== 存档操作 ==========
  
  async handleCreateSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { name, description, tags, gameState } = msg.payload || {};
    
    if (!userId || !name || !gameState) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing name or gameState', msg.id);
    }
    
    try {
      const saveRequest = {
        name,
        description,
        tags,
        gameState
      };
      const save = await this.profileService.createSave(userId, saveRequest, gameState);
      this.sendResponse(conn, 'SAVE_CREATED', save, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'SAVE_ERROR', error.message || 'Failed to create save', msg.id);
    }
  }
  
  async handleCreateSaveAdvanced(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveRequest = msg.payload;
    
    if (!userId || !saveRequest || !saveRequest.name || !saveRequest.gameState) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Invalid save request', msg.id);
    }
    
    try {
      const save = await this.profileService.createSave(userId, saveRequest, saveRequest.gameState);
      this.sendResponse(conn, 'SAVE_CREATED', save, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'SAVE_ERROR', error.message || 'Failed to create save', msg.id);
    }
  }
  
  async handleUpdateSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { saveId, updates } = msg.payload || {};
    
    if (!userId || !saveId || !updates) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId or updates', msg.id);
    }
    
    try {
      const updatedSave = await this.profileService.updateSave(userId, saveId, updates);
      
      if (!updatedSave) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_UPDATED', updatedSave, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPDATE_ERROR', error.message || 'Failed to update save', msg.id);
    }
  }
  
  async handleLoadSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveId = msg.payload?.saveId;
    
    if (!userId || !saveId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId', msg.id);
    }
    
    try {
      const save = await this.profileService.loadSave(userId, saveId);
      
      if (!save) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_LOADED', save, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'LOAD_ERROR', error.message || 'Failed to load save', msg.id);
    }
  }
  
  async handleDeleteSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveId = msg.payload?.saveId;
    
    if (!userId || !saveId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId', msg.id);
    }
    
    try {
      const deleted = await this.profileService.deleteSave(userId, saveId);
      
      if (!deleted) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_DELETED', {
        saveId,
        deleted: true
      }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'DELETE_ERROR', error.message || 'Failed to delete save', msg.id);
    }
  }
  
  async handleListSaves(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { tags, limit, offset } = msg.payload || {};
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const filter = tags ? { tags } : undefined;
      const saves = await this.profileService.listSaves(userId, filter);
      
      // 应用分页
      let paginatedSaves = saves;
      if (offset !== undefined || limit !== undefined) {
        const start = offset || 0;
        const end = limit !== undefined ? start + limit : saves.length;
        paginatedSaves = saves.slice(start, end);
      }
      
      this.sendResponse(conn, 'SAVE_LIST', {
        saves: paginatedSaves,
        total: saves.length,
        offset: offset || 0,
        limit: limit || saves.length
      }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'LIST_ERROR', error.message || 'Failed to list saves', msg.id);
    }
  }
  
  async handleGetSaveCount(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const count = await this.profileService.getSaveCount(userId);
      this.sendResponse(conn, 'SAVE_COUNT', { count }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'COUNT_ERROR', error.message || 'Failed to get save count', msg.id);
    }
  }
  
  async handleGetSaveInfo(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveId = msg.payload?.saveId;
    
    if (!userId || !saveId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId', msg.id);
    }
    
    try {
      const saveInfo = await this.profileService.getSaveInfo(userId, saveId);
      
      if (!saveInfo) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_INFO', saveInfo, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'INFO_ERROR', error.message || 'Failed to get save info', msg.id);
    }
  }
  
  async handleGetSaveStats(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const stats = await this.profileService.getSaveStats(userId);
      this.sendResponse(conn, 'SAVE_STATS', stats, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'STATS_ERROR', error.message || 'Failed to get save stats', msg.id);
    }
  }
  
  async handleDuplicateSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { saveId, newName } = msg.payload || {};
    
    if (!userId || !saveId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId', msg.id);
    }
    
    try {
      const duplicatedSave = await this.profileService.duplicateSave(userId, saveId, newName);
      
      if (!duplicatedSave) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_DUPLICATED', duplicatedSave, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'DUPLICATE_ERROR', error.message || 'Failed to duplicate save', msg.id);
    }
  }
  
  async handleDeleteSaves(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveIds = msg.payload?.saveIds;
    
    if (!userId || !saveIds || !Array.isArray(saveIds)) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing or invalid saveIds', msg.id);
    }
    
    try {
      const result = await this.profileService.deleteSaves(userId, saveIds);
      this.sendResponse(conn, 'SAVES_DELETED', result, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'DELETE_ERROR', error.message || 'Failed to delete saves', msg.id);
    }
  }
  
  async handleCleanupSaves(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const options = msg.payload?.options;
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const result = await this.profileService.cleanupOldSaves(userId, options || {});
      this.sendResponse(conn, 'SAVES_CLEANED', result, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'CLEANUP_ERROR', error.message || 'Failed to cleanup saves', msg.id);
    }
  }
  
  async handleExportSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveId = msg.payload?.saveId;
    
    if (!userId || !saveId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing saveId', msg.id);
    }
    
    try {
      const saveExport = await this.profileService.exportSave(userId, saveId);
      
      if (!saveExport) {
        return this.sendError(conn, 'SAVE_NOT_FOUND', 'Save not found', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_EXPORT', saveExport, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'EXPORT_ERROR', error.message || 'Failed to export save', msg.id);
    }
  }
  
  async handleImportSave(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const saveExport = msg.payload?.saveExport;
    
    if (!userId || !saveExport) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing save export data', msg.id);
    }
    
    try {
      const importedSave = await this.profileService.importSave(userId, saveExport);
      
      if (!importedSave) {
        return this.sendError(conn, 'IMPORT_ERROR', 'Failed to import save', msg.id);
      }
      
      this.sendResponse(conn, 'SAVE_IMPORTED', importedSave, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'IMPORT_ERROR', error.message || 'Failed to import save', msg.id);
    }
  }
  
  // ========== 辅助方法 ==========
  
  private sendResponse(conn: Connection, type: string, payload: any, msgId?: string): void {
    this.connMgr.send(conn.id, {
      type,
      payload,
      ...(msgId ? { id: msgId } : {})
    });
  }
  
  private sendError(conn: Connection, code: string, message: string, msgId?: string): void {
    this.connMgr.send(conn.id, {
      type: 'ERROR',
      payload: { code, message },
      ...(msgId ? { id: msgId } : {})
    });
  }
}