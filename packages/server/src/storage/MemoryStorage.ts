/**
 * 内存存储服务 - 快速实现，后续可替换为MongoDB
 */

// 简化类型定义
type PlayerProfile = any;
type GameSave = any;
type ShipJSON = any;
type WeaponJSON = any;
type Asset = any;

export class MemoryStorage {
  // 内存存储
  private players = new Map<string, PlayerProfile>();
  private assets = new Map<string, Asset>();
  
  // ========== 玩家档案操作 ==========
  
  async getPlayer(playerId: string): Promise<PlayerProfile | null> {
    return this.players.get(playerId) || null;
  }
  
  async savePlayer(profile: PlayerProfile): Promise<void> {
    profile.updatedAt = Date.now();
    this.players.set(profile.$id, profile);
  }
  
  async deletePlayer(playerId: string): Promise<boolean> {
    return this.players.delete(playerId);
  }
  
  // ========== 舰船操作 ==========
  
  async getPlayerShip(playerId: string, shipId: string): Promise<ShipJSON | null> {
    const profile = await this.getPlayer(playerId);
    return profile?.ships.find((s: ShipJSON) => s.$id === shipId) || null;
  }
  
  async savePlayerShip(playerId: string, ship: ShipJSON): Promise<void> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return;
    
    const index = profile.ships.findIndex((s: ShipJSON) => s.$id === ship.$id);
    if (index >= 0) {
      profile.ships[index] = ship;
    } else {
      profile.ships.push(ship);
    }
    
    profile.updatedAt = Date.now();
    await this.savePlayer(profile);
  }
  
  async deletePlayerShip(playerId: string, shipId: string): Promise<boolean> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return false;
    
    const initialLength = profile.ships.length;
    profile.ships = profile.ships.filter((s: ShipJSON) => s.$id !== shipId);
    
    if (profile.ships.length !== initialLength) {
      profile.updatedAt = Date.now();
      await this.savePlayer(profile);
      return true;
    }
    
    return false;
  }
  
  // ========== 武器操作 ==========
  
  async getPlayerWeapon(playerId: string, weaponId: string): Promise<WeaponJSON | null> {
    const profile = await this.getPlayer(playerId);
    return profile?.weapons.find((w: WeaponJSON) => w.$id === weaponId) || null;
  }
  
  async savePlayerWeapon(playerId: string, weapon: WeaponJSON): Promise<void> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return;
    
    const index = profile.weapons.findIndex((w: WeaponJSON) => w.$id === weapon.$id);
    if (index >= 0) {
      profile.weapons[index] = weapon;
    } else {
      profile.weapons.push(weapon);
    }
    
    profile.updatedAt = Date.now();
    await this.savePlayer(profile);
  }
  
  async deletePlayerWeapon(playerId: string, weaponId: string): Promise<boolean> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return false;
    
    const initialLength = profile.weapons.length;
    profile.weapons = profile.weapons.filter((w: WeaponJSON) => w.$id !== weaponId);
    
    if (profile.weapons.length !== initialLength) {
      profile.updatedAt = Date.now();
      await this.savePlayer(profile);
      return true;
    }
    
    return false;
  }
  
  // ========== 存档操作 ==========
  
  async getPlayerSave(playerId: string, saveId: string): Promise<GameSave | null> {
    const profile = await this.getPlayer(playerId);
    return profile?.saves.find((s: GameSave) => s.$id === saveId) || null;
  }
  
  async savePlayerSave(playerId: string, save: GameSave): Promise<void> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return;
    
    const index = profile.saves.findIndex((s: GameSave) => s.$id === save.$id);
    if (index >= 0) {
      profile.saves[index] = save;
    } else {
      profile.saves.push(save);
    }
    
    profile.updatedAt = Date.now();
    await this.savePlayer(profile);
  }
  
  async deletePlayerSave(playerId: string, saveId: string): Promise<boolean> {
    const profile = await this.getPlayer(playerId);
    if (!profile) return false;
    
    const initialLength = profile.saves.length;
    profile.saves = profile.saves.filter((s: GameSave) => s.$id !== saveId);
    
    if (profile.saves.length !== initialLength) {
      profile.updatedAt = Date.now();
      await this.savePlayer(profile);
      return true;
    }
    
    return false;
  }
  
  async listPlayerSaves(playerId: string): Promise<GameSave[]> {
    const profile = await this.getPlayer(playerId);
    return profile?.saves || [];
  }
  
  // ========== 资产操作 ==========
  
  async saveAsset(asset: Asset): Promise<void> {
    this.assets.set(asset.$id, asset);
  }
  
  async getAsset(assetId: string): Promise<Asset | null> {
    return this.assets.get(assetId) || null;
  }
  
  async deleteAsset(assetId: string): Promise<boolean> {
    return this.assets.delete(assetId);
  }
  
  async listAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }
  
  async listAssetsByOwner(ownerId: string): Promise<Asset[]> {
    const allAssets = await this.listAssets();
    return allAssets.filter(asset => asset.ownerId === ownerId);
  }
  
  async listAssetsByType(type: string): Promise<Asset[]> {
    const allAssets = await this.listAssets();
    return allAssets.filter(asset => asset.type === type);
  }
  
  async listPublicAssets(): Promise<Asset[]> {
    const allAssets = await this.listAssets();
    return allAssets.filter(asset => asset.visibility === 'public');
  }
  
  async getAssetsByOwner(ownerId: string): Promise<Asset[]> {
    return Array.from(this.assets.values())
      .filter(asset => asset.ownerId === ownerId);
  }
  
  // ========== 辅助方法 ==========
  
  async listAllPlayers(): Promise<PlayerProfile[]> {
    return Array.from(this.players.values());
  }
  
  async clearAll(): Promise<void> {
    this.players.clear();
    this.assets.clear();
  }
}