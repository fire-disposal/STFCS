/**
 * Colyseus 消息处理辅助工具
 */

/**
 * 消息辅助工具
 */
export class MessageUtils {
	/**
	 * 生成唯一 ID
	 */
	static generateId(prefix = "id"): string {
		return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}
}

/**
 * 房间事件辅助类（简化版，无聊天功能）
 */
export class RoomEventLogger {
	constructor() {}

	/**
	 * 记录系统日志
	 */
	log(message: string): void {
		console.log(`[Room] ${message}`);
	}
}