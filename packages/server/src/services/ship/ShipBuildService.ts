/**
 * ShipBuildService - 用户舰船构建服务
 *
 * 提供用户自定义舰船的 CRUD、验证和实例化功能
 * 使用 InventoryToken（无runtime）存储用户配置
 */

import {
	InventoryTokenSchema,
	type InventoryToken,
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
	): Promise<ShipBuild> {
		const validated = InventoryTokenSchema.parse(shipJson) as InventoryToken;

		const buildId = validated.$id.startsWith("preset:")
			? generateId("ship")
			: validated.$id;

		const build: ShipBuild = {
			id: buildId,
			data: validated,
			ownerId,
			isPreset: false,
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
		} = {}
	): Promise<ShipBuild> {
		const preset = await this.presetService.getShipPresetById(presetId);
		if (!preset) {
			throw new Error(`Preset ship not found: ${presetId}`);
		}

		const shipJson: InventoryToken = {
			$id: generateId("ship"),
			$presetRef: preset.$id,
			spec: preset.spec,
			metadata: {
				...preset.metadata,
				name: options.name ?? preset.metadata.name,
				createdAt: Date.now(),
			},
		};

		return await this.createShipBuild(ownerId, shipJson);
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

		if (updates.data) {
			updates.data = InventoryTokenSchema.parse(updates.data) as InventoryToken;
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
}