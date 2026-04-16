/**
 * 玩家档案服务
 *
 * 职责：
 * - 管理玩家自定义舰船变体
 * - 存储玩家设置和偏好
 * - 提供变体的 CRUD 接口
 *
 * 存储：当前使用内存存储，未来可扩展为文件存储或数据库
 */

import { GAME_SAVE_VERSION, PROFILE_VERSION, MAX_VARIANTS_PER_PLAYER } from "../schema/constants.js";
import { getShipHullSpec, getWeaponSpec, isWeaponSizeCompatible } from "@vt/data";
import type {
	PlayerProfile,
	CustomVariant,
	VariantConfig,
	PlayerSettings,
} from "../schema/types.js";

/** 默认玩家设置 */
const DEFAULT_SETTINGS: PlayerSettings = {
	showWeaponArcs: true,
	showGrid: true,
	coordinatePrecision: "exact",
	angleMode: "degrees",
	theme: "dark",
};

/**
 * 内存档案存储
 */
class MemoryProfileStore {
	private profiles = new Map<string, PlayerProfile>();

	async get(profileId: string): Promise<PlayerProfile | undefined> {
		return this.profiles.get(profileId);
	}

	async save(profile: PlayerProfile): Promise<void> {
		this.profiles.set(profile.id, profile);
	}

	async delete(profileId: string): Promise<void> {
		this.profiles.delete(profileId);
	}

	async exists(profileId: string): Promise<boolean> {
		return this.profiles.has(profileId);
	}
}

/**
 * 玩家档案服务
 */
export class ProfileService {
	private store = new MemoryProfileStore();

	/**
	 * 获取或创建玩家档案
	 *
	 * 如果档案不存在，创建新档案
	 */
	async getOrCreateProfile(sessionId: string, displayName?: string): Promise<PlayerProfile> {
		let profile = await this.store.get(sessionId);

		if (!profile) {
			profile = {
				id: sessionId,
				displayName: displayName || `Player_${sessionId.slice(0, 6)}`,
				customVariants: [],
				favoriteVariants: [],
				settings: DEFAULT_SETTINGS,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			await this.store.save(profile);
		}

		return profile;
	}

	/**
	 * 更新玩家显示名称
	 */
	async updateDisplayName(sessionId: string, displayName: string): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		profile.displayName = displayName;
		profile.updatedAt = Date.now();
		await this.store.save(profile);
	}

	/**
	 * 更新玩家设置
	 */
	async updateSettings(sessionId: string, settings: Partial<PlayerSettings>): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		profile.settings = { ...profile.settings, ...settings };
		profile.updatedAt = Date.now();
		await this.store.save(profile);
	}

	/**
	 * 保存自定义舰船变体
	 *
	 * 验证：
	 * - 舰船规格存在
	 * - 武器配置有效
	 * - OP 点数计算
	 * - 变体数量限制
	 */
	async saveVariant(
		sessionId: string,
		variantId: string,
		hullId: string,
		name: string,
		weaponLoadout: VariantConfig[],
		description?: string
	): Promise<CustomVariant> {
		const profile = await this.getOrCreateProfile(sessionId);

		// 检查变体数量限制
		if (profile.customVariants.length >= MAX_VARIANTS_PER_PLAYER) {
			throw new Error(`变体数量已达上限 (${MAX_VARIANTS_PER_PLAYER})`);
		}

		// 验证舰船规格
		const hullSpec = getShipHullSpec(hullId);
		if (!hullSpec) {
			throw new Error(`舰船规格 ${hullId} 不存在`);
		}

		// 验证并计算 OP
		let opUsed = 0;
		for (const config of weaponLoadout) {
			const mount = hullSpec.weaponMounts.find(m => m.id === config.mountId);
			if (!mount) {
				throw new Error(`挂载点 ${config.mountId} 不存在`);
			}

			if (!config.weaponSpecId) continue;  // 空槽位

			const weaponSpec = getWeaponSpec(config.weaponSpecId);
			if (!weaponSpec) {
				throw new Error(`武器规格 ${config.weaponSpecId} 不存在`);
			}

			// 尺寸验证
			if (!isWeaponSizeCompatible(mount.size, weaponSpec.size)) {
				throw new Error(
					`挂载点 ${config.mountId}: 武器 ${weaponSpec.name} 尺寸不兼容`
				);
			}

			// 类型限制验证
			if (mount.restrictedTypes && !mount.restrictedTypes.includes(weaponSpec.category)) {
				throw new Error(
					`挂载点 ${config.mountId}: 武器类型不符合限制`
				);
			}

			opUsed += weaponSpec.opCost;
		}

		// 检查是否已存在同名变体
		const existingIndex = profile.customVariants.findIndex(v => v.id === variantId);

		const variant: CustomVariant = {
			id: variantId,
			hullId,
			name,
			description,
			weaponLoadout,
			opUsed,
			createdAt: existingIndex >= 0
				? profile.customVariants[existingIndex].createdAt
				: Date.now(),
			updatedAt: Date.now(),
			isPublic: false,
		};

		// 更新或添加变体
		if (existingIndex >= 0) {
			profile.customVariants[existingIndex] = variant;
		} else {
			profile.customVariants.push(variant);
		}

		profile.updatedAt = Date.now();
		await this.store.save(profile);

		return variant;
	}

	/**
	 * 加载自定义变体
	 */
	async loadVariant(sessionId: string, variantId: string): Promise<CustomVariant | undefined> {
		const profile = await this.getOrCreateProfile(sessionId);
		return profile.customVariants.find(v => v.id === variantId);
	}

	/**
	 * 删除自定义变体
	 */
	async deleteVariant(sessionId: string, variantId: string): Promise<boolean> {
		const profile = await this.getOrCreateProfile(sessionId);
		const index = profile.customVariants.findIndex(v => v.id === variantId);

		if (index < 0) return false;

		profile.customVariants.splice(index, 1);
		profile.updatedAt = Date.now();
		await this.store.save(profile);

		return true;
	}

	/**
	 * 获取玩家的所有变体
	 */
	async listVariants(sessionId: string): Promise<CustomVariant[]> {
		const profile = await this.getOrCreateProfile(sessionId);
		return profile.customVariants;
	}

	/**
	 * 收藏变体
	 */
	async addFavorite(sessionId: string, variantId: string): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		if (!profile.favoriteVariants.includes(variantId)) {
			profile.favoriteVariants.push(variantId);
			profile.updatedAt = Date.now();
			await this.store.save(profile);
		}
	}

	/**
	 * 取消收藏
	 */
	async removeFavorite(sessionId: string, variantId: string): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		const index = profile.favoriteVariants.indexOf(variantId);
		if (index >= 0) {
			profile.favoriteVariants.splice(index, 1);
			profile.updatedAt = Date.now();
			await this.store.save(profile);
		}
	}

	/**
	 * 导出玩家档案（用于备份）
	 */
	async exportProfile(sessionId: string): Promise<PlayerProfile | undefined> {
		return this.store.get(sessionId);
	}

	/**
	 * 导入玩家档案（用于恢复）
	 */
	async importProfile(profile: PlayerProfile): Promise<void> {
		// 验证基本结构
		if (!profile.id || !profile.displayName) {
			throw new Error("无效的档案数据");
		}

		// 限制变体数量
		if (profile.customVariants.length > MAX_VARIANTS_PER_PLAYER) {
			profile.customVariants = profile.customVariants.slice(0, MAX_VARIANTS_PER_PLAYER);
		}

		profile.updatedAt = Date.now();
		await this.store.save(profile);
	}
}

export const profileService = new ProfileService();