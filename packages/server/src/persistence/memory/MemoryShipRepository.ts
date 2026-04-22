import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { ShipBuild } from "@vt/data";

export class MemoryShipRepository extends MemoryBaseRepository<ShipBuild> {
	async findByOwner(ownerId: string): Promise<ShipBuild[]> {
		return this.findBy({ ownerId });
	}

	async findPresets(): Promise<ShipBuild[]> {
		return this.findBy({ isPreset: true });
	}

	async findCustomByOwner(ownerId: string): Promise<ShipBuild[]> {
		return Array.from(this.storage.values()).filter(
			(s) => s && s.ownerId === ownerId && !s.isPreset
		);
	}

	async findByTag(tag: string): Promise<ShipBuild[]> {
		return Array.from(this.storage.values()).filter((s) =>
			s && s.tags.includes(tag)
		);
	}

	async incrementUsage(id: string): Promise<ShipBuild | null> {
		const ship = await this.findById(id);
		if (!ship) return null;

		return this.update(id, { usageCount: (ship.usageCount ?? 0) + 1 });
	}
}
