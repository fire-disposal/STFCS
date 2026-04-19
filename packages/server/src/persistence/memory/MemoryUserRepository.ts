/**
 * 内存存储 - 用户档案 Repository
 */

import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { UserProfile } from "../types.js";

/**
 * 用户档案 Repository（内存实现）
 */
export class MemoryUserRepository extends MemoryBaseRepository<UserProfile> {
	/**
	 * 根据名称查找用户
	 */
	async findByName(name: string): Promise<UserProfile | null> {
		for (const user of this.storage.values()) {
			if (user.name === name) return user;
		}
		return null;
	}

	/**
	 * 查找在线用户
	 */
	async findOnline(): Promise<UserProfile[]> {
		return Array.from(this.storage.values()).filter((u) => u.connected);
	}

	/**
	 * 更新用户统计
	 */
	async updateStats(
		id: string,
		updates: Partial<UserProfile["stats"]>
	): Promise<UserProfile | null> {
		const user = await this.findById(id);
		if (!user) return null;

		return this.update(id, {
			stats: { ...user.stats, ...updates },
		});
	}

	/**
	 * 更新用户偏好设置
	 */
	async updatePreferences(
		id: string,
		updates: Partial<UserProfile["preferences"]>
	): Promise<UserProfile | null> {
		const user = await this.findById(id);
		if (!user) return null;

		return this.update(id, {
			preferences: { ...user.preferences, ...updates },
		});
	}

	/**
	 * 添加舰船自定义到用户
	 */
	async addShipBuild(userId: string, shipBuildId: string): Promise<UserProfile | null> {
		const user = await this.findById(userId);
		if (!user) return null;

		const shipBuildIds = [...user.shipBuildIds, shipBuildId];
		return this.update(userId, { shipBuildIds });
	}

	/**
	 * 移除舰船自定义
	 */
	async removeShipBuild(userId: string, shipBuildId: string): Promise<UserProfile | null> {
		const user = await this.findById(userId);
		if (!user) return null;

		const shipBuildIds = user.shipBuildIds.filter((id) => id !== shipBuildId);
		return this.update(userId, { shipBuildIds });
	}
}
