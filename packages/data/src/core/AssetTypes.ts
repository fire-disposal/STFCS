/**
 * 资产存储相关类型定义
 */

export interface Asset {
  $schema: "asset-v1";
  $id: string;  // asset:uuid
  
  // 基础信息
  type: "avatar" | "ship_texture" | "weapon_texture";
  filename: string;
  mimeType: string;
  size: number;
  
  // 所有者
  ownerId: string;  // player:xxx
  uploadedAt: number;
  
  // 二进制数据
  data: Buffer;
}