/**
 * ShipBuildService - 用户舰船构建服务
 *
 * 提供用户自定义舰船的 CRUD、验证和实例化功能
 */

import {
	ShipJSONSchema,
	type ShipJSON,
	type Point,
	type Faction,
} from "@vt/data";
import type { PersistenceManager } from "../../persistence/PersistenceManager.js";
import type { ShipBuild } from "../../persistence/index.js";
import { PresetService } from "../preset/PresetService.js";

let idCounter = 0;

function generateId(prefix: string): string {
	idCounter++;
	return `${prefix}:${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class ShipBuildService {
	private presetService: PresetService;

	constructor(private persistence: PersistenceManager) {
		this.presetService = new PresetService(persistence);
	}

	async createShipBuild(
		ownerId: string,
		shipJson: unknown,
		customizations: ShipBuild["customizations"] = {}
	): Promise<ShipBuild> {
		const validated = ShipJSONSchema.parse(shipJson) as ShipJSON;

		const buildId = validated.$id.startsWith("preset:")
			? generateId("ship")
			: validated.$id;

		const build: ShipBuild = {
			id: buildId,
			shipJson: validated,
			ownerId,
			customizations,
			isPreset: false,
			isPublic: false,
			tags: validated.metadata.tags ?? [],
			usageCount: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		return await this.persistence.ships.create(build);
	}

	async createFromPreset(
		ownerId: string,
		presetId: string,
		options: {
			name?: string;
			position?: Point;
			heading?: number;
			faction?: Faction;
		} = {}
	): Promise<ShipBuild> {
		const preset = await this.presetService.getShipPresetById(presetId);
		if (!preset) {
			throw new Error(`Preset ship not found: ${presetId}`);
		}

		const shipJson = JSON.parse(JSON.stringify(preset)) as ShipJSON;
		shipJson.$id = generateId("ship");
		shipJson.$presetRef = preset.$id;
		shipJson.metadata = {
			...preset.metadata,
			name: options.name ?? preset.metadata.name,
		 createdAt: Date.now(),
		};

		if (options.position || options.heading || options.faction) {
			shipJson.runtime = this.buildRuntime(shipJson.ship, options);
		}

		return await this.createShipBuild(ownerId, shipJson);
	}

	private buildRuntime(
		spec: ShipJSON["ship"],
		options: { position?: Point; heading?: number; faction?: Faction }
	): ShipJSON["runtime"] {
		const armorMax = spec.armorMaxPerQuadrant;

		return {
			position: options.position ?? { x: 0, y: 0 },
			heading: options.heading ?? 0,
			hull: spec.maxHitPoints,
			armor: [armorMax, armorMax, armorMax, armorMax, armorMax, armorMax],
			fluxSoft: 0,
			fluxHard: 0,
			shield: spec.shield ? { active: false, value: 0 } : undefined,
			overloaded: false,
			overloadTime: 0,
			destroyed: false,
			movement: {
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
			},
			hasFired: false,
			faction: options.faction ?? "PLAYER",
			ownerId: "",
		};
	}

	async getShipBuild(id: string): Promise<ShipBuild | null> {
		return await this.persistence.ships.findById(id);
	}

	async getShipBuildsByOwner(ownerId: string): Promise<ShipBuild[]> {
		return await this.persistence.ships.findCustomByOwner(ownerId);
	}

	async updateShipBuild(
		id: string,
		updates: Partial<ShipBuild>
	): Promise<ShipBuild | null> {
		const existing = await this.persistence.ships.findById(id);
		if (!existing || existing.isPreset) {
			throw new Error(`Cannot update preset or non-existent ship: ${id}`);
		}

		if (updates.shipJson) {
			updates.shipJson = ShipJSONSchema.parse(updates.shipJson) as ShipJSON;
		}

		return await this.persistence.ships.update(id, updates);
	}

	async deleteShipBuild(id: string): Promise<boolean> {
		const existing = await this.persistence.ships.findById(id);
		if (!existing || existing.isPreset) {
			return false;
		}
		return await this.persistence.ships.delete(id);
	}

	async incrementUsage(id: string): Promise<void> {
		await this.persistence.ships.incrementUsage(id);
	}

	async getAllShipBuilds(): Promise<ShipBuild[]> {
		const result = await this.persistence.ships.findAll();
		return result.items;
	}

	async getPublicShipBuilds(): Promise<ShipBuild[]> {
		return await this.persistence.ships.findPublic();
	}
}