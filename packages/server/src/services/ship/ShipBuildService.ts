import { InventoryTokenSchema, type InventoryToken } from "@vt/data";
import { PlayerInfoService } from "../PlayerInfoService.js";
import { PresetService } from "../preset/PresetService.js";

let idCounter = 0;

function generateId(prefix: string): string {
	idCounter++;
	return `${prefix}:${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class ShipBuildService {
	private presetService: PresetService;

	constructor(private playerInfoService: PlayerInfoService) {
		this.presetService = new PresetService();
	}

	async createShipBuild(ownerId: string, shipJson: unknown): Promise<InventoryToken> {
		const validated = InventoryTokenSchema.parse(shipJson) as InventoryToken;
		const ship: InventoryToken = validated.$id.startsWith("preset:")
			? { ...validated, $id: generateId("ship") }
			: validated;
		return await this.playerInfoService.addShip(ownerId, ship);
	}

	async createFromPreset(ownerId: string, presetId: string, options: { name?: string } = {}): Promise<InventoryToken> {
		const preset = await this.presetService.getShipPresetById(presetId);
		if (!preset) throw new Error(`Preset ship not found: ${presetId}`);
		const ship: InventoryToken = {
			$id: generateId("ship"),
			$presetRef: preset.$id,
			spec: preset.spec,
			metadata: {
				...preset.metadata,
				name: options.name ?? preset.metadata?.name,
			},
		};
		return await this.playerInfoService.addShip(ownerId, ship);
	}

	async getShipBuild(ownerId: string, shipId: string): Promise<InventoryToken | null> {
		const ships = await this.playerInfoService.getShips(ownerId);
		return ships.find((s) => s.$id === shipId) ?? null;
	}

	async getShipBuildsByOwner(ownerId: string): Promise<InventoryToken[]> {
		return await this.playerInfoService.getShips(ownerId);
	}

	async updateShipBuild(ownerId: string, shipId: string, updates: Partial<InventoryToken>): Promise<InventoryToken | null> {
		return await this.playerInfoService.updateShip(ownerId, shipId, updates);
	}

	async deleteShipBuild(ownerId: string, shipId: string): Promise<boolean> {
		return await this.playerInfoService.deleteShip(ownerId, shipId);
	}
}