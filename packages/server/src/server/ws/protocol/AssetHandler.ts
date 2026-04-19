/**
 * 资产WebSocket处理器
 * 处理图像素材（头像、贴图等）的上传、管理和访问
 */

import type { Connection } from "../connection.js";
import type { ConnectionManager } from "../connection.js";
import type { AssetService } from "../../../services/AssetService.js";

export class AssetHandler {
  constructor(
    private connMgr: ConnectionManager,
    private assetService: AssetService
  ) {}
  
  // ========== 资产上传 ==========
  
  async handleUploadAsset(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { type, filename, mimeType, data, metadata, visibility, sharedWith } = msg.payload || {};
    
    if (!userId || !type || !filename || !mimeType || !data) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing required fields', msg.id);
    }
    
    try {
      // 将base64数据转换为Buffer
      let buffer: Buffer;
      if (typeof data === 'string') {
        // 假设是base64编码
        buffer = Buffer.from(data, 'base64');
      } else if (Array.isArray(data)) {
        // 假设是字节数组
        buffer = Buffer.from(data);
      } else {
        return this.sendError(conn, 'INVALID_DATA', 'Invalid data format', msg.id);
      }
      
      const request = {
        type,
        filename,
        mimeType,
        buffer,
        metadata,
        visibility,
        sharedWith
      };
      
      const asset = await this.assetService.uploadAsset(userId, request);
      this.sendResponse(conn, 'ASSET_UPLOADED', asset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPLOAD_ERROR', error.message || 'Failed to upload asset', msg.id);
    }
  }
  
  async handleUploadAvatar(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { filename, mimeType, data } = msg.payload || {};
    
    if (!userId || !filename || !mimeType || !data) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing required fields', msg.id);
    }
    
    try {
      // 将base64数据转换为Buffer
      let buffer: Buffer;
      if (typeof data === 'string') {
        buffer = Buffer.from(data, 'base64');
      } else if (Array.isArray(data)) {
        buffer = Buffer.from(data);
      } else {
        return this.sendError(conn, 'INVALID_DATA', 'Invalid data format', msg.id);
      }
      
      const assetId = await this.assetService.uploadAvatar(userId, buffer, filename, mimeType);
      this.sendResponse(conn, 'AVATAR_UPLOADED', { assetId }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPLOAD_ERROR', error.message || 'Failed to upload avatar', msg.id);
    }
  }
  
  async handleUploadTexture(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { textureType, filename, mimeType, data, metadata } = msg.payload || {};
    
    if (!userId || !textureType || !filename || !mimeType || !data) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing required fields', msg.id);
    }
    
    try {
      // 将base64数据转换为Buffer
      let buffer: Buffer;
      if (typeof data === 'string') {
        buffer = Buffer.from(data, 'base64');
      } else if (Array.isArray(data)) {
        buffer = Buffer.from(data);
      } else {
        return this.sendError(conn, 'INVALID_DATA', 'Invalid data format', msg.id);
      }
      
      let assetId: string;
      
      switch (textureType) {
        case 'ship':
          assetId = await this.assetService.uploadShipTexture(
            userId, 
            buffer, 
            filename, 
            mimeType,
            metadata
          );
          break;
        case 'custom':
          assetId = await this.assetService.uploadCustomTexture(
            userId,
            buffer,
            filename,
            mimeType,
            metadata
          );
          break;
        default:
          return this.sendError(conn, 'INVALID_TYPE', `Unsupported texture type: ${textureType}`, msg.id);
      }
      
      this.sendResponse(conn, 'TEXTURE_UPLOADED', { assetId }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPLOAD_ERROR', error.message || 'Failed to upload texture', msg.id);
    }
  }
  
  // ========== 资产获取 ==========
  
  async handleGetAsset(conn: Connection, msg: any): Promise<void> {
    const assetId = msg.payload?.assetId;
    
    if (!assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      const asset = await this.assetService.getAsset(assetId);
      
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查访问权限
      const userId = conn.userId;
      const canAccess = await this.checkAssetAccess(userId, asset);
      
      if (!canAccess) {
        return this.sendError(conn, 'ACCESS_DENIED', 'No permission to access this asset', msg.id);
      }
      
      this.sendResponse(conn, 'ASSET_DETAILS', asset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'FETCH_ERROR', error.message || 'Failed to get asset', msg.id);
    }
  }
  
