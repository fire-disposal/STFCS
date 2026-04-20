/**
 * DataRegistry - 后端数据注册器核心
 *
 * 统一管理所有舰船和武器 JSON 数据
 * 所有数据写入均通过 Zod Schema 验证，确保运行时类型安全
 * 从 @vt/data 导入权威类型定义
 */

import {
    ShipJSONSchema,
    WeaponJSONSchema,
    ShipRuntimeSchema,
    GameSaveSchema,
    ExportJSONSchema,
    type ShipJSON,
    type WeaponJSON,
    type ShipSpec,
    type ShipRuntime,
    type MountSpec,
    type Point,
    type Faction,
    type GameSave,
    type ExportJSON,
} from "@vt/data";

let idCounter = 0;

function generateId(prefix: string): string {
    idCounter++;
    return `${prefix}:${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

interface DataRegistryConfig {
    autoLoadPresets: boolean;
    presetsPath?: string;
}

export class DataRegistry {
    private ships = new Map<string, ShipJSON>();
    private weapons = new Map<string, WeaponJSON>();
    private saves = new Map<string, GameSave>();
    private initialized = false;

    constructor(config: DataRegistryConfig = { autoLoadPresets: true }) {
        if (config.autoLoadPresets) this.initialize();
    }

    initialize(): void {
        if (this.initialized) return;
        this.initialized = true;
        console.log("[DataRegistry] Initialized");
    }

    getShipJSON(id: string): ShipJSON | undefined {
        this.ensureInitialized();
        return this.ships.get(id);
    }

    getWeaponJSON(id: string): WeaponJSON | undefined {
        this.ensureInitialized();
        return this.weapons.get(id);
    }

    /** 注册舰船（自动 Zod 验证） */
    registerShip(raw: unknown): ShipJSON {
        this.ensureInitialized();

        const ship = ShipJSONSchema.parse(raw);

        if (!ship.$id.startsWith("ship:")) {
            throw new Error(`Invalid ship ID format: ${ship.$id}`);
        }

        this.ships.set(ship.$id, ship);

        // 级联注册挂载点武器
        if (ship.ship.mounts) {
            for (const mount of ship.ship.mounts) {
                if (typeof mount.weapon === "object") {
                    this.registerWeapon(mount.weapon);
                }
            }
        }

        console.log(`[DataRegistry] Registered ship: ${ship.$id}`);
        return ship;
    }

    /** 注册武器（自动 Zod 验证） */
    registerWeapon(raw: unknown): WeaponJSON {
        this.ensureInitialized();

        const weapon = WeaponJSONSchema.parse(raw);

        if (!weapon.$id.startsWith("weapon:") && !weapon.$id.startsWith("preset:")) {
            throw new Error(`Invalid weapon ID format: ${weapon.$id}`);
        }

        this.weapons.set(weapon.$id, weapon);
        console.log(`[DataRegistry] Registered weapon: ${weapon.$id}`);
        return weapon;
    }

    createShipInstance(
        presetId: string,
        options: {
            position?: Point;
            heading?: number;
            faction?: Faction;
            ownerId?: string;
            name?: string;
        } = {}
    ): ShipJSON {
        this.ensureInitialized();

        const resolvedId = presetId.startsWith("preset:") ? presetId : `preset:${presetId}`;
        const preset = this.getShipJSON(resolvedId);
        if (!preset) throw new Error(`Preset ship not found: ${presetId}`);

        // 深拷贝并重新生成 ID
        const raw = JSON.parse(JSON.stringify(preset));
        raw.$id = generateId("ship");
        raw.$presetRef = preset.$id;
        raw.metadata = {
            ...preset.metadata,
            name: options.name ?? preset.metadata.name,
            createdAt: Date.now(),
        };
        raw.runtime = this.buildRuntime(raw.ship, options);

        return this.registerShip(raw);
    }

    private buildRuntime(
        spec: ShipSpec,
        options: { position?: Point; heading?: number; faction?: Faction; ownerId?: string }
    ): ShipRuntime {
        const armorMax = spec.armorMaxPerQuadrant;

        return ShipRuntimeSchema.parse({
            position: options.position ?? { x: 0, y: 0 },
            heading: options.heading ?? 0,
            hull: spec.maxHitPoints,
            armor: [armorMax, armorMax, armorMax, armorMax, armorMax, armorMax],
            fluxSoft: 0,
            fluxHard: 0,
            shield: spec.shield ? { active: false, value: 0 } : undefined,
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
            weapons: this.buildWeaponRuntimes(spec.mounts ?? []),
            faction: options.faction ?? "PLAYER",
            ownerId: options.ownerId ?? "",
        });
    }

    private buildWeaponRuntimes(mounts: MountSpec[]): ShipRuntime["weapons"] {
        return mounts.map((mount) => {
            const weaponSpec =
                typeof mount.weapon === "string"
                    ? this.getWeaponJSON(mount.weapon)?.weapon
                    : mount.weapon?.weapon;

            return {
                mountId: mount.id,
                state: "READY" as const,
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
        return this.getAllShips().filter((s) => s.$id.startsWith("preset:"));
    }

    getCustomShips(): ShipJSON[] {
        return this.getAllShips().filter((s) => !s.$id.startsWith("preset:"));
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
        if (!ship) return undefined;
        if (ship.$id.startsWith("preset:")) throw new Error(`Cannot modify preset ship: ${id}`);

        const raw = {
            ...ship,
            ...updates,
            metadata: {
                ...ship.metadata,
                ...updates.metadata,
                updatedAt: Date.now(),
            },
        };

        return this.registerShip(raw);
    }

    exportShip(id: string): ExportJSON {
        this.ensureInitialized();

        const ship = this.getShipJSON(id);
        if (!ship) throw new Error(`Ship not found: ${id}`);

        const raw = JSON.parse(JSON.stringify(ship));
        raw.runtime = undefined;
        raw.$id = `export:${id.split(":")[1]}`;

        return ExportJSONSchema.parse({
            $schema: "export-v1",
            $type: "SHIP",
            $exportedAt: new Date().toISOString(),
            ship: raw,
        });
    }

    importShip(raw: unknown, ownerId: string): ShipJSON {
        this.ensureInitialized();

        const exportJson = ExportJSONSchema.parse(raw);
        if (exportJson.$type !== "SHIP" || !exportJson.ship) {
            throw new Error("Invalid export format: expected SHIP type");
        }

        const shipRaw = JSON.parse(JSON.stringify(exportJson.ship));
        shipRaw.$id = generateId("ship");

        // 级联注册挂载点武器
        if (shipRaw.ship?.mounts) {
            for (const mount of shipRaw.ship.mounts) {
                if (typeof mount.weapon === "object") {
                    mount.weapon.$id = generateId("weapon");
                    this.registerWeapon(mount.weapon);
                }
            }
        }

        if (!shipRaw.runtime) {
            shipRaw.runtime = this.buildRuntime(shipRaw.ship, { ownerId, faction: "PLAYER" });
        } else {
            shipRaw.runtime.ownerId = ownerId;
        }

        return this.registerShip(shipRaw);
    }

    serializeSave(
        ships: ShipJSON[],
        meta: {
            name: string;
            description?: string;
            roomId?: string;
            room?: GameSave["room"];
        }
    ): GameSave {
        return GameSaveSchema.parse({
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
            createdAt: Date.now(),
        });
    }

    deserializeSave(raw: unknown): ShipJSON[] {
        const save = GameSaveSchema.parse(raw);
        for (const ship of save.ships) {
            this.registerShip(ship);
        }
        this.saves.set(save.$id, save);
        return save.ships;
    }

    getSave(id: string): GameSave | undefined {
        return this.saves.get(id);
    }

    private ensureInitialized(): void {
        if (!this.initialized) this.initialize();
    }

    clear(): void {
        for (const [id, ship] of this.ships) {
            if (!id.startsWith("preset:")) this.ships.delete(id);
        }
        for (const [id, weapon] of this.weapons) {
            if (!id.startsWith("preset:")) this.weapons.delete(id);
        }
        this.saves.clear();
        console.log("[DataRegistry] Cleared custom data");
    }

    getStats() {
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