/**
 * 命令 Payload 类型定义
 *
 * Payload 内聚：命令 Payload 类型定义在 commands 目录下
 * 与 handler 文件放在一起，保持内聚
 *
 * 这是客户端请求的唯一 Payload 类型来源
 */

import type { FactionValue, MovePhaseValue } from "@vt/data";
import type { MovementPlan } from "../schema/types.js";

// ==================== 移动命令 ====================

export interface MoveTokenPayload {
	shipId: string;
	x: number;
	y: number;
	heading: number;
	movementPlan?: MovementPlan;
	phase?: MovePhaseValue;
	isIncremental?: boolean;
}

// ==================== 护盾切换命令 ====================

export interface ToggleShieldPayload {
	shipId: string;
	isActive: boolean;
	orientation?: number;
}

// ==================== 开火命令 ====================

export interface FireWeaponPayload {
	attackerId: string;
	weaponId: string;
	targetId: string;
}

// ==================== 辐能排散命令 ====================

export interface VentFluxPayload {
	shipId: string;
}

// ==================== 武器配置命令 ====================

export interface ConfigureWeaponPayload {
	shipId: string;
	mountId: string;
	weaponSpecId: string;    // 空字符串表示清空武器
}

// ==================== 舰船变体配置命令 ====================

export interface ConfigureVariantPayload {
	hullId: string;
	variantId?: string;      // 可选，用于加载预设变体
	weaponLoadout?: WeaponLoadoutEntry[];  // 自定义武器配置
	name?: string;           // 变体名称
}

export interface WeaponLoadoutEntry {
	mountId: string;
	weaponSpecId: string;
}

// ==================== 玩家档案命令 ====================

export interface SaveVariantPayload {
	variantId: string;       // 变体 ID（本地生成）
	hullId: string;
	name: string;
	weaponLoadout: WeaponLoadoutEntry[];
}

export interface LoadVariantPayload {
	variantId: string;
}

export interface DeleteVariantPayload {
	variantId: string;
}

// ==================== DM 指令 ====================

export interface ClearOverloadPayload {
	shipId: string;
}

export interface SetArmorPayload {
	shipId: string;
	quadrant: number; // 0-5 对应 ArmorQuadrant
	value: number;
}

export interface RepairWeaponPayload {
	shipId: string;
	weaponId: string;        // 武器实例 ID
}

// ==================== 移动阶段推进 ====================

export interface AdvanceMovePhasePayload {
	shipId: string;
}

// ==================== 舰船分配命令 ====================

export interface AssignShipPayload {
	shipId: string;
	targetSessionId: string;
}

// ==================== 准备状态切换 ====================

export interface ToggleReadyPayload {
	isReady: boolean;
}

// ==================== 阶段切换 ====================

export interface NextPhasePayload {}

// ==================== 创建对象 ====================

export interface CreateObjectPayload {
	type: "ship" | "station" | "asteroid";
	hullId?: string;
	x: number;
	y: number;
	heading?: number;
	faction?: FactionValue;
	ownerId?: string;
	name?: string;
}

// ==================== 网络心跳 ====================

export interface NetPingPayload {
	seq: number;
	clientSentAt: number;
}

// ==================== 存档命令 ====================

export interface SaveGamePayload {
	name?: string;           // 存档名称（可选）
	description?: string;    // 存档描述（可选）
}

export interface LoadGamePayload {
	saveId: string;
}

export interface DeleteSavePayload {
	saveId: string;
}

export interface ListSavesPayload {}

// ==================== 房间管理命令 ====================

export interface KickPlayerPayload {
	playerId: string;
}

export interface UpdateProfilePayload {
	nickname?: string;
	avatar?: string;
}