  async handleGetAssetData(conn: Connection, msg: any): Promise<void> {
    const assetId = msg.payload?.assetId;
    
    if (!assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      const asset = await this.assetService.getAsset(assetId);
      
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查访问权限
      const userId = conn.userId;
      const canAccess = await this.checkAssetAccess(userId, asset);
      
      if (!canAccess) {
        return this.sendError(conn, 'ACCESS_DENIED', 'No permission to access this asset', msg.id);
      }
      
      // 发送资产数据（base64编码）
      const base64Data = asset.data.toString('base64');
      this.sendResponse(conn, 'ASSET_DATA', {
        assetId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        data: base64Data
      }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'FETCH_ERROR', error.message || 'Failed to get asset data', msg.id);
    }
  }
  
  async handleGetAssetInfo(conn: Connection, msg: any): Promise<void> {
    const assetId = msg.payload?.assetId;
    
    if (!assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      const assetInfo = await this.assetService.getAssetInfo(assetId);
      
      if (!assetInfo) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查访问权限
      const userId = conn.userId;
      const asset = await this.assetService.getAsset(assetId);
      if (asset) {
        const canAccess = await this.checkAssetAccess(userId, asset);
        if (!canAccess) {
          return this.sendError(conn, 'ACCESS_DENIED', 'No permission to access this asset', msg.id);
        }
      }
      
      this.sendResponse(conn, 'ASSET_INFO', assetInfo, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'FETCH_ERROR', error.message || 'Failed to get asset info', msg.id);
    }
  }
  
  // ========== 资产列表和搜索 ==========
  
