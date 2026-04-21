/**
 * PresetService - 预设数据查询服务
 *
 * 提供预设舰船和武器的查询接口
 */

import type { TokenJSON, WeaponJSON } from "@vt/data";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";

export class PresetService {
	constructor(private persistence: PersistenceManager) {}

	async getShipPresets(): Promise<TokenJSON[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds.map((b) => b.shipJson);
	}

	async getWeaponPresets(): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findPresets();
		return builds.map((b) => b.weaponJson);
	}

	async getShipPresetById(id: string): Promise<TokenJSON | null> {
		const build = await this.persistence.ships.findById(id);
		if (!build || !build.isPreset) return null;
		return build.shipJson;
	}

	async getWeaponPresetById(id: string): Promise<WeaponJSON | null> {
		const build = await this.persistence.weapons.findById(id);
		if (!build || !build.isPreset) return null;
		return build.weaponJson;
	}

	async getShipPresetsByClass(shipClass: string): Promise<TokenJSON[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds
			.filter((b) => b.shipJson.token.class === shipClass)
			.map((b) => b.shipJson);
	}

	async getShipPresetsBySize(size: string): Promise<TokenJSON[]> {
		const builds = await this.persistence.ships.findPresets();
		return builds
			.filter((b) => b.shipJson.token.size === size)
			.map((b) => b.shipJson);
	}

	async getWeaponPresetsBySize(size: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findPresets();
		return builds
			.filter((b) => b.weaponJson.weapon.size === size)
			.map((b) => b.weaponJson);
	}

	async getWeaponPresetsByDamageType(damageType: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findByDamageType(damageType);
		return builds.filter((b) => b.isPreset).map((b) => b.weaponJson);
	}
}