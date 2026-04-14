/**
 * 消息 Payload 类型定义
 *
 * 定义客户端发送到服务端的命令 Payload 结构
 */

import type { FactionValue } from "./enums.js";
import type { MovementPlan } from "./movement.js";

// ==================== 移动命令 ====================

export interface MoveTokenPayload {
	shipId: string;
	x: number;
	y: number;
	heading: number;
	movementPlan?: MovementPlan;
	phase?: string;
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

// ==================== 舰船分配命令 ====================

export interface AssignShipPayload {
	shipId: string;
	ownerId: string;
}

// ==================== 准备状态切换 ====================

export interface ToggleReadyPayload {}

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
	clientTime: number;
}

export interface NetPongPayload {
	clientTime: number;
	serverTime: number;
}
