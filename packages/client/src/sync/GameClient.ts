/**
 * GameClient - 游戏命令发送层
 *
 * 职责：
 * - 封装所有游戏命令的发送逻辑
 * - 提供类型安全的命令接口
 * - 不负责连接管理（由 NetworkManager 处理）
 *
 * 类型来源：
 * - Payload 类型从 @vt/schema-types 导入（与后端 100% 同步）
 * - 命令常量从 @vt/data 导入
 */

import type { Room } from "@colyseus/sdk";
import { ClientCommand } from "@vt/data";
import type { GameRoomState } from "@/sync/types";
import type {
	MoveTokenPayload,
	ToggleShieldPayload,
	FireWeaponPayload,
	VentFluxPayload,
	ConfigureWeaponPayload,
	ConfigureVariantPayload,
	SaveVariantPayload,
	LoadVariantPayload,
	DeleteVariantPayload,
	RepairWeaponPayload,
	ClearOverloadPayload,
	SetArmorPayload,
	AdvanceMovePhasePayload,
	AssignShipPayload,
	ToggleReadyPayload,
	NextPhasePayload,
	CreateObjectPayload,
	SaveGamePayload,
	LoadGamePayload,
	DeleteSavePayload,
	ListSavesPayload,
	KickPlayerPayload,
	UpdateProfilePayload,
	NetPingPayload,
} from "@vt/server/commands/types";

export class GameClient {
	constructor(private room: Room<GameRoomState>) {}

	// ==================== 移动命令 ====================

	/** 发送移动计划 */
	sendMove(payload: MoveTokenPayload): void {
		this.room.send(ClientCommand.CMD_MOVE_TOKEN, payload);
	}

	/** 推进移动阶段 */
	sendAdvanceMovePhase(shipId: string): void {
		const payload: AdvanceMovePhasePayload = { shipId };
		this.room.send(ClientCommand.CMD_ADVANCE_MOVE_PHASE, payload);
	}

	// ==================== 武器命令 ====================

	/** 发送开火命令 */
	sendFireWeapon(payload: FireWeaponPayload): void {
		this.room.send(ClientCommand.CMD_FIRE_WEAPON, payload);
	}

	/** 配置武器（更换挂载点武器） */
	sendConfigureWeapon(payload: ConfigureWeaponPayload): void {
		this.room.send(ClientCommand.CMD_CONFIGURE_WEAPON, payload);
	}

	/** 配置舰船变体 */
	sendConfigureVariant(payload: ConfigureVariantPayload): void {
		this.room.send(ClientCommand.CMD_CONFIGURE_VARIANT, payload);
	}

	/** 修复武器（DM专用） */
	sendRepairWeapon(shipId: string, weaponId: string): void {
		const payload: RepairWeaponPayload = { shipId, weaponId };
		this.room.send(ClientCommand.CMD_REPAIR_WEAPON, payload);
	}

	// ==================== 护盾命令 ====================

	/** 切换护盾状态 */
	sendToggleShield(payload: ToggleShieldPayload): void {
		this.room.send(ClientCommand.CMD_TOGGLE_SHIELD, payload);
	}

	// ==================== 辐能命令 ====================

	/** 排散辐能 */
	sendVentFlux(shipId: string): void {
		const payload: VentFluxPayload = { shipId };
		this.room.send(ClientCommand.CMD_VENT_FLUX, payload);
	}

	/** 清除过载（DM专用） */
	sendClearOverload(shipId: string): void {
		const payload: ClearOverloadPayload = { shipId };
		this.room.send(ClientCommand.CMD_CLEAR_OVERLOAD, payload);
	}

	/** 设置护甲（DM专用） */
	sendSetArmor(payload: SetArmorPayload): void {
		this.room.send(ClientCommand.CMD_SET_ARMOR, payload);
	}

	// ==================== 玩家档案命令 ====================

	/** 保存自定义变体 */
	sendSaveVariant(payload: SaveVariantPayload): void {
		this.room.send(ClientCommand.CMD_SAVE_VARIANT, payload);
	}

	/** 加载自定义变体 */
	sendLoadVariant(variantId: string): void {
		const payload: LoadVariantPayload = { variantId };
		this.room.send(ClientCommand.CMD_LOAD_VARIANT, payload);
	}

	/** 删除自定义变体 */
	sendDeleteVariant(variantId: string): void {
		const payload: DeleteVariantPayload = { variantId };
		this.room.send(ClientCommand.CMD_DELETE_VARIANT, payload);
	}

	/** 获取玩家档案 */
	sendGetProfile(): void {
		this.room.send(ClientCommand.CMD_GET_PROFILE, {});
	}

	/** 更新玩家设置 */
	sendUpdateSettings(payload: UpdateProfilePayload): void {
		this.room.send(ClientCommand.CMD_UPDATE_SETTINGS, payload);
	}

	// ==================== 玩家命令 ====================

	/** 更新玩家档案 */
	sendUpdateProfile(payload: UpdateProfilePayload): void {
		this.room.send(ClientCommand.CMD_UPDATE_PROFILE, payload);
	}

	/** 切换准备状态 */
	sendToggleReady(isReady: boolean): void {
		const payload: ToggleReadyPayload = { isReady };
		this.room.send(ClientCommand.CMD_TOGGLE_READY, payload);
	}

	/** 结束回合 */
	sendEndTurn(): void {
		const payload: NextPhasePayload = {};
		this.room.send(ClientCommand.CMD_NEXT_PHASE, payload);
	}

	// ==================== 房间命令 ====================

	/** 创建对象（DM专用） */
	sendCreateObject(payload: CreateObjectPayload): void {
		this.room.send(ClientCommand.CMD_CREATE_OBJECT, payload);
	}

	/** 分配舰船 */
	sendAssignShip(payload: AssignShipPayload): void {
		this.room.send(ClientCommand.CMD_ASSIGN_SHIP, payload);
	}

	/** 解散房间（房主专用） */
	sendDissolveRoom(): void {
		this.room.send(ClientCommand.CMD_ROOM_DISSOLVE, {});
	}

	/** 踢出玩家（房主专用） */
	sendKickPlayer(payload: KickPlayerPayload): void {
		this.room.send(ClientCommand.CMD_KICK_PLAYER, payload);
	}

	// ==================== 存档命令 ====================

	/** 保存游戏 */
	sendSaveGame(payload: SaveGamePayload): void {
		this.room.send(ClientCommand.CMD_SAVE_GAME, payload);
	}

	/** 加载游戏 */
	sendLoadGame(payload: LoadGamePayload): void {
		this.room.send(ClientCommand.CMD_LOAD_GAME, payload);
	}

	/** 删除存档 */
	sendDeleteSave(saveId: string): void {
		const payload: DeleteSavePayload = { saveId };
		this.room.send(ClientCommand.CMD_DELETE_SAVE, payload);
	}

	/** 获取存档列表 */
	sendListSaves(): void {
		const payload: ListSavesPayload = {};
		this.room.send(ClientCommand.CMD_LIST_SAVES, payload);
	}

	// ==================== 网络调试 ====================

	/** 发送 Ping（用于延迟测量） */
	sendNetPing(payload: NetPingPayload): void {
		this.room.send("NET_PING", payload);
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