/**
 * 命令 Payload 类型定义
 *
 * Payload 内聚：命令 Payload 类型定义在 commands 目录下
 * 与 handler 文件放在一起，保持内聚
 */

import type {
	FactionValue,
	MovePhaseValue,
	MovementPlan,
	ConnectionQualityValue,
} from "../schema/types.js";

// ==================== 移动命令 ====================

export interface ChatPayload {
	content: string;
}

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

// ==================== DM 指令 ====================

export interface ClearOverloadPayload {
	shipId: string;
}

export interface SetArmorPayload {
	shipId: string;
	section: number;
	value: number;
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

export interface NetPongPayload {
	seq: number;
	serverTime: number;
	pingMs: number;
	jitterMs: number;
	quality: ConnectionQualityValue;
}