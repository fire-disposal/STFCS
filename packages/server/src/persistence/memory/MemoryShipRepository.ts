/**
 * 内存存储 - 舰船自定义 Repository
 */

import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { ShipBuild } from "../types.js";

/**
 * 舰船自定义 Repository（内存实现）
 */
export class MemoryShipRepository extends MemoryBaseRepository<ShipBuild> {
	/**
	 * 根据所有者查找舰船
	 */
	async findByOwner(ownerId: string): Promise<ShipBuild[]> {
		return this.findBy({ ownerId });
	}

	/**
	 * 查找预设舰船
	 */
	async findPresets(): Promise<ShipBuild[]> {
		return this.findBy({ isPreset: true });
	}

	/**
	 * 查找用户自定义舰船
	 */
	async findCustomByOwner(ownerId: string): Promise<ShipBuild[]> {
		return Array.from(this.storage.values()).filter(
			(s) => s.ownerId === ownerId && !s.isPreset
		);
	}

	/**
	 * 查找公开分享的舰船
	 */
	async findPublic(): Promise<ShipBuild[]> {
		return this.findBy({ isPublic: true });
	}

	/**
	 * 按标签查找
	 */
	async findByTag(tag: string): Promise<ShipBuild[]> {
		return Array.from(this.storage.values()).filter((s) =>
			s.tags.includes(tag)
		);
	}

	/**
	 * 增加使用次数
	 */
	async incrementUsage(id: string): Promise<ShipBuild | null> {
		const ship = await this.findById(id);
		if (!ship) return null;

		return this.update(id, { usageCount: ship.usageCount + 1 });
	}
}
