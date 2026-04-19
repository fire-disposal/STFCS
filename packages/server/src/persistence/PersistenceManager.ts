/**
 * 持久化管理器
 *
 * 统一管理所有 Repository，提供便捷的访问方式
 */

import {
	MemoryUserRepository,
	MemoryShipRepository,
	MemoryRoomSaveRepository,
} from "./memory/index.js";

/**
 * 持久化管理器
 */
export class PersistenceManager {
	/** 用户档案 Repository */
	users: MemoryUserRepository;
	/** 舰船自定义 Repository */
	ships: MemoryShipRepository;
	/** 房间存档 Repository */
	roomSaves: MemoryRoomSaveRepository;

	constructor(
		users: MemoryUserRepository,
		ships: MemoryShipRepository,
		roomSaves: MemoryRoomSaveRepository
	) {
		this.users = users;
		this.ships = ships;
		this.roomSaves = roomSaves;
	}

	/** 创建默认的内存存储管理器 */
	static createMemory(): PersistenceManager {
		return new PersistenceManager(
			new MemoryUserRepository(),
			new MemoryShipRepository(),
			new MemoryRoomSaveRepository()
		);
	}

	/** 清空所有数据（谨慎使用） */
	async clearAll(): Promise<void> {
		this.users.clear();
		this.ships.clear();
		this.roomSaves.clear();
	}
}
