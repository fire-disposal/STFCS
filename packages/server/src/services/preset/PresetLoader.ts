/**
 * PresetLoader - 预设数据加载器
 *
 * 从 @vt/data/presets 加载预设舰船和武器 JSON
 * 验证后存入 persistence 层（标记 isPreset=true）
 */

import {
	presetShips,
	presetWeapons,
	TokenJSONSchema,
	WeaponJSONSchema,
	type TokenJSON,
	type WeaponJSON,
} from "@vt/data";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";
import type { ShipBuild } from "../../persistence/types.js";

export class PresetLoader {
	constructor(private persistence: PersistenceManager) {}

	async loadAllPresets(): Promise<{ ships: number; weapons: number }> {
		const shipsLoaded = await this.loadShipPresets();
		const weaponsLoaded = await this.loadWeaponPresets();

		console.log(`[PresetLoader] Loaded ${shipsLoaded} ship presets, ${weaponsLoaded} weapon presets`);

		return { ships: shipsLoaded, weapons: weaponsLoaded };
	}

	private async loadShipPresets(): Promise<number> {
		let count = 0;

		for (const rawShip of presetShips) {
			try {
				const shipJson = TokenJSONSchema.parse(rawShip) as TokenJSON;

				const existing = await this.persistence.ships.findById(shipJson.$id);
				if (existing) {
					console.log(`[PresetLoader] Ship preset ${shipJson.$id} already exists, skipping`);
					continue;
				}

				const shipBuild: ShipBuild = {
					id: shipJson.$id,
					shipJson,
					ownerId: "system",
					customizations: {},
					isPreset: true,
					isPublic: true,
					tags: ["preset", shipJson.token.class, shipJson.token.size],
					usageCount: 0,
					createdAt: shipJson.metadata.createdAt ?? Date.now(),
					updatedAt: Date.now(),
				};

				await this.persistence.ships.create(shipBuild);
				count++;

				console.log(`[PresetLoader] Loaded ship preset: ${shipJson.$id} - ${shipJson.metadata.name}`);
			} catch (error) {
				console.error(`[PresetLoader] Failed to load ship preset:`, error);
			}
		}

		return count;
	}

	private async loadWeaponPresets(): Promise<number> {
		let count = 0;

		for (const rawWeapon of presetWeapons) {
			try {
				const weaponJson = WeaponJSONSchema.parse(rawWeapon) as WeaponJSON;

				const weaponBuild = {
					id: weaponJson.$id,
					weaponJson,
					ownerId: "system",
					isPreset: true,
					isPublic: true,
					tags: ["preset", weaponJson.weapon.damageType, weaponJson.weapon.size],
					usageCount: 0,
					createdAt: weaponJson.metadata?.createdAt ?? Date.now(),
					updatedAt: Date.now(),
				};

				await this.persistence.weapons.create(weaponBuild);
				count++;

				console.log(`[PresetLoader] Loaded weapon preset: ${weaponJson.$id} - ${weaponJson.metadata?.name}`);
			} catch (error) {
				console.error(`[PresetLoader] Failed to load weapon preset:`, error);
			}
		}

		return count;
	}
}