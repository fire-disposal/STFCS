/**
 * 资产存储相关类型定义
 */

export type AssetType = 
  | "avatar"           // 玩家头像
  | "ship_texture"     // 舰船贴图
  | "weapon_texture"   // 武器贴图
  | "obstacle_texture" // 障碍物贴图
  | "map_texture"      // 地图贴图
  | "ui_texture"       // UI贴图
  | "custom_texture";  // 自定义贴图

export interface Asset {
  $schema: "asset-v1";
  $id: string;  // asset:uuid
  
  // 基础信息
  type: AssetType;
  filename: string;
  mimeType: string;
  size: number;
  
  // 元数据
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    width?: number;
    height?: number;
    format?: string;
    author?: string;
    license?: string;
  };
  
  // 所有者
  ownerId: string;  // player:xxx
  uploadedAt: number;
  updatedAt?: number;
  
  // 访问控制
  visibility: "private" | "public" | "shared";
  sharedWith?: string[];  // 共享给的用户ID列表
  
  // 二进制数据
  data: Buffer;
}

export interface AssetUploadRequest {
  type: AssetType;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  metadata?: Asset["metadata"];
  visibility?: "private" | "public" | "shared";
  sharedWith?: string[];
}

export interface AssetListItem {
  $id: string;
  type: AssetType;
  filename: string;
  mimeType: string;
  size: number;
  metadata?: Asset["metadata"];
  ownerId: string;
  uploadedAt: number;
  updatedAt?: number;
  visibility: "private" | "public" | "shared";
}

export interface AssetFilter {
  type?: AssetType | AssetType[];
  ownerId?: string;
  visibility?: "private" | "public" | "shared";
  tags?: string[];
  search?: string;
  sharedWith?: string;  // 查看共享给我的资产
  sortBy?: "uploadedAt" | "updatedAt" | "filename" | "size";
  sortOrder?: "asc" | "desc";
}

export interface AssetStats {
  total: number;
  byType: Record<AssetType, number>;
  byVisibility: Record<string, number>;
  totalSize: number;
  oldest: Date | null;
  newest: Date | null;
}