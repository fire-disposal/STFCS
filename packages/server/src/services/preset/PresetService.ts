/**
 * PresetService - 预设数据查询服务
 *
 * 提供预设舰船和武器的查询接口
 */

import type { InventoryToken, WeaponJSON } from "@vt/data";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";

export class PresetService {
	constructor(private persistence: PersistenceManager) {}

	async getShipPresets(): Promise<InventoryToken[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds.map((b) => b.data);
	}

	async getWeaponPresets(): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findPresets();
		return builds.map((b) => b.data);
	}

	async getShipPresetById(id: string): Promise<InventoryToken | null> {
		const build = await this.persistence.ships.findById(id);
		if (!build || !build.isPreset) return null;
		return build.data;
	}

	async getWeaponPresetById(id: string): Promise<WeaponJSON | null> {
		const build = await this.persistence.weapons.findById(id);
		if (!build || !build.isPreset) return null;
		return build.data;
	}

	async getShipPresetsByClass(shipClass: string): Promise<InventoryToken[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds
			.filter((b) => b.data.spec.class === shipClass)
			.map((b) => b.data);
	}

	async getShipPresetsBySize(size: string): Promise<InventoryToken[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds
			.filter((b) => b.data.spec.size === size)
			.map((b) => b.data);
	}

	async getWeaponPresetsBySize(size: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findPresets();
		return builds
			.filter((b) => b && b.data.spec.size === size)
			.map((b) => b.data);
	}

	async getWeaponPresetsByDamageType(damageType: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findByDamageType(damageType);
		return builds.filter((b) => b && b.isPreset).map((b) => b.data);
	}
}