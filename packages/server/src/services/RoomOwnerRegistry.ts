/**
 * 房主注册服务
 *
 * 全局管理玩家作为房主的房间，确保每个玩家只能拥有一个房间。
 * 使用单例模式，所有 BattleRoom 共享同一个实例。
 */

/**
 * 房主注册记录
 */
interface OwnerRecord {
	roomId: string;
	shortId: number;
	createdAt: number;
}

/**
 * 房主注册服务（单例）
 */
export class RoomOwnerRegistry {
	private static instance: RoomOwnerRegistry | null = null;

	/** shortId -> OwnerRecord 映射 */
	private owners = new Map<number, OwnerRecord>();

	/** roomId -> shortId 反向映射（用于房间销毁时清理） */
	private rooms = new Map<string, number>();

	private constructor() {}

	/** 获取单例实例 */
	static getInstance(): RoomOwnerRegistry {
		if (!RoomOwnerRegistry.instance) {
			RoomOwnerRegistry.instance = new RoomOwnerRegistry();
		}
		return RoomOwnerRegistry.instance;
	}

	/**
	 * 注册房主
	 *
	 * @param roomId 房间 ID
	 * @param shortId 房主的 shortId
	 * @returns 是否成功注册（false 表示该玩家已有房间）
	 */
	register(roomId: string, shortId: number): boolean {
		const existing = this.owners.get(shortId);
		if (existing) {
			// 检查旧房间是否还存在
			// 如果旧房间已销毁，允许注册新房间
			return false;
		}

		this.owners.set(shortId, {
			roomId,
			shortId,
			createdAt: Date.now(),
		});
		this.rooms.set(roomId, shortId);

		console.log(`[RoomOwnerRegistry] Registered: shortId=${shortId}, roomId=${roomId}`);
		return true;
	}

	/**
	 * 检查玩家是否已拥有房间
	 *
	 * @param shortId 玩家的 shortId
	 * @returns 现有房间 ID，或 null
	 */
	getOwnedRoom(shortId: number): string | null {
		const record = this.owners.get(shortId);
		return record?.roomId ?? null;
	}

	/**
	 * 房主转移时更新注册
	 *
	 * @param roomId 房间 ID
	 * @param newShortId 新房主的 shortId
	 * @param oldShortId 原房主的 shortId
	 */
	transferOwnership(roomId: string, newShortId: number, oldShortId: number): void {
		// 移除原房主记录
		this.owners.delete(oldShortId);

		// 注册新房主
		this.owners.set(newShortId, {
			roomId,
			shortId: newShortId,
			createdAt: Date.now(),
		});
		this.rooms.set(roomId, newShortId);

		console.log(`[RoomOwnerRegistry] Transferred: roomId=${roomId}, from=${oldShortId}, to=${newShortId}`);
	}

	/**
	 * 房间销毁时清理注册
	 *
	 * @param roomId 房间 ID
	 */
	unregisterByRoom(roomId: string): void {
		const shortId = this.rooms.get(roomId);
		if (shortId) {
			this.owners.delete(shortId);
			this.rooms.delete(roomId);
			console.log(`[RoomOwnerRegistry] Unregistered: roomId=${roomId}, shortId=${shortId}`);
		}
	}

	/**
	 * 房主离开房间时清理（房间仍有其他玩家）
	 *
	 * @param shortId 房主的 shortId
	 */
	unregisterByOwner(shortId: number): void {
		const record = this.owners.get(shortId);
		if (record) {
			this.rooms.delete(record.roomId);
			this.owners.delete(shortId);
			console.log(`[RoomOwnerRegistry] Owner left: shortId=${shortId}, roomId=${record.roomId}`);
		}
	}

	/**
	 * 获取所有注册信息（用于调试）
	 */
	getAll(): Map<number, OwnerRecord> {
		return new Map(this.owners);
	}

	/**
	 * 清理所有注册（用于测试）
	 */
	clear(): void {
		this.owners.clear();
		this.rooms.clear();
	}
}

// 导出单例
export const roomOwnerRegistry = RoomOwnerRegistry.getInstance();