  async handleListAssets(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const filter = msg.payload?.filter;
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const assets = await this.assetService.listUserAssets(userId, filter);
      this.sendResponse(conn, 'ASSET_LIST', { assets }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'LIST_ERROR', error.message || 'Failed to list assets', msg.id);
    }
  }
  
  async handleGetAssetStats(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    
    if (!userId) {
      return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
    }
    
    try {
      const stats = await this.assetService.getAssetStats(userId);
      this.sendResponse(conn, 'ASSET_STATS', stats, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'STATS_ERROR', error.message || 'Failed to get asset stats', msg.id);
    }
  }
  
  // ========== 资产管理 ==========
  
  async handleUpdateAsset(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { assetId, updates } = msg.payload || {};
    
    if (!userId || !assetId || !updates) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId or updates', msg.id);
    }
    
    try {
      // 首先检查资产是否存在且用户有权限
      const asset = await this.assetService.getAsset(assetId);
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查所有权
      if (asset.ownerId !== `player:${userId}`) {
        return this.sendError(conn, 'ACCESS_DENIED', 'Only owner can update asset', msg.id);
      }
      
      const updatedAsset = await this.assetService.updateAsset(assetId, updates);
      this.sendResponse(conn, 'ASSET_UPDATED', updatedAsset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPDATE_ERROR', error.message || 'Failed to update asset', msg.id);
    }
  }
  
  async handleDeleteAsset(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const assetId = msg.payload?.assetId;
    
    if (!userId || !assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      // 首先检查资产是否存在且用户有权限
      const asset = await this.assetService.getAsset(assetId);
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查所有权
      if (asset.ownerId !== `player:${userId}`) {
        return this.sendError(conn, 'ACCESS_DENIED', 'Only owner can delete asset', msg.id);
      }
      
      const deleted = await this.assetService.deleteAsset(assetId);
      this.sendResponse(conn, 'ASSET_DELETED', { assetId, deleted }, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'DELETE_ERROR', error.message || 'Failed to delete asset', msg.id);
    }
  }
  
  async handleShareAsset(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const { assetId, userIds } = msg.payload || {};
    
    if (!userId || !assetId || !userIds || !Array.isArray(userIds)) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId or userIds', msg.id);
    }
    
    try {
      // 首先检查资产是否存在且用户有权限
      const asset = await this.assetService.getAsset(assetId);
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查所有权
      if (asset.ownerId !== `player:${userId}`) {
        return this.sendError(conn, 'ACCESS_DENIED', 'Only owner can share asset', msg.id);
      }
      
      const updatedAsset = await this.assetService.shareAsset(assetId, userIds);
      this.sendResponse(conn, 'ASSET_SHARED', updatedAsset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'SHARE_ERROR', error.message || 'Failed to share asset', msg.id);
    }
  }
  
  async handleMakeAssetPublic(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const assetId = msg.payload?.assetId;
    
    if (!userId || !assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      // 首先检查资产是否存在且用户有权限
      const asset = await this.assetService.getAsset(assetId);
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查所有权
      if (asset.ownerId !== `player:${userId}`) {
        return this.sendError(conn, 'ACCESS_DENIED', 'Only owner can change asset visibility', msg.id);
      }
      
      const updatedAsset = await this.assetService.makeAssetPublic(assetId);
      this.sendResponse(conn, 'ASSET_MADE_PUBLIC', updatedAsset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPDATE_ERROR', error.message || 'Failed to make asset public', msg.id);
    }
  }
  
  async handleMakeAssetPrivate(conn: Connection, msg: any): Promise<void> {
    const userId = conn.userId;
    const assetId = msg.payload?.assetId;
    
    if (!userId || !assetId) {
      return this.sendError(conn, 'INVALID_REQUEST', 'Missing assetId', msg.id);
    }
    
    try {
      // 首先检查资产是否存在且用户有权限
      const asset = await this.assetService.getAsset(assetId);
      if (!asset) {
        return this.sendError(conn, 'ASSET_NOT_FOUND', 'Asset not found', msg.id);
      }
      
      // 检查所有权
      if (asset.ownerId !== `player:${userId}`) {
        return this.sendError(conn, 'ACCESS_DENIED', 'Only owner can change asset visibility', msg.id);
      }
      
      const updatedAsset = await this.assetService.makeAssetPrivate(assetId);
      this.sendResponse(conn, 'ASSET_MADE_PRIVATE', updatedAsset, msg.id);
    } catch (error: any) {
      this.sendError(conn, 'UPDATE_ERROR', error.message || 'Failed to make asset private', msg.id);
    }
  }
  
   // ========== 头像特定处理 ==========
   
   async handleGetUserAvatar(conn: Connection, msg: any): Promise<void> {
     const userId = conn.userId;
     
     if (!userId) {
       return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
     }
     
     try {
       const avatar = await this.assetService.getUserAvatar(userId);
       
       if (!avatar) {
         return this.sendResponse(conn, 'AVATAR_NOT_FOUND', { exists: false }, msg.id);
       }
       
       this.sendResponse(conn, 'AVATAR_DETAILS', avatar, msg.id);
     } catch (error: any) {
       this.sendError(conn, 'FETCH_ERROR', error.message || 'Failed to get avatar', msg.id);
     }
   }
   
   async handleGetUserAvatarData(conn: Connection, msg: any): Promise<void> {
     const userId = conn.userId;
     
     if (!userId) {
       return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
     }
     
     try {
       const avatarData = await this.assetService.getUserAvatarData(userId);
       
       if (!avatarData) {
         return this.sendResponse(conn, 'AVATAR_NOT_FOUND', { exists: false }, msg.id);
       }
       
       const base64Data = avatarData.toString('base64');
       this.sendResponse(conn, 'AVATAR_DATA', {
         data: base64Data,
         mimeType: 'image/png'  // 假设是PNG格式
       }, msg.id);
     } catch (error: any) {
       this.sendError(conn, 'FETCH_ERROR', error.message || 'Failed to get avatar data', msg.id);
     }
   }
   
   async handleListUserAvatars(conn: Connection, msg: any): Promise<void> {
     const userId = conn.userId;
     
     if (!userId) {
       return this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
     }
     
     try {
       const avatars = await this.assetService.listUserAvatars(userId);
       this.sendResponse(conn, 'AVATAR_LIST', { avatars }, msg.id);
     } catch (error: any) {
       this.sendError(conn, 'LIST_ERROR', error.message || 'Failed to list avatars', msg.id);
     }
   }
   
   // ========== 辅助方法 ==========
   
   private async checkAssetAccess(userId: string | undefined, asset: any): Promise<boolean> {
    if (!userId) return false;
    
    // 公开资产任何人都可以访问
    if (asset.visibility === 'public') {
      return true;
    }
    
    // 所有者可以访问自己的资产
    if (asset.ownerId === `player:${userId}`) {
      return true;
    }
    
    // 共享资产：检查是否在共享列表中
    if (asset.visibility === 'shared' && asset.sharedWith?.includes(`player:${userId}`)) {
      return true;
    }
    
    return false;
  }
  
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