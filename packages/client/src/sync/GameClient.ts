/**
 * GameClient - 游戏命令发送层
 *
 * 职责：
 * - 封装所有游戏命令的发送逻辑
 * - 提供类型安全的命令接口
 * - 不负责连接管理（由 NetworkManager 处理）
 */

import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@/sync/types";

// 命令 Payload 类型
export interface MovePayload {
	shipId: string;
	movementPlan: {
		phaseAForward: number;
		phaseAStrafe: number;
		turnAngle: number;
		phaseCForward: number;
		phaseCStrafe: number;
	};
	isIncremental?: boolean;
}

export interface FireWeaponPayload {
	attackerId: string;
	weaponId: string;
	targetId: string;
}

export interface ToggleShieldPayload {
	shipId: string;
	isActive: boolean;
	orientation?: number;
}

export interface UpdateProfilePayload {
	nickname?: string;
	avatar?: string;
}

export class GameClient {
	constructor(private room: Room<GameRoomState>) {}

	// ==================== 移动命令 ====================

	/** 发送移动计划 */
	sendMove(payload: MovePayload): void {
		this.room.send("MOVE_TOKEN", payload);
	}

	/** 推进移动阶段 */
	sendAdvanceMovePhase(shipId: string): void {
		this.room.send("ADVANCE_MOVE_PHASE", { shipId });
	}

	// ==================== 武器命令 ====================

	/** 发送开火命令 */
	sendFireWeapon(payload: FireWeaponPayload): void {
		this.room.send("FIRE_WEAPON", payload);
	}

	// ==================== 护盾命令 ====================

	/** 切换护盾状态 */
	sendToggleShield(payload: ToggleShieldPayload): void {
		this.room.send("TOGGLE_SHIELD", payload);
	}

	// ==================== 玩家命令 ====================

	/** 更新玩家档案 */
	sendUpdateProfile(payload: UpdateProfilePayload): void {
		this.room.send("ROOM_UPDATE_PROFILE", payload);
	}

	/** 切换准备状态 */
	sendToggleReady(): void {
		this.room.send("TOGGLE_READY", {});
	}

	/** 结束回合 */
	sendEndTurn(): void {
		this.room.send("END_TURN", {});
	}

	// ==================== 房间命令 ====================

	/** 创建对象（DM专用） */
	sendCreateObject(payload: {
		type: "ship" | "asteroid" | "station";
		x: number;
		y: number;
		heading: number;
		hullId?: string;
		faction?: string;
	}): void {
		this.room.send("CREATE_OBJECT", payload);
	}

	/** 分配舰船 */
	sendAssignShip(payload: { shipId: string; playerId: string }): void {
		this.room.send("ASSIGN_SHIP", payload);
	}

	/** 解散房间（房主专用） */
	sendDissolveRoom(): void {
		this.room.send("ROOM_DISSOLVE");
	}

	/** 踢出玩家（房主专用） */
	sendKickPlayer(playerId: string): void {
		this.room.send("KICK_PLAYER", { playerId });
	}

	// ==================== 存档命令 ====================

	/** 保存游戏 */
	sendSaveGame(name: string): void {
		this.room.send("SAVE_GAME", { name });
	}

	/** 加载游戏 */
	sendLoadGame(saveId: string): void {
		this.room.send("LOAD_GAME", { saveId });
	}

	// ==================== 网络调试 ====================

	/** 发送 Ping（用于延迟测量） */
	sendPing(timestamp: number): void {
		this.room.send("NET_PING", { timestamp });
	}

	// ==================== 权限检查 ====================

	/** 检查是否可以控制舰船 */
	canControlShip(shipOwnerId: string, sessionId: string, playerRole: string): boolean {
		if (playerRole === "DM") return true;
		return shipOwnerId === sessionId;
	}

	/** 检查是否是房主 */
	isRoomOwner(sessionId: string, roomOwnerId: string | null): boolean {
		return sessionId === roomOwnerId;
	}
}