import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { WeaponBuild } from "@vt/data";

export class MemoryWeaponRepository extends MemoryBaseRepository<WeaponBuild> {
	async findByOwner(ownerId: string): Promise<WeaponBuild[]> {
		return this.findBy({ ownerId });
	}

	async findPresets(): Promise<WeaponBuild[]> {
		return this.findBy({ isPreset: true });
	}

	async findCustomByOwner(ownerId: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w && w.ownerId === ownerId && !w.isPreset
		);
	}

	async findByDamageType(damageType: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w && w.data.spec.damageType === damageType
		);
	}

	async findBySize(size: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w && w.data.spec.size === size
		);
	}

	async incrementUsage(id: string): Promise<WeaponBuild | null> {
		const weapon = await this.findById(id);
		if (!weapon) return null;
		return this.update(id, { usageCount: (weapon.usageCount ?? 0) + 1 });
	}
}