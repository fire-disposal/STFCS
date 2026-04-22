import type { WeaponJSON } from "@vt/data";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";

export class WeaponService {
	constructor(private persistence: PersistenceManager) {}

	async getWeaponById(id: string): Promise<WeaponJSON | null> {
		const build = await this.persistence.weapons.findById(id);
		return build?.data ?? null;
	}

	async getAllWeapons(): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findAll();
		return builds.items.map((b) => b.data);
	}

	async getWeaponsByOwner(ownerId: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findCustomByOwner(ownerId);
		return builds.map((b) => b.data);
	}

	async getWeaponsBySize(size: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findBySize(size);
		return builds.map((b) => b.data);
	}

	async getWeaponsByDamageType(damageType: string): Promise<WeaponJSON[]> {
		const builds = await this.persistence.weapons.findByDamageType(damageType);
		return builds.map((b) => b.data);
	}

	checkWeaponCompatibility(_weaponId: string, mountSize: string): boolean {
		const sizeHierarchy: Record<string, string[]> = {
			SMALL: ["SMALL"],
			MEDIUM: ["SMALL", "MEDIUM"],
			LARGE: ["SMALL", "MEDIUM", "LARGE"],
		};

		const compatibleSizes = sizeHierarchy[mountSize] ?? [];
		return compatibleSizes.includes(mountSize);
	}

	calculateWeaponStats(weaponJson: WeaponJSON): {
		dps: number;
		fluxPerSecond: number;
		effectiveRange: number;
	} {
		const spec = weaponJson.spec;
		const cooldown = spec.cooldown ?? 1;
		const burstCount = spec.burstCount ?? 1;
		const projectiles = spec.projectilesPerShot ?? 1;

		const dps = (spec.damage * projectiles * burstCount) / cooldown;
		const fluxPerSecond = spec.fluxCostPerShot / cooldown;
		const effectiveRange = spec.range;

		return { dps, fluxPerSecond, effectiveRange };
	}

	async incrementUsage(id: string): Promise<void> {
		await this.persistence.weapons.incrementUsage(id);
	}
}