/**
 * 玩家档案服务测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../storage/MemoryStorage.js';
import { PlayerProfileService } from './PlayerProfileService.js';

describe('PlayerProfileService', () => {
  let storage: MemoryStorage;
  let service: PlayerProfileService;
  
  beforeEach(() => {
    console.log('=== beforeEach called ===');
    storage = new MemoryStorage();
    service = new PlayerProfileService(storage);
  });
  
  describe('玩家档案管理', () => {
    it('应该创建新玩家档案', async () => {
      const profile = await service.getOrCreateProfile('test_user');
      
      expect(profile.$id).toBe('player:test_user');
      expect(profile.username).toBe('test_user');
      expect(profile.displayName).toBe('test_user');
      expect(profile.ships.length).toBeGreaterThan(0);
      expect(profile.weapons.length).toBeGreaterThan(0);
      expect(profile.saves).toHaveLength(0);
      expect(profile.stats.gamesPlayed).toBe(0);
    });
    
    it('应该返回已存在的玩家档案', async () => {
      // 第一次创建
      const profile1 = await service.getOrCreateProfile('test_user');
      profile1.stats.gamesPlayed = 5;
      await storage.savePlayer(profile1);
      
      // 第二次获取
      const profile2 = await service.getOrCreateProfile('test_user');
      
      expect(profile2.$id).toBe('player:test_user');
      expect(profile2.stats.gamesPlayed).toBe(5);
    });
  });
  
  describe('舰船管理', () => {
    it('应该列出玩家舰船', async () => {
      await service.getOrCreateProfile('test_user');
      const ships = await service.listPlayerShips('test_user');
      
      expect(ships.length).toBeGreaterThan(0);
      expect(ships[0].metadata.tags).toContain('preset');
      expect(ships[0].metadata.isPresetCopy).toBe(true);
    });
    
    it('应该创建自定义舰船', async () => {
      console.log('=== Test: 应该创建自定义舰船 ===');
      await service.getOrCreateProfile('test_user');
      const ships = await service.listPlayerShips('test_user');
      console.log('Initial ships:', ships.length, ships.map(s => s.$id));
      console.log('Initial ship metadata:', ships.map(s => ({ id: s.$id, name: s.metadata?.name, tags: s.metadata?.tags })));
      const baseShipId = ships[0].$id;
      
      const customShip = await service.createCustomShip('test_user', baseShipId, '我的自定义舰船');
      console.log('Custom ship ID:', customShip.$id);
      console.log('Custom ship metadata:', { name: customShip.metadata?.name, tags: customShip.metadata?.tags });
      
      expect(customShip.$id).toMatch(/^ship:custom_/);
      expect(customShip.metadata?.name).toBe('我的自定义舰船');
      expect(customShip.metadata?.tags).toContain('custom');
      expect(customShip.metadata?.isPresetCopy).toBe(false);
      
      const updatedShips = await service.listPlayerShips('test_user');
      console.log('Updated ships:', updatedShips.length, updatedShips.map(s => s.$id));
      console.log('Updated ship metadata:', updatedShips.map(s => ({ id: s.$id, name: s.metadata?.name, tags: s.metadata?.tags })));
      // 创建自定义舰船后，舰船数量应该增加
      // 直接检查是否增加了1艘
      const initialCount = ships.length;
      console.log(`Ship count: ships.length=${ships.length}, initialCount=${initialCount}, after=${updatedShips.length}`);
      // 实际上，初始有2艘预设舰船，创建自定义舰船后应该有3艘
      expect(updatedShips.length).toBe(3);
    });
    
    it('应该恢复预设舰船', async () => {
      await service.getOrCreateProfile('test_user');
      const ships = await service.listPlayerShips('test_user');
      const presetShip = ships.find(s => s.metadata.isPresetCopy);
      
      if (!presetShip) {
        throw new Error('No preset ship found');
      }
      
      // 修改舰船
      const modifiedShip = { ...presetShip, metadata: { ...presetShip.metadata, name: '修改后的舰船' } };
      await storage.savePlayerShip('player:test_user', modifiedShip);
      
      // 恢复预设
      const restored = await service.restorePresetShip('test_user', presetShip.$id);
      
      expect(restored).not.toBeNull();
      expect(restored!.metadata.name).not.toBe('修改后的舰船');
      expect(restored!.metadata.isPresetCopy).toBe(true);
    });
  });
  
  describe('武器管理', () => {
    it('应该创建自定义武器', async () => {
      await service.getOrCreateProfile('test_user');
      const profile = await service.getOrCreateProfile('test_user');
      const baseWeaponId = profile.weapons[0].$id;
      
      const customWeapon = await service.createCustomWeapon('test_user', baseWeaponId, '我的自定义武器');
      
      expect(customWeapon.$id).toMatch(/^weapon:custom_/);
      expect(customWeapon.metadata?.name).toBe('我的自定义武器');
      expect(customWeapon.metadata?.tags).toContain('custom');
      expect(customWeapon.metadata?.isPresetCopy).toBe(false);
    });
  });
  
  describe('存档管理', () => {
    it('应该创建和加载存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = {
        turn: 3,
        phase: 'DEPLOYMENT',
        players: new Map([['player1', { name: '玩家1', faction: 'NEUTRAL', role: 'PLAYER' }]]),
        tokens: new Map()
      };
      
      const saveRequest = {
        name: '测试存档',
        description: '测试存档描述',
        tags: ['test'],
        gameState
      };
      
      const save = await service.createSave('test_user', saveRequest, gameState);
      
      expect(save.$id).toMatch(/^save:test_user_/);
      expect(save.metadata.name).toBe('测试存档');
      expect(save.gameInfo.turn).toBe(3);
      expect(save.gameInfo.playerCount).toBe(1);
      
      const loaded = await service.loadSave('test_user', save.$id);
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.name).toBe('测试存档');
    });
    
    it('应该列出所有存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { 
        turn: 1, 
        phase: 'DEPLOYMENT',
        players: new Map() 
      };
      
      const saveRequest1 = {
        name: '存档1',
        description: '存档1描述',
        tags: ['test'],
        gameState
      };
      
      const saveRequest2 = {
        name: '存档2',
        description: '存档2描述',
        tags: ['test'],
        gameState
      };
      
      const save1 = await service.createSave('test_user', saveRequest1, gameState);
      console.log('Save 1 ID:', save1.$id);
      
      // 添加延迟确保不同的时间戳
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const save2 = await service.createSave('test_user', saveRequest2, gameState);
      console.log('Save 2 ID:', save2.$id);
      
      const saves = await service.listSaves('test_user');
      console.log('Listed saves:', saves.length, saves.map(s => s.metadata.name));
      expect(saves.length).toBe(2);
      
      // 默认按updatedAt降序排序，所以最新的存档在前面
      // 由于我们添加了延迟，save2比save1新
      expect(saves[0].metadata.name).toBe('存档2');
      expect(saves[1].metadata.name).toBe('存档1');
    });
    
    it('应该获取存档信息', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = {
        turn: 5,
        phase: 'COMBAT',
        players: new Map([['player1', { name: '玩家1' }]])
      };
      
      const saveRequest = {
        name: '信息测试存档',
        description: '用于测试存档信息',
        tags: ['info-test'],
        gameState
      };
      
      const save = await service.createSave('test_user', saveRequest, gameState);
      const saveInfo = await service.getSaveInfo('test_user', save.$id);
      
      expect(saveInfo).not.toBeNull();
      expect(saveInfo!.$id).toBe(save.$id);
      expect(saveInfo!.metadata.name).toBe('信息测试存档');
      expect(saveInfo!.gameInfo.turn).toBe(5);
    });
    
    it('应该更新存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { turn: 1, players: new Map() };
      const saveRequest = {
        name: '原始存档',
        description: '原始描述',
        tags: ['original'],
        gameState
      };
      
      const save = await service.createSave('test_user', saveRequest, gameState);
      
      const updates = {
        name: '更新后的存档',
        description: '更新后的描述',
        tags: ['updated', 'test']
      };
      
      const updatedSave = await service.updateSave('test_user', save.$id, updates);
      
      expect(updatedSave).not.toBeNull();
      expect(updatedSave!.metadata.name).toBe('更新后的存档');
      expect(updatedSave!.metadata.description).toBe('更新后的描述');
      expect(updatedSave!.metadata.tags).toContain('updated');
    });
    
    it('应该删除存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { turn: 1, players: new Map() };
      const saveRequest = {
        name: '待删除存档',
        description: '这个存档将被删除',
        tags: ['delete-test'],
        gameState
      };
      
      const save = await service.createSave('test_user', saveRequest, gameState);
      
      const deleted = await service.deleteSave('test_user', save.$id);
      expect(deleted).toBe(true);
      
      const loaded = await service.loadSave('test_user', save.$id);
      expect(loaded).toBeNull();
    });
    
    it('应该批量删除存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { turn: 1, players: new Map() };
      const saveIds: string[] = [];
      
      for (let i = 1; i <= 3; i++) {
        const saveRequest = {
          name: `批量存档${i}`,
          description: `批量测试存档${i}`,
          tags: ['batch-test'],
          gameState
        };
        const save = await service.createSave('test_user', saveRequest, gameState);
        saveIds.push(save.$id);
      }
      
      const result = await service.deleteSaves('test_user', saveIds);
      
      expect(result.success.length).toBe(3);
      expect(result.failed.length).toBe(0);
      
      for (const saveId of saveIds) {
        const loaded = await service.loadSave('test_user', saveId);
        expect(loaded).toBeNull();
      }
    });
    
    it('应该复制存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = {
        turn: 10,
        phase: 'DEPLOYMENT',
        players: new Map([['player1', { name: '玩家1' }]])
      };
      
      const saveRequest = {
        name: '原始存档',
        description: '将被复制的存档',
        tags: ['original'],
        gameState
      };
      
      const originalSave = await service.createSave('test_user', saveRequest, gameState);
      
      const duplicatedSave = await service.duplicateSave('test_user', originalSave.$id, '副本存档');
      
      expect(duplicatedSave).not.toBeNull();
      expect(duplicatedSave!.$id).not.toBe(originalSave.$id);
      expect(duplicatedSave!.metadata.name).toBe('副本存档');
      expect(duplicatedSave!.metadata.tags).toContain('duplicate');
      expect(duplicatedSave!.gameInfo.turn).toBe(originalSave.gameInfo.turn);
    });
    
    it('应该获取存档统计信息', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { turn: 1, players: new Map() };
      
      // 创建多个存档
      for (let i = 1; i <= 5; i++) {
        const saveRequest = {
          name: `统计测试存档${i}`,
          description: `用于统计测试的存档${i}`,
          tags: i % 2 === 0 ? ['even'] : ['odd'],
          gameState
        };
        await service.createSave('test_user', saveRequest, gameState);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const stats = await service.getSaveStats('test_user');
      
      expect(stats.total).toBe(5);
      expect(stats.byTag['even']).toBe(2);
      expect(stats.byTag['odd']).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldest).not.toBeNull();
      expect(stats.newest).not.toBeNull();
    });
    
    it('应该清理旧存档', async () => {
      await service.getOrCreateProfile('test_user');
      
      const gameState = { turn: 1, players: new Map() };
      
      // 创建多个存档
      const saveIds: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const saveRequest = {
          name: `清理测试存档${i}`,
          description: `用于清理测试的存档${i}`,
          tags: i <= 3 ? ['keep'] : ['cleanup'],
          gameState
        };
        const save = await service.createSave('test_user', saveRequest, gameState);
        saveIds.push(save.$id);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 清理：保留带'keep'标签的，最多保留5个
      const result = await service.cleanupOldSaves('test_user', {
        maxCount: 5,
        keepTags: ['keep']
      });
      
      console.log('Cleanup result:', { kept: result.kept.length, deleted: result.deleted.length });
      console.log('Kept saves:', result.kept);
      console.log('Deleted saves:', result.deleted);
      
      // 应该保留3个带'keep'标签的 + 2个最新的（总共5个）
      expect(result.kept.length).toBe(5);
      expect(result.deleted.length).toBe(5);
      
      // 验证带'keep'标签的存档都被保留了
      const keptSaves = await service.listSaves('test_user');
      const keptIds = keptSaves.map(s => s.$id);
      
      // 前3个存档应该被保留（带'keep'标签）
      for (let i = 0; i < 3; i++) {
        expect(keptIds).toContain(saveIds[i]);
      }
    });
  });
});