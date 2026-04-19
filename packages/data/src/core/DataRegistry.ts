/**
 * DataRegistry - 数据注册器核心
 *
 * 统一管理所有舰船和武器 JSON 数据
 */

import type {
	ShipJSON,
	WeaponJSON,
	ShipSpec,
	ShipRuntime,
	MountSpec,
	Point,
	FactionType,
} from "../core/index.js";


/** ID 生成计数器 */
let idCounter = 0;

/** 生成唯一ID */
function generateId(prefix: string): string {
	idCounter++;
	const timestamp = Date.now().toString(36);
	const counter = idCounter.toString(36);
	return `${prefix}:${timestamp}_${counter}`;
}

/** 存档JSON类型 */
export interface SaveJSON {
	$schema: string;
	$id: string;
	metadata?: {
		name: string;
		description?: string;
		createdAt?: number;
		updatedAt?: number;
		roomId?: string;
	};
	room?: {
		turn: {
			count: number;
			phase: string;
			activeFaction: FactionType;
		};
		map: {
			width: number;
			height: number;
		};
		players: any[];
	};
	ships: ShipJSON[];
}

/** 导出JSON类型 */
export interface ExportJSON {
	$schema: string;
	$type: "SHIP" | "WEAPON" | "FLEET";
	$exportedAt: string;
	ship?: ShipJSON;
	weapon?: WeaponJSON;
	fleet?: {
		name: string;
		description?: string;
		ships: ShipJSON[];
	};
}

/** DataRegistry 配置 */
interface DataRegistryConfig {
	autoLoadPresets: boolean;
	presetsPath?: string;
}

/** 数据注册器 */
export class DataRegistry {
	private ships: Map<string, ShipJSON> = new Map();
	private weapons: Map<string, WeaponJSON> = new Map();
	private saves: Map<string, SaveJSON> = new Map();
	private initialized: boolean = false;

	constructor(config: DataRegistryConfig = { autoLoadPresets: true }) {
		if (config.autoLoadPresets) {
			this.initialize();
		}
	}

	initialize(): void {
		if (this.initialized) {
			return;
		}
		this.initialized = true;
		console.log(`[DataRegistry] Initialized`);
	}

	getShipJSON(id: string): ShipJSON | undefined {
		this.ensureInitialized();
		return this.ships.get(id);
	}

	getWeaponJSON(id: string): WeaponJSON | undefined {
		this.ensureInitialized();
		return this.weapons.get(id);
	}

	registerShip(ship: ShipJSON): void {
		this.ensureInitialized();

		if (!ship.$id || !ship.$id.startsWith("ship:")) {
			throw new Error(`Invalid ship ID format: ${ship.$id}`);
		}

		this.ships.set(ship.$id, ship);

		// 注册挂载点中的武器对象
		if (ship.ship.mounts) {
			for (const mount of ship.ship.mounts) {
				if (typeof mount.weapon === "object") {
					this.registerWeapon(mount.weapon);
				}
			}
		}

		console.log(`[DataRegistry] Registered ship: ${ship.$id}`);
	}

	registerWeapon(weapon: WeaponJSON): void {
		this.ensureInitialized();

		if (!weapon.$id || (!weapon.$id.startsWith("weapon:") && !weapon.$id.startsWith("preset:"))) {
			throw new Error(`Invalid weapon ID format: ${weapon.$id}`);
		}

		this.weapons.set(weapon.$id, weapon);
		console.log(`[DataRegistry] Registered weapon: ${weapon.$id}`);
	}

	createShipInstance(
		presetId: string,
		options: {
			position?: Point;
			heading?: number;
			faction?: FactionType;
			ownerId?: string;
			name?: string;
		} = {}
	): ShipJSON {
		this.ensureInitialized();

		const preset = this.getShipJSON(presetId.startsWith("preset:") ? presetId : `preset:${presetId}`);

		if (!preset) {
			throw new Error(`Preset ship not found: ${presetId}`);
		}

		const instance: ShipJSON = JSON.parse(JSON.stringify(preset));

		instance.$id = generateId("ship");
		instance.$presetRef = preset.$id;
		instance.metadata = {
			...preset.metadata,
			name: options.name ?? preset.metadata.name,
			createdAt: Date.now(),
		};

		instance.runtime = this.createDefaultRuntime(instance.ship, options);
		this.registerShip(instance);

		return instance;
	}

	private createDefaultRuntime(
		spec: ShipSpec,
		options: {
			position?: Point;
			heading?: number;
			faction?: FactionType;
			ownerId?: string;
		}
	): ShipRuntime {
		const armorMax = spec.armorMaxPerQuadrant;

		return {
			position: options.position ?? { x: 0, y: 0 },
			heading: options.heading ?? 0,
			hull: spec.maxHitPoints,
			armor: [armorMax, armorMax, armorMax, armorMax, armorMax, armorMax],
			fluxSoft: 0,
			fluxHard: 0,
			shield: spec.shield
				? { active: false, value: 0 }
				: undefined,
			overloaded: false,
			overloadTime: 0,
			destroyed: false,
			movement: {
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
			},
			hasFired: false,
			weapons: this.createWeaponRuntimeStates(spec.mounts ?? []),
			faction: options.faction ?? "PLAYER",
			ownerId: options.ownerId ?? "",
		};
	}

