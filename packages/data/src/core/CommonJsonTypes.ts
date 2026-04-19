/**
 * Common JSON Types - 通用类型定义
 *
 * 基于 schemas/common.schema.json 生成的类型
 */

// ==================== 贴图类型 ====================

export type TextureSourceType = "url" | "uploaded" | "preset" | "none";

export interface Texture {
	sourceType: TextureSourceType;
	source?: string;
	transparentColor?: string;
	transparencyTolerance?: number;
	offsetX?: number;
	offsetY?: number;
	scale?: number;
}

// ==================== 派系类型 ====================

export type FactionType = "PLAYER" | "ENEMY" | "NEUTRAL";
// ==================== 辐能状态 ====================

export type FluxStateType = "NORMAL" | "HIGH" | "OVERLOADED" | "VENTING";
// ==================== 游戏阶段类型 ====================

export type GamePhaseType = "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";

// ==================== 元数据类型 ====================

export interface Metadata {
  name: string;
  description?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
  tags?: string[];
  
  // 玩家档案扩展字段
  owner?: string;        // player:xxx
  isPresetCopy?: boolean;
  originalPresetId?: string;
}

// ==================== 辅助函数 ====================

export function createTexture(): Texture {
	return {
		sourceType: "none",
		scale: 1.0,
		offsetX: 0,
		offsetY: 0,
	};
}
