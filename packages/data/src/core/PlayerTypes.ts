/**
 * 玩家档案相关类型定义
 */

import type { ShipJSON } from "./ShipJsonTypes.js";
import type { WeaponJSON } from "./WeaponJsonTypes.js";

// ==================== 游戏存档 ====================

/**
 * 存档元数据
 */
export interface SaveMetadata {
  name: string;
  description?: string | undefined;
  tags?: string[] | undefined;
  version?: string | undefined;  // 游戏版本
  thumbnail?: string | undefined; // 缩略图URL或base64
}

/**
 * 游戏存档
 */
export interface GameSave {
  $schema: "save-v1";
  $id: string;  // save:player_uuid_timestamp
  
  // 存档信息
  metadata: SaveMetadata;
  
  // 游戏状态快照
  gameState: any;  // 完整的GameState JSON
  
  // 游戏信息
  gameInfo: {
    turn: number;
    phase: string;
    activeFaction?: string;
    playerCount: number;
    mapSize?: { width: number; height: number };
    victoryCondition?: string;
  };
  
  // 玩家信息快照
  players: Array<{
    id: string;
    name: string;
    faction: string;
    role: string;
    ships: string[]; // 舰船ID列表
    score?: number;
  }>;
  
  // 时间戳
  createdAt: number;
  updatedAt?: number;
  lastLoaded?: number;
  
  // 统计信息
  stats?: {
    totalTurns: number;
    totalDamage: number;
    shipsDestroyed: number;
    gameDuration?: number; // 游戏时长（秒）
  };
}

/**
 * 存档创建请求
 */
export interface SaveCreationRequest {
  name: string;
  description?: string;
  tags?: string[];
  gameState: any;
  thumbnail?: string;
}

/**
 * 存档更新请求
 */
export interface SaveUpdateRequest {
  name?: string;
  description?: string;
  tags?: string[];
  thumbnail?: string;
}

/**
 * 存档列表项（简略信息）
 */
export interface SaveListItem {
  $id: string;
  metadata: SaveMetadata;
  gameInfo: {
    turn: number;
    phase: string;
    playerCount: number;
  };
  createdAt: number;
  updatedAt?: number;
  lastLoaded?: number;
  size?: number; // 存档大小（字节）
}

/**
 * 存档导入/导出格式
 */
export interface SaveExport {
  $schema: "save-export-v1";
  save: GameSave;
  exportedAt: number;
  exportedBy: string;
  gameVersion: string;
}

// ==================== 玩家档案 ====================

export interface PlayerProfile {
  $schema: "player-v1";
  $id: string;  // player:uuid
  
  // 基础信息
  username: string;
  displayName: string;
  
  // 头像引用
  avatarAssetId?: string;  // asset:xxx
  
  // 游戏数据
  ships: ShipJSON[];      // 玩家所有舰船
  weapons: WeaponJSON[];  // 玩家所有武器
  saves: GameSave[];      // 玩家所有存档
  
  // 统计信息
  stats: {
    gamesPlayed: number;
    wins: number;
    totalDamage: number;
  };
  
  // 时间戳
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
}

// ==================== 纹理引用 ====================

export interface TextureRef {
  assetId?: string;  // 引用的资产ID
  url?: string;      // 外部URL（备用）
}