	private createWeaponRuntimeStates(mounts: MountSpec[]): ShipRuntime["weapons"] {
		return mounts.map((mount) => {
			const weaponSpec = typeof mount.weapon === 'string' 
				? this.getWeaponJSON(mount.weapon)?.weapon
				: mount.weapon?.weapon;
			
			return {
				mountId: mount.id,
				state: "READY",
				cooldownRemaining: 0,
				statusEffects: [],
				weapon: weaponSpec,
			};
		});
	}

	getAllShips(): ShipJSON[] {
		this.ensureInitialized();
		return Array.from(this.ships.values());
	}

	getAllWeapons(): WeaponJSON[] {
		this.ensureInitialized();
		return Array.from(this.weapons.values());
	}

	getPresetShips(): ShipJSON[] {
		return this.getAllShips().filter((ship) => ship.$id.startsWith("preset:"));
	}

	getCustomShips(): ShipJSON[] {
		return this.getAllShips().filter((ship) => !ship.$id.startsWith("preset:"));
	}

	deleteShip(id: string): boolean {
		const ship = this.ships.get(id);
		if (ship && !ship.$id.startsWith("preset:")) {
			this.ships.delete(id);
			console.log(`[DataRegistry] Deleted ship: ${id}`);
			return true;
		}
		return false;
	}

	updateShip(id: string, updates: Partial<ShipJSON>): ShipJSON | undefined {
		const ship = this.ships.get(id);
		if (!ship) {
			return undefined;
		}

		if (ship.$id.startsWith("preset:")) {
			throw new Error(`Cannot modify preset ship: ${id}`);
		}

		const updated: ShipJSON = {
			...ship,
			...updates,
			metadata: {
				...ship.metadata,
				...updates.metadata,
				updatedAt: Date.now(),
			},
		};

		this.ships.set(id, updated);
		return updated;
	}

	exportShip(id: string): ExportJSON {
		this.ensureInitialized();

		const ship = this.getShipJSON(id);
		if (!ship) {
			throw new Error(`Ship not found: ${id}`);
		}

		const exportShip: ShipJSON = JSON.parse(JSON.stringify(ship));
		exportShip.runtime = undefined;
		exportShip.$id = `export:${id.split(":")[1]}`;

		return {
			$schema: "export-v1",
			$type: "SHIP",
			$exportedAt: new Date().toISOString(),
			ship: exportShip,
		};
	}

	importShip(exportJson: ExportJSON, ownerId: string): ShipJSON {
		this.ensureInitialized();

		if (exportJson.$type !== "SHIP" || !exportJson.ship) {
			throw new Error("Invalid export format: expected SHIP type");
		}

		const ship = JSON.parse(JSON.stringify(exportJson.ship));

		ship.$id = generateId("ship");

		// 注册挂载点中的武器对象
		if (ship.ship?.mounts) {
			for (const mount of ship.ship.mounts) {
				if (typeof mount.weapon === "object") {
					mount.weapon.$id = generateId("weapon");
					this.registerWeapon(mount.weapon);
				}
			}
		}

		if (!ship.runtime) {
			ship.runtime = this.createDefaultRuntime(ship.ship, { ownerId, faction: "PLAYER" });
		} else {
			ship.runtime.ownerId = ownerId;
		}

		this.registerShip(ship);
		return ship;
	}

	serializeSave(
		ships: ShipJSON[],
		meta: {
			name: string;
			description?: string;
			roomId?: string;
			room?: SaveJSON["room"];
		}
	): SaveJSON {
		return {
			$schema: "save-v1",
			$id: generateId("save"),
			metadata: {
				name: meta.name,
				description: meta.description,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				roomId: meta.roomId,
			},
			room: meta.room,
			ships,
		};
	}

	deserializeSave(saveJson: SaveJSON): ShipJSON[] {
		for (const ship of saveJson.ships) {
			this.registerShip(ship);
		}
		this.saves.set(saveJson.$id, saveJson);
		return saveJson.ships;
	}

	getSave(id: string): SaveJSON | undefined {
		return this.saves.get(id);
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			this.initialize();
		}
	}

	clear(): void {
		for (const [id, ship] of this.ships) {
			if (!id.startsWith("preset:")) {
				this.ships.delete(id);
			}
		}

		for (const [id, weapon] of this.weapons) {
			if (!id.startsWith("preset:")) {
				this.weapons.delete(id);
			}
		}

		this.saves.clear();
		console.log("[DataRegistry] Cleared custom data");
	}

	getStats(): {
		totalShips: number;
		presetShips: number;
		customShips: number;
		totalWeapons: number;
		presetWeapons: number;
		customWeapons: number;
		saves: number;
	} {
		const allShips = this.getAllShips();
		const allWeapons = this.getAllWeapons();
		return {
			totalShips: this.ships.size,
			presetShips: allShips.filter((s) => s.$id.startsWith("preset:")).length,
			customShips: allShips.filter((s) => !s.$id.startsWith("preset:")).length,
			totalWeapons: this.weapons.size,
			presetWeapons: allWeapons.filter((w) => w.$id.startsWith("preset:")).length,
			customWeapons: allWeapons.filter((w) => !w.$id.startsWith("preset:")).length,
			saves: this.saves.size,
		};
	}
}

export const dataRegistry = new DataRegistry();
export default DataRegistry;
