/**
 * Action 处理器（Zod 验证版）
 *
 * 使用 @vt/data 的 Zod Schema 替代手写验证，
 * 保留速率限制等非验证逻辑。
 */

import { createLogger } from "../../infra/simple-logger.js";
import { gameRuntime } from "../../runtime/index.js";
import type { GameAction } from "../../core/types/common.js";
import { validateActionPayload } from "@vt/data";
import type { SocketIOActionEvent } from "@vt/data";

const logger = createLogger("action-handler");

/** Socket.IO 事件名到 Engine Action 类型的映射 */
const EVENT_TO_ACTION_TYPE: Record<SocketIOActionEvent, string> = {
	"game:move": "MOVE",
	"game:rotate": "ROTATE",
	"game:attack": "ATTACK",
	"game:toggle_shield": "TOGGLE_SHIELD",
	"game:vent_flux": "VENT_FLUX",
	"game:end_turn": "END_TURN",
	"game:advance_phase": "ADVANCE_PHASE",
};

export interface ActionHandlerConfig {
	validateActions: boolean;
	maxActionsPerSecond: number;
	actionTimeout: number;
}

const DEFAULT_CONFIG: ActionHandlerConfig = {
	validateActions: true,
	maxActionsPerSecond: 10,
	actionTimeout: 5000,
};

export class ActionHandler {
	private config: ActionHandlerConfig;
	private actionCounters = new Map<string, { count: number; resetTime: number }>();

	constructor(config: Partial<ActionHandlerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * 处理游戏 Action
	 * @param roomId 房间ID
	 * @param playerId 玩家ID
	 * @param event Socket.IO 事件名（如 "game:move"）
	 * @param payload 事件负载
	 */
	async handleAction(
		roomId: string,
		playerId: string,
		event: SocketIOActionEvent,
		payload: unknown
	): Promise<{ success: boolean; error?: string; events?: any[] }> {
		const sessionKey = `${roomId}:${playerId}`;

		// 速率限制
		if (!this.checkRateLimit(sessionKey)) {
			return { success: false, error: "Action rate limit exceeded" };
		}

		// Zod 验证（来自 @vt/data）
		if (this.config.validateActions) {
			const validation = validateActionPayload(event, payload);
			if (!validation.success) {
				return { success: false, error: validation.error };
			}
		}

		// 映射为 Engine Action
		const action: GameAction = {
			type: EVENT_TO_ACTION_TYPE[event] || event,
			playerId,
			timestamp: Date.now(),
			payload,
		};

		try {
			const result = await this.processWithTimeout(roomId, action);
			if (result.success) {
				this.incrementCounter(sessionKey);
			}
			return result;
		} catch (error) {
			logger.error("Failed to handle action", error, { roomId, playerId, event });
			return { success: false, error: "Internal server error" };
		}
	}

	private async processWithTimeout(
		roomId: string,
		action: GameAction
	): Promise<{ success: boolean; error?: string; events?: any[] }> {
		if (this.config.actionTimeout <= 0) {
			return gameRuntime.processAction(roomId, action);
		}

		const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
			setTimeout(() => resolve({ success: false, error: "Action processing timeout" }), this.config.actionTimeout);
		});

		return Promise.race([gameRuntime.processAction(roomId, action), timeoutPromise]);
	}

	// ==================== 速率限制 ====================

	private checkRateLimit(sessionKey: string): boolean {
		if (this.config.maxActionsPerSecond <= 0) return true;

		const now = Date.now();
		const counter = this.actionCounters.get(sessionKey);

		if (!counter) {
			this.actionCounters.set(sessionKey, { count: 1, resetTime: now + 1000 });
			return true;
		}

		if (now >= counter.resetTime) {
			counter.count = 1;
			counter.resetTime = now + 1000;
			return true;
		}

		if (counter.count >= this.config.maxActionsPerSecond) {
			return false;
		}

		return true;
	}

	private incrementCounter(sessionKey: string): void {
		const counter = this.actionCounters.get(sessionKey);
		if (counter) counter.count++;
	}

	cleanupExpiredCounters(): void {
		const now = Date.now();
		for (const [key, counter] of this.actionCounters.entries()) {
			if (now >= counter.resetTime + 5000) {
				this.actionCounters.delete(key);
			}
		}
	}

	getStats() {
		return {
			config: this.config,
			activeSessions: this.actionCounters.size,
			totalActions: Array.from(this.actionCounters.values()).reduce((sum, c) => sum + c.count, 0),
		};
	}
}

export const actionHandler = new ActionHandler();
