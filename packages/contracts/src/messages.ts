/**
 * 消息协议 Schema 定义
 * 使用 Zod 进行运行时验证
 * 与 ClientCommand 枚举一一对应
 */

import { z } from "zod/v4";
import { Faction } from "./definitions/enums.js";

// ==================== 基础类型 ====================

// ==================== 移动指令 ====================

export const MoveTokenSchema = z.object({
	shipId: z.string(),
	x: z.number(),
	y: z.number(),
	heading: z.number(),
	movementPlan: z
		.object({
			phaseAForward: z.number(),
			phaseAStrafe: z.number(),
			turnAngle: z.number(),
			phaseBForward: z.number(),
			phaseBStrafe: z.number(),
		})
		.optional(),
	phase: z.enum(["PHASE_A", "ATTACK_1", "PHASE_B", "ATTACK_2", "PHASE_C"]).optional(),
	isIncremental: z.boolean().optional(),
});

export type MoveTokenPayload = z.infer<typeof MoveTokenSchema>;

// ==================== 护盾指令 ====================

export const ToggleShieldSchema = z.object({
	shipId: z.string(),
	isActive: z.boolean(),
	orientation: z.number().optional(),
});

export type ToggleShieldPayload = z.infer<typeof ToggleShieldSchema>;

// ==================== 开火指令 ====================

export const FireWeaponSchema = z.object({
	attackerId: z.string(),
	weaponId: z.string(),
	targetId: z.string(),
});

export type FireWeaponPayload = z.infer<typeof FireWeaponSchema>;

// ==================== 排散指令 ====================

export const VentFluxSchema = z.object({
	shipId: z.string(),
});

export type VentFluxPayload = z.infer<typeof VentFluxSchema>;

// ==================== 分配舰船指令 ====================

export const AssignShipSchema = z.object({
	shipId: z.string(),
	targetSessionId: z.string(),
});

export type AssignShipPayload = z.infer<typeof AssignShipSchema>;

// ==================== 切换准备状态 ====================

export const ToggleReadySchema = z.object({
	isReady: z.boolean(),
});

export type ToggleReadyPayload = z.infer<typeof ToggleReadySchema>;

// ==================== 下一阶段指令 ====================

export const NextPhaseSchema = z.object({});

export type NextPhasePayload = z.infer<typeof NextPhaseSchema>;

// ==================== DM 创建对象 ====================

export const DMCreateObjectSchema = z.object({
	type: z.enum(["ship", "station", "asteroid"]),
	hullId: z.string().optional(),
	x: z.number(),
	y: z.number(),
	heading: z.number(),
	faction: z.nativeEnum(Faction),
	ownerId: z.string().optional(),
});

export type DMCreateObjectPayload = z.infer<typeof DMCreateObjectSchema>;

// ==================== DM 清除过载 ====================

export const DMClearOverloadSchema = z.object({
	shipId: z.string(),
});

export type DMClearOverloadPayload = z.infer<typeof DMClearOverloadSchema>;

// ==================== DM 修改护甲 ====================

export const DMSetArmorSchema = z.object({
	shipId: z.string(),
	section: z.number(),
	value: z.number(),
});

export type DMSetArmorPayload = z.infer<typeof DMSetArmorSchema>;

// ==================== 创建测试舰船（旧接口） ====================

export const CreateTestShipSchema = z.object({
	faction: z.nativeEnum(Faction),
	x: z.number(),
	y: z.number(),
});

export type CreateTestShipPayload = z.infer<typeof CreateTestShipSchema>;

// ==================== 聊天消息 ====================

export const ChatMessageSchema = z.object({
	content: z.string(),
	playerName: z.string().optional(),
});

export type ChatMessagePayload = z.infer<typeof ChatMessageSchema>;

// ==================== 更新个人资料 ====================

export const UpdateProfileSchema = z.object({
	nickname: z.string().optional(),
	avatar: z.string().optional(),
});

export type UpdateProfilePayload = z.infer<typeof UpdateProfileSchema>;

// ==================== 踢出玩家 ====================

export const KickPlayerSchema = z.object({
	targetSessionId: z.string().optional(),
});

export type KickPlayerPayload = z.infer<typeof KickPlayerSchema>;

// ==================== 网络 Ping ====================

export const NetPingSchema = z.object({
	seq: z.number(),
	clientSentAt: z.number(),
});

export type NetPingPayload = z.infer<typeof NetPingSchema>;

// ==================== 消息 Schema 映射表 ====================

export const MessageSchemas = {
	CMD_MOVE_TOKEN: MoveTokenSchema,
	CMD_TOGGLE_SHIELD: ToggleShieldSchema,
	CMD_FIRE_WEAPON: FireWeaponSchema,
	CMD_VENT_FLUX: VentFluxSchema,
	CMD_ASSIGN_SHIP: AssignShipSchema,
	CMD_TOGGLE_READY: ToggleReadySchema,
	CMD_NEXT_PHASE: NextPhaseSchema,
	DM_CREATE_OBJECT: DMCreateObjectSchema,
	DM_CLEAR_OVERLOAD: DMClearOverloadSchema,
	DM_SET_ARMOR: DMSetArmorSchema,
	CREATE_TEST_SHIP: CreateTestShipSchema,
	chat: ChatMessageSchema,
	ROOM_UPDATE_PROFILE: UpdateProfileSchema,
	ROOM_KICK_PLAYER: KickPlayerSchema,
	NET_PING: NetPingSchema,
} as const;

export type MessageSchemaMap = typeof MessageSchemas;
export type MessagePayloads = {
	CMD_MOVE_TOKEN: MoveTokenPayload;
	CMD_TOGGLE_SHIELD: ToggleShieldPayload;
	CMD_FIRE_WEAPON: FireWeaponPayload;
	CMD_VENT_FLUX: VentFluxPayload;
	CMD_ASSIGN_SHIP: AssignShipPayload;
	CMD_TOGGLE_READY: ToggleReadyPayload;
	CMD_NEXT_PHASE: NextPhasePayload;
	DM_CREATE_OBJECT: DMCreateObjectPayload;
	DM_CLEAR_OVERLOAD: DMClearOverloadPayload;
	DM_SET_ARMOR: DMSetArmorPayload;
	CREATE_TEST_SHIP: CreateTestShipPayload;
	chat: ChatMessagePayload;
	ROOM_UPDATE_PROFILE: UpdateProfilePayload;
	ROOM_KICK_PLAYER: KickPlayerPayload;
	NET_PING: NetPingPayload;
};
