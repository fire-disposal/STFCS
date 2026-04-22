import type { WeaponBuild } from "@vt/data";
import { FileBaseRepository } from "./FileBaseRepository.js";

export class FileWeaponRepository extends FileBaseRepository<WeaponBuild> {
	constructor() {
		super("weapons");
	}

	protected getFileName(entity: WeaponBuild): string {
		return `${this.extractPlayerId(entity)}.json`;
	}

	protected extractPlayerId(entity: WeaponBuild): string {
		return entity.ownerId;
	}

	async findByOwner(ownerId: string): Promise<WeaponBuild[]> {
		return this.findBy({ ownerId });
	}

	async findPresets(): Promise<WeaponBuild[]> {
		return this.findBy({ isPreset: true });
	}

	async findCustomByOwner(ownerId: string): Promise<WeaponBuild[]> {
		const weapons = await this.findByOwner(ownerId);
		return weapons.filter((w) => !w.isPreset);
	}

	async findByDamageType(damageType: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w.data.spec.damageType === damageType
		);
	}

	async findBySize(size: string): Promise<WeaponBuild[]> {
		return Array.from(this.storage.values()).filter(
			(w) => w.data.spec.size === size
		);
	}

	async incrementUsage(id: string): Promise<WeaponBuild | null> {
		const weapon = await this.findById(id);
		if (!weapon) return null;
		return this.update(id, { usageCount: (weapon.usageCount ?? 0) + 1 });
	}
}