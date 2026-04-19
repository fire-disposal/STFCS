/**
 * 资产服务 - 统一管理图像素材（头像、贴图等）
 */

import { MemoryStorage } from "../storage/MemoryStorage.js";

// 简化类型定义以避免TypeScript严格检查问题
type Asset = any;
type AssetType = any;
type AssetUploadRequest = any;
type AssetListItem = any;
type AssetFilter = any;
type AssetStats = any;

export class AssetService {
  private storage: MemoryStorage;
  
  constructor(storage: MemoryStorage) {
    this.storage = storage;
  }
  
  // ========== 资产上传 ==========
  
  async uploadAsset(userId: string, request: AssetUploadRequest): Promise<Asset> {
    const assetId = this.generateAssetId(request.type);
    const now = Date.now();
    
    const asset: Asset = {
      $schema: 'asset-v1',
      $id: assetId,
      type: request.type,
      filename: request.filename,
      mimeType: request.mimeType,
      size: request.buffer.length,
      metadata: request.metadata || {},
      ownerId: `player:${userId}`,
      uploadedAt: now,
      updatedAt: now,
      visibility: request.visibility || 'private',
      sharedWith: request.sharedWith || [],
      data: request.buffer
    };
    
    await this.storage.saveAsset(asset);
    return asset;
  }
  
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    const request = {
      type: 'avatar',
      filename,
      mimeType,
      buffer,
      metadata: {
        name: `头像 - ${filename}`,
        tags: ['avatar', 'profile']
      },
      visibility: 'public'  // 头像通常公开
    };
    
    const asset = await this.uploadAsset(userId, request);
    return asset.$id;
  }
  
  async uploadShipTexture(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    metadata?: {
      name?: string;
      description?: string;
      width?: number;
      height?: number;
      tags?: string[];
    }
  ): Promise<string> {
    const request = {
      type: 'ship_texture',
      filename,
      mimeType,
      buffer,
      metadata: {
        name: metadata?.name || `舰船贴图 - ${filename}`,
        description: metadata?.description,
        width: metadata?.width,
        height: metadata?.height,
        tags: ['ship', 'texture', ...(metadata?.tags || [])]
      },
      visibility: 'private'  // 舰船贴图默认私有
    };
    
    const asset = await this.uploadAsset(userId, request);
    return asset.$id;
  }
  
  async uploadCustomTexture(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    metadata?: {
      name?: string;
      description?: string;
      width?: number;
      height?: number;
      tags?: string[];
    }
  ): Promise<string> {
    const request = {
      type: 'custom_texture',
      filename,
      mimeType,
      buffer,
      metadata: {
        name: metadata?.name || `自定义贴图 - ${filename}`,
        description: metadata?.description,
        width: metadata?.width,
        height: metadata?.height,
        tags: ['custom', 'texture', ...(metadata?.tags || [])]
      },
      visibility: 'private'
    };
    
    const asset = await this.uploadAsset(userId, request);
    return asset.$id;
  }
  
  // ========== 资产获取 ==========
  
  async getAsset(assetId: string): Promise<Asset | null> {
    return this.storage.getAsset(assetId);
  }
  
  async getAssetData(assetId: string): Promise<Buffer | null> {
    const asset = await this.getAsset(assetId);
    return asset?.data || null;
  }
  
  async getAssetInfo(assetId: string): Promise<AssetListItem | null> {
    const asset = await this.getAsset(assetId);
    if (!asset) return null;
    
    return this.assetToListItem(asset);
  }
  
  // ========== 资产列表和搜索 ==========
  
  async listAssets(_filter?: AssetFilter): Promise<AssetListItem[]> {
    // 注意：MemoryStorage没有实现资产列表，这里需要扩展
    // 简化实现：返回空数组
    return [];
  }
  
  async listUserAssets(
    userId: string,
    filter?: Omit<AssetFilter, 'ownerId'>
  ): Promise<AssetListItem[]> {
    // 简化实现：返回用户资产
    const allAssets = await this.getAllAssets();
    const userAssets = allAssets.filter(asset => 
      asset.ownerId === `player:${userId}` ||
      asset.visibility === 'public' ||
      (asset.visibility === 'shared' && asset.sharedWith?.includes(`player:${userId}`))
    );
    
    let filteredAssets = userAssets;
    
    if (filter) {
      const filterObj = filter as any;
      
      // 应用类型过滤
      if (filterObj.type) {
        const types = Array.isArray(filterObj.type) ? filterObj.type : [filterObj.type];
        filteredAssets = filteredAssets.filter(asset => types.includes(asset.type));
      }
      
      // 应用可见性过滤
      if (filterObj.visibility) {
        filteredAssets = filteredAssets.filter(asset => asset.visibility === filterObj.visibility);
      }
      
      // 应用标签过滤
      if (filterObj.tags && filterObj.tags.length > 0) {
        filteredAssets = filteredAssets.filter(asset => {
          const tags = asset.metadata?.tags || [];
          return filterObj.tags.some((tag: string) => tags.includes(tag));
        });
      }
      
      // 应用搜索过滤
      if (filterObj.search) {
        const searchLower = filterObj.search.toLowerCase();
        filteredAssets = filteredAssets.filter(asset => 
          asset.filename.toLowerCase().includes(searchLower) ||
          asset.metadata?.name?.toLowerCase().includes(searchLower) ||
          asset.metadata?.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // 应用排序
      const sortBy = filterObj.sortBy || 'uploadedAt';
      const sortOrder = filterObj.sortOrder || 'desc';
      
      filteredAssets.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'filename':
            aValue = a.filename.toLowerCase();
            bValue = b.filename.toLowerCase();
            break;
          case 'size':
            aValue = a.size;
            bValue = b.size;
            break;
          case 'updatedAt':
            aValue = a.updatedAt || a.uploadedAt;
            bValue = b.updatedAt || b.uploadedAt;
            break;
          case 'uploadedAt':
          default:
            aValue = a.uploadedAt;
            bValue = b.uploadedAt;
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    } else {
      // 默认按上传时间降序排序
      filteredAssets.sort((a, b) => b.uploadedAt - a.uploadedAt);
    }
    
    return filteredAssets.map(asset => this.assetToListItem(asset));
  }
  
  async getAssetStats(userId: string): Promise<AssetStats> {
    const userAssets = await this.listUserAssets(userId);
    
    if (userAssets.length === 0) {
      return {
        total: 0,
        byType: {} as Record<AssetType, number>,
        byVisibility: {},
        totalSize: 0,
        oldest: null,
        newest: null
      };
    }
    
    const byType: Record<string, number> = {};
    const byVisibility: Record<string, number> = {};
    let totalSize = 0;
    let oldestDate = userAssets[0].uploadedAt;
    let newestDate = userAssets[0].uploadedAt;
    
    for (const asset of userAssets) {
      // 统计类型
      byType[asset.type] = (byType[asset.type] || 0) + 1;
      
      // 统计可见性
      byVisibility[asset.visibility] = (byVisibility[asset.visibility] || 0) + 1;
      
      // 计算总大小
      totalSize += asset.size;
      
      // 查找最旧和最新的资产
      if (asset.uploadedAt < oldestDate) oldestDate = asset.uploadedAt;
      if (asset.uploadedAt > newestDate) newestDate = asset.uploadedAt;
    }
    
    return {
      total: userAssets.length,
      byType: byType as Record<AssetType, number>,
      byVisibility,
      totalSize,
      oldest: new Date(oldestDate),
      newest: new Date(newestDate)
    };
  }
  
  // ========== 资产管理 ==========
  
  async updateAsset(
    assetId: string,
    updates: {
      metadata?: Partial<Asset['metadata']>;
      visibility?: 'private' | 'public' | 'shared';
      sharedWith?: string[];
    }
  ): Promise<Asset | null> {
    const asset = await this.getAsset(assetId);
    if (!asset) return null;
    
    const updatedAsset: Asset = {
      ...asset,
      metadata: {
        ...asset.metadata,
        ...updates.metadata
      },
      ...(updates.visibility && { visibility: updates.visibility }),
      ...(updates.sharedWith && { sharedWith: updates.sharedWith }),
      updatedAt: Date.now()
    };
    
    await this.storage.saveAsset(updatedAsset);
    return updatedAsset;
  }
  
  async deleteAsset(assetId: string): Promise<boolean> {
    return this.storage.deleteAsset(assetId);
  }
  
  async shareAsset(
    assetId: string,
    userIds: string[]
  ): Promise<Asset | null> {
    return this.updateAsset(assetId, {
      visibility: 'shared',
      sharedWith: userIds.map(id => `player:${id}`)
    });
  }
  
  async makeAssetPublic(assetId: string): Promise<Asset | null> {
    return this.updateAsset(assetId, {
      visibility: 'public',
      sharedWith: []
    });
  }
  
  async makeAssetPrivate(assetId: string): Promise<Asset | null> {
    return this.updateAsset(assetId, {
      visibility: 'private',
      sharedWith: []
    });
  }
  
   // ========== 头像特定方法 ==========
   
   async getUserAvatar(userId: string): Promise<AssetListItem | null> {
     const userAssets = await this.listUserAssets(userId, { type: 'avatar' });
     if (userAssets.length === 0) return null;
     
     // 返回最新的头像
     return userAssets.sort((a, b) => b.uploadedAt - a.uploadedAt)[0];
   }
   
   async getUserAvatarData(userId: string): Promise<Buffer | null> {
     const avatar = await this.getUserAvatar(userId);
     if (!avatar) return null;
     
     const asset = await this.getAsset(avatar.$id);
     return asset?.data || null;
   }
   
   async getUserAvatarUrl(userId: string): Promise<string | null> {
     const avatar = await this.getUserAvatar(userId);
     if (!avatar) return null;
     
     return `/api/assets/${avatar.$id}/data`;
   }
   
   async listUserAvatars(userId: string): Promise<AssetListItem[]> {
     return this.listUserAssets(userId, { 
       type: 'avatar',
       sortBy: 'uploadedAt',
       sortOrder: 'desc'
     });
   }
   
   // ========== 辅助方法 ==========
   
   private generateAssetId(type: AssetType): string {
     const timestamp = Date.now();
     const random = Math.random().toString(36).substr(2, 9);
     return `asset:${type}_${timestamp}_${random}`;
   }
  
  private assetToListItem(asset: Asset): AssetListItem {
    return {
      $id: asset.$id,
      type: asset.type,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      metadata: asset.metadata,
      ownerId: asset.ownerId,
      uploadedAt: asset.uploadedAt,
      updatedAt: asset.updatedAt || asset.uploadedAt,
      visibility: asset.visibility
    };
  }
  
  private async getAllAssets(): Promise<Asset[]> {
    return this.storage.listAssets();
  }
}