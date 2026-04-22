import { presetShips, presetWeapons } from "@vt/data";
import type { InventoryToken, WeaponJSON } from "@vt/data";

export class PresetService {
	async getShipPresets(): Promise<InventoryToken[]> {
		return presetShips as unknown as InventoryToken[];
	}

	async getWeaponPresets(): Promise<WeaponJSON[]> {
		return presetWeapons as unknown as WeaponJSON[];
	}

	async getShipPresetById(id: string): Promise<InventoryToken | null> {
		const found = presetShips.find((p: any) => p.$id === id);
		return found ? (found as unknown as InventoryToken) : null;
	}

	async getWeaponPresetById(id: string): Promise<WeaponJSON | null> {
		const found = presetWeapons.find((p: any) => p.$id === id);
		return found ? (found as unknown as WeaponJSON) : null;
	}

	async getShipPresetsByClass(shipClass: string): Promise<InventoryToken[]> {
		return presetShips.filter((p: any) => p.spec.class === shipClass) as unknown as InventoryToken[];
	}

	async getShipPresetsBySize(size: string): Promise<InventoryToken[]> {
		return presetShips.filter((p: any) => p.spec.size === size) as unknown as InventoryToken[];
	}

	async getWeaponPresetsBySize(size: string): Promise<WeaponJSON[]> {
		return presetWeapons.filter((p: any) => p.spec.size === size) as unknown as WeaponJSON[];
	}

	async getWeaponPresetsByDamageType(damageType: string): Promise<WeaponJSON[]> {
		return presetWeapons.filter((p: any) => p.spec.damageType === damageType) as unknown as WeaponJSON[];
	}
}