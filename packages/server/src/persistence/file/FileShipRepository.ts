import type { ShipBuild } from "@vt/data";
import { FileBaseRepository } from "./FileBaseRepository.js";

export class FileShipRepository extends FileBaseRepository<ShipBuild> {
	constructor() {
		super("ships");
	}

	protected getFileName(entity: ShipBuild): string {
		return `${this.extractPlayerId(entity)}.json`;
	}

	protected extractPlayerId(entity: ShipBuild): string {
		return entity.ownerId;
	}

	async findByOwner(ownerId: string): Promise<ShipBuild[]> {
		return this.findBy({ ownerId });
	}

	async findPresets(): Promise<ShipBuild[]> {
		return this.findBy({ isPreset: true });
	}

	async findCustomByOwner(ownerId: string): Promise<ShipBuild[]> {
		const ships = await this.findByOwner(ownerId);
		return ships.filter((s) => !s.isPreset);
	}

	async incrementUsage(id: string): Promise<ShipBuild | null> {
		const ship = await this.findById(id);
		if (!ship) return null;
		return this.update(id, { usageCount: (ship.usageCount ?? 0) + 1 });
	}
}