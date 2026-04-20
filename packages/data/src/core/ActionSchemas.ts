/**
 * 游戏 Action 类型定义
 *
 * 使用 Zod Schema 定义所有游戏 Action 的负载类型，
 * 替代原 actions/ 目录下的手写接口和验证函数。
 *
 * 设计原则：
 * 1. Action Payload 与 Socket.IO 协议共享同一套 Zod Schema
 * 2. 运行时验证通过 .parse() / .safeParse()
 * 3. TypeScript 类型从 Schema 自动推导
 */

import { z } from "zod";

// ==================== 基础 Action 结构 ====================

export const GameActionSchema = z.object({
	type: z.string(),
	playerId: z.string(),
	timestamp: z.number(),
	payload: z.record(z.string(), z.any()),
});

export type GameAction = z.infer<typeof GameActionSchema>;

// ==================== 移动 Action ====================

export const MoveActionPayloadSchema = z.object({
	shipId: z.string(),
	forwardDistance: z.number().optional(),
	strafeDistance: z.number().optional(),
});

export type MoveActionPayload = z.infer<typeof MoveActionPayloadSchema>;

// ==================== 旋转 Action ====================

export const RotateActionPayloadSchema = z.object({
	shipId: z.string(),
	angle: z.number(),
});

export type RotateActionPayload = z.infer<typeof RotateActionPayloadSchema>;

// ==================== 攻击 Action ====================

export const AttackActionPayloadSchema = z.object({
	attackerId: z.string(),
	weaponAllocations: z.array(
		z.object({
			mountId: z.string(),
			targets: z.array(
				z.object({
					targetId: z.string(),
					shotCount: z.number(),
					targetQuadrant: z.number().min(0).max(5).optional(),
				})
			),
		})
	),
});

export type AttackActionPayload = z.infer<typeof AttackActionPayloadSchema>;

// ==================== 护盾 Action ====================

export const ToggleShieldPayloadSchema = z.object({
	shipId: z.string(),
	active: z.boolean(),
});

export type ToggleShieldPayload = z.infer<typeof ToggleShieldPayloadSchema>;

// ==================== 辐能 Action ====================

export const VentFluxPayloadSchema = z.object({
	shipId: z.string(),
});

export type VentFluxPayload = z.infer<typeof VentFluxPayloadSchema>;

// ==================== 回合 Action ====================

export const EndTurnPayloadSchema = z.object({});

export type EndTurnPayload = z.infer<typeof EndTurnPayloadSchema>;

// ==================== 阶段推进 Action ====================

export const AdvancePhasePayloadSchema = z.object({
	shipId: z.string(),
});

export type AdvancePhasePayload = z.infer<typeof AdvancePhasePayloadSchema>;

// ==================== Socket.IO 事件映射 ====================

/**
 * Socket.IO 事件名到 Action Payload Schema 的映射
 * 用于统一前后端协议
 */
export const SocketIOActionMap = {
	"game:move": MoveActionPayloadSchema,
	"game:rotate": RotateActionPayloadSchema,
	"game:attack": AttackActionPayloadSchema,
	"game:toggle_shield": ToggleShieldPayloadSchema,
	"game:vent_flux": VentFluxPayloadSchema,
	"game:end_turn": EndTurnPayloadSchema,
	"game:advance_phase": AdvancePhasePayloadSchema,
} as const;

export type SocketIOActionEvent = keyof typeof SocketIOActionMap;

/**
 * 验证 Socket.IO 事件负载
 */
export function validateActionPayload(
	event: SocketIOActionEvent,
	payload: unknown
): { success: true; data: any } | { success: false; error: string } {
	const schema = SocketIOActionMap[event];
	if (!schema) {
		return { success: false, error: `Unknown event: ${event}` };
	}

	const result = schema.safeParse(payload);
	if (result.success) {
		return { success: true, data: result.data };
	} else {
		return { success: false, error: result.error.message };
	}
}

/**
 * 创建 GameAction
 */
export function createGameAction(
	event: SocketIOActionEvent,
	playerId: string,
	payload: unknown
): GameAction | null {
	const validation = validateActionPayload(event, payload);
	if (!validation.success) {
		console.error(`[Action] Validation failed: ${validation.error}`);
		return null;
	}

	return {
		type: event,
		playerId,
		timestamp: Date.now(),
		payload: validation.data,
	};
}
