/**
 * 持久化管理器
 *
 * 统一管理所有 Repository
 * 支持内存存储和 MongoDB 切换
 */

import type { Repository, QueryableRepository } from "./interfaces.js";
import type { UserProfile, ShipBuild, RoomArchive } from "./types.js";
import type { WeaponBuild } from "@vt/data";
import {
	MemoryUserRepository,
	MemoryShipRepository,
	MemoryWeaponRepository,
	MemoryRoomSaveRepository,
} from "./memory/index.js";

export type PersistenceType = "memory" | "mongo";

interface Repositories {
	users: Repository<UserProfile> & QueryableRepository<UserProfile>;
	ships: Repository<ShipBuild> & QueryableRepository<ShipBuild> & {
		findByOwner(ownerId: string): Promise<ShipBuild[]>;
		findPresets(): Promise<ShipBuild[]>;
		findCustomByOwner(ownerId: string): Promise<ShipBuild[]>;
		incrementUsage(id: string): Promise<ShipBuild | null>;
		clear(): void;
	};
	weapons: Repository<WeaponBuild> & QueryableRepository<WeaponBuild> & {
		findByOwner(ownerId: string): Promise<WeaponBuild[]>;
		findPresets(): Promise<WeaponBuild[]>;
		findCustomByOwner(ownerId: string): Promise<WeaponBuild[]>;
		findByDamageType(damageType: string): Promise<WeaponBuild[]>;
		findBySize(size: string): Promise<WeaponBuild[]>;
		incrementUsage(id: string): Promise<WeaponBuild | null>;
		clear(): void;
	};
	roomSaves: Repository<RoomArchive> & QueryableRepository<RoomArchive>;
}

export class PersistenceManager implements Repositories {
	users: Repositories["users"];
	ships: Repositories["ships"];
	weapons: Repositories["weapons"];
	roomSaves: Repositories["roomSaves"];

	private type: PersistenceType;

	constructor(repos: Repositories, type: PersistenceType = "memory") {
		this.users = repos.users;
		this.ships = repos.ships;
		this.weapons = repos.weapons;
		this.roomSaves = repos.roomSaves;
		this.type = type;
	}

	getType(): PersistenceType {
		return this.type;
	}

	/** 创建内存存储（默认） */
	static createMemory(): PersistenceManager {
		return new PersistenceManager(
			{
				users: new MemoryUserRepository(),
				ships: new MemoryShipRepository(),
				weapons: new MemoryWeaponRepository(),
				roomSaves: new MemoryRoomSaveRepository(),
			},
			"memory"
		);
	}

	/** 根据环境变量自动选择 */
	static create(): PersistenceManager {
		const type = (process.env["PERSISTENCE_TYPE"] ?? "memory") as PersistenceType;
		
		if (type === "mongo") {
			throw new Error("MongoDB persistence requires explicit connection. Use connectMongo() first.");
		}
		
		return PersistenceManager.createMemory();
	}

	/** 清空所有数据 */
	async clearAll(): Promise<void> {
		if (this.type === "memory") {
			(this.ships as MemoryShipRepository).clear();
			(this.weapons as MemoryWeaponRepository).clear();
		}
	}
}

/** 全局默认实例（内存存储） */
export const persistence = PersistenceManager.createMemory();