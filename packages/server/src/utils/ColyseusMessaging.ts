/**
 * Colyseus 消息处理优化
 *
 * 使用 Schema 状态同步替代手动 broadcast/send
 *
 * 优化原则：
 * 1. 优先使用 Schema 状态自动同步
 * 2. 只在必要时使用 onMessage/broadcast
 * 3. 事件消息（聊天、系统通知）使用 ArraySchema
 * 4. 命令操作使用 Schema 状态变化
 */

import { type } from "@colyseus/schema";
import { ArraySchema, Schema } from "@colyseus/schema";

/**
 * 聊天消息 Schema（已添加到 GameRoomState）
 *
 * 使用方式：
 * ```typescript
 * // 服务端添加消息
 * this.state.chatMessages.push(new ChatMessage({
 *   id: `msg_${Date.now()}`,
 *   senderId: client.sessionId,
 *   senderName: playerName,
 *   content: text,
 *   timestamp: Date.now(),
 *   type: 'chat',
 * }));
 *
 * // 客户端监听（自动触发）
 * room.state.chatMessages.onAdd((message, index) => {
 *   console.log(`新消息：${message.senderName}: ${message.content}`);
 * });
 * ```
 */
export class ChatMessage extends Schema {
	@type("string") id: string = "";
	@type("string") senderId: string = "";
	@type("string") senderName: string = "";
	@type("string") content: string = "";
	@type("number") timestamp: number = 0;
	@type("string") type: "chat" | "system" | "combat" = "chat";

	constructor(init?: Partial<ChatMessage>) {
		super();
		if (init) {
			Object.assign(this, init);
		}
	}
}

/**
 * 系统事件 Schema
 *
 * 用于记录游戏事件（舰船创建、摧毁、阶段变化等）
 */
export class GameEvent extends Schema {
	@type("string") id: string = "";
	@type("string") type: string = "";
	@type("string") data: string = ""; // JSON 字符串
	@type("number") timestamp: number = 0;

	constructor(init?: Partial<GameEvent>) {
		super();
		if (init) {
			Object.assign(this, init);
		}
	}
}

/**
 * 命令处理器基类
 *
 * 提供统一的错误处理和日志记录
 */
export abstract class CommandHandler<TPayload> {
	/**
	 * 执行命令
	 */
	abstract execute(payload: TPayload): Promise<void> | void;

	/**
	 * 验证命令
	 */
	validate?(payload: TPayload): void;

	/**
	 * 执行并处理错误
	 */
	async executeWithValidation(payload: TPayload): Promise<boolean> {
		try {
			if (this.validate) {
				this.validate(payload);
			}
			await this.execute(payload);
			return true;
		} catch (error) {
			console.error(`[Command] ${this.constructor.name} failed:`, error);
			throw error;
		}
	}
}

/**
 * 消息辅助工具
 */
export class MessageUtils {
	/**
	 * 生成唯一消息 ID
	 */
	static generateId(prefix = "msg"): string {
		return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 限制数组大小（用于聊天消息等）
	 */
	static limitArraySize<T>(array: ArraySchema<T>, maxSize: number): void {
		while (array.length > maxSize) {
			array.shift();
		}
	}

	/**
	 * 清理过期事件（超过指定时间）
	 */
	static cleanupExpiredEvents<T extends { timestamp: number }>(
		array: ArraySchema<T>,
		maxAgeMs: number
	): void {
		const now = Date.now();
		for (let i = array.length - 1; i >= 0; i--) {
			if (now - array[i].timestamp > maxAgeMs) {
				array.shift();
			}
		}
	}
}

/**
 * 房间事件辅助类
 *
 * 提供便捷的事件记录方法
 */
export class RoomEventLogger {
	constructor(private state: any) {}

	/**
	 * 添加聊天消息
	 */
	addChatMessage(senderId: string, senderName: string, content: string): void {
		const message = new ChatMessage({
			id: MessageUtils.generateId(),
			senderId,
			senderName,
			content: content.trim(),
			timestamp: Date.now(),
			type: "chat",
		});

		this.state.chatMessages.push(message);
		MessageUtils.limitArraySize(this.state.chatMessages, 50);

		console.log(`[Chat] ${senderName}: ${content}`);
	}

	/**
	 * 添加系统消息
	 */
	addSystemMessage(content: string): void {
		const message = new ChatMessage({
			id: MessageUtils.generateId(),
			senderId: "system",
			senderName: "System",
			content,
			timestamp: Date.now(),
			type: "system",
		});

		this.state.chatMessages.push(message);
		MessageUtils.limitArraySize(this.state.chatMessages, 50);

		console.log(`[System] ${content}`);
	}

	/**
	 * 添加战斗消息
	 */
	addCombatMessage(content: string): void {
		const message = new ChatMessage({
			id: MessageUtils.generateId(),
			senderId: "combat",
			senderName: "Combat",
			content,
			timestamp: Date.now(),
			type: "combat",
		});

		this.state.chatMessages.push(message);
		MessageUtils.limitArraySize(this.state.chatMessages, 50);
	}

	/**
	 * 记录游戏事件
	 */
	logEvent(type: string, data: any): void {
		const event = new GameEvent({
			id: MessageUtils.generateId("event"),
			type,
			data: JSON.stringify(data),
			timestamp: Date.now(),
		});

		// 如果 state 有 gameEvents 数组，添加事件
		if (this.state.gameEvents) {
			this.state.gameEvents.push(event);
			MessageUtils.limitArraySize(this.state.gameEvents, 100);
		}

		console.log(`[Event] ${type}:`, data);
	}
}
