/**
 * 内存存储 - 武器 Repository
 */

import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { WeaponJSON } from "@vt/data";

export interface WeaponBuild {
	id: string;
	weaponJson: WeaponJSON;
	ownerId: string;
	isPreset: boolean;
	isPublic: boolean;
	tags: string[];
	usageCount: number;
	createdAt: number;
	updatedAt: number;
}

export class MemoryWeaponRepository extends MemoryBaseRepository<WeaponBuild> {
	async findByOwner(ownerId: string): Promise<WeaponBuild[]> {
		return this.findBy({ ownerId });
	}

	async findPresets(): Promise<WeaponBuild[]> {
		return this.findBy({ isPreset: true });
	}

	async findCustomByOwner(ownerId: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w.ownerId === ownerId && !w.isPreset
		);
	}

	async findByDamageType(damageType: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w.weaponJson.weapon.damageType === damageType
		);
	}

	async findBySize(size: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w.weaponJson.weapon.size === size
		);
	}

	async incrementUsage(id: string): Promise<WeaponBuild | null> {
		const weapon = await this.findById(id);
		if (!weapon) return null;
		return this.update(id, { usageCount: weapon.usageCount + 1 });
	}
}