import type { Repository, QueryableRepository } from "./interfaces.js";
import type { UserProfile, ShipBuild, RoomArchive } from "./types.js";
import type { WeaponBuild } from "@vt/data";
import {
	FileUserRepository,
	FileShipRepository,
	FileWeaponRepository,
	FileRoomSaveRepository,
} from "./file/index.js";

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

	constructor(repos: Repositories) {
		this.users = repos.users;
		this.ships = repos.ships;
		this.weapons = repos.weapons;
		this.roomSaves = repos.roomSaves;
	}

	static async createFile(): Promise<PersistenceManager> {
		const users = new FileUserRepository();
		const ships = new FileShipRepository();
		const weapons = new FileWeaponRepository();
		const roomSaves = new FileRoomSaveRepository();

		await Promise.all([
			users.init(),
			ships.init(),
			weapons.init(),
			roomSaves.init(),
		]);

		return new PersistenceManager({ users, ships, weapons, roomSaves });
	}

	static create(): PersistenceManager {
		return new PersistenceManager({
			users: new FileUserRepository(),
			ships: new FileShipRepository(),
			weapons: new FileWeaponRepository(),
			roomSaves: new FileRoomSaveRepository(),
		});
	}

	async clearAll(): Promise<void> {
		(this.ships as FileShipRepository).clear();
		(this.weapons as FileWeaponRepository).clear();
	}
}

export const persistence = PersistenceManager.create();