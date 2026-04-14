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

import { ArraySchema } from "@colyseus/schema";
import { ChatMessageType } from "@vt/types";
import { ChatMessage } from "../schema/GameSchema.js";

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
}

/**
 * 房间事件辅助类
 *
 * 提供便捷的事件记录方法
 */
export class RoomEventLogger {
	constructor(
		private state: {
			chatMessages: ArraySchema<ChatMessage>;
		}
	) {}

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
			type: ChatMessageType.CHAT,
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
			type: ChatMessageType.SYSTEM,
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
			type: ChatMessageType.COMBAT,
		});

		this.state.chatMessages.push(message);
		MessageUtils.limitArraySize(this.state.chatMessages, 50);
	}

}
