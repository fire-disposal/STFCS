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
import { getShipHullSpec, getWeaponSpec, isWeaponSizeCompatible, isWeaponCategoryCompatible } from "@vt/data";
import { persistence } from "./PersistenceManager.js";
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
 * 玩家档案服务（基于 SQLite 持久化）
 */
export class ProfileService {
	/**
	 * 获取或创建玩家档案
	 */
	async getOrCreateProfile(sessionId: string, displayName?: string): Promise<PlayerProfile> {
		const profile = await persistence.profiles.get(sessionId);

		if (!profile) {
			const newProfile: PlayerProfile = {
				id: sessionId,
				displayName: displayName || `Player_${sessionId.slice(0, 6)}`,
				customVariants: [],
				favoriteVariants: [],
				settings: DEFAULT_SETTINGS,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			await this.saveProfile(newProfile);
			return newProfile;
		}

		// 加载变体
		const variants = await persistence.variants.getByOwner(sessionId);
		profile.customVariants = variants;

		return profile;
	}

	/**
	 * 保存玩家档案
	 */
	async saveProfile(profile: PlayerProfile): Promise<void> {
		await persistence.profiles.save(profile);
	}

	/**
	 * 保存变体
	 */
	async saveVariant(sessionId: string, variant: CustomVariant): Promise<void> {
		await persistence.variants.save(sessionId, variant);
	}

	/**
	 * 删除变体
	 */
	async deleteVariant(sessionId: string, variantId: string): Promise<void> {
		await persistence.variants.delete(sessionId, variantId);
	}

	/**
	 * 更新玩家显示名称
	 */
	async updateDisplayName(sessionId: string, displayName: string): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		profile.displayName = displayName;
		profile.updatedAt = Date.now();
		await this.saveProfile(profile);
	}

	/**
	 * 更新玩家设置
	 */
	async updateSettings(sessionId: string, settings: Partial<PlayerSettings>): Promise<void> {
		const profile = await this.getOrCreateProfile(sessionId);
		profile.settings = { ...profile.settings, ...settings };
		profile.updatedAt = Date.now();
		await this.saveProfile(profile);
	}

	/**
	 * 保存自定义舰船变体 (带规则验证逻辑)
	 *
	 * 验证：
	 * - 舰船规格存在
	 * - 武器配置有效
	 * - OP 点数计算
	 * - 变体数量限制
	 */
	async createOrUpdateVariant(
		sessionId: string,
		variantId: string,
		hullId: string,
		name: string,
		weaponLoadout: VariantConfig[],
		description?: string
	): Promise<CustomVariant> {
		const profile = await this.getOrCreateProfile(sessionId);

		// 检查变体数量限制 (如果是新增)
		const isNew = !profile.customVariants.some(v => v.id === variantId);
		if (isNew && profile.customVariants.length >= MAX_VARIANTS_PER_PLAYER) {
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
			if (!isWeaponCategoryCompatible(mount.slotCategory, weaponSpec.category)) {
				throw new Error(
					`挂载点 ${config.mountId}: 武器类别 ${weaponSpec.category} 不兼容挂载点 ${mount.slotCategory}`
				);
			}

			opUsed += weaponSpec.opCost;
		}

		const existingVariant = profile.customVariants.find(v => v.id === variantId);

		const variant: CustomVariant = {
			id: variantId,
			hullId,
			name,
			description,
			weaponLoadout,
			opUsed,
			createdAt: existingVariant ? existingVariant.createdAt : Date.now(),
			updatedAt: Date.now(),
			isPublic: existingVariant ? existingVariant.isPublic : false,
		};

		// 调用底层持久化
		await this.saveVariant(sessionId, variant);

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
	 * 删除自定义变体 (带状态检查)
	 */
	async removeVariant(sessionId: string, variantId: string): Promise<boolean> {
		const profile = await this.getOrCreateProfile(sessionId);
		const exists = profile.customVariants.some(v => v.id === variantId);

		if (!exists) return false;

		await this.deleteVariant(sessionId, variantId);
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
			await this.saveProfile(profile);
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
			await this.saveProfile(profile);
		}
	}

	/**
	 * 导出玩家档案（用于备份）
	 */
	async exportProfile(sessionId: string): Promise<PlayerProfile | undefined> {
		return this.getOrCreateProfile(sessionId);
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
		await this.saveProfile(profile);

		// 同时导入变体
		for (const variant of profile.customVariants) {
			await this.saveVariant(profile.id, variant);
		}
	}

	/**
	 * 更新玩家基础档案信息（全局功能，与房间无关）
	 *
	 * @param playerId 玩家标识（当前使用 displayName/nickname）
	 * @param updates 更新内容（nickname, avatar）
	 * @returns 更新后的档案摘要
	 */
	async updateBasicProfile(
		playerId: string,
		updates: { nickname?: string; avatar?: string }
	): Promise<{ success: boolean; nickname: string; avatar: string }> {
		// 验证 avatar 格式（必须是 Base64 或空）
		if (updates.avatar !== undefined && updates.avatar !== "") {
			if (!updates.avatar.startsWith("data:image/")) {
				throw new Error("头像必须是 Base64 图片数据");
			}
			if (updates.avatar.length > 250000) {
				throw new Error("头像图片数据过大");
			}
		}

		// 验证 nickname 长度
		const nickname = updates.nickname?.trim().slice(0, 24);

		// 获取或创建档案
		const profile = await this.getOrCreateProfile(playerId, nickname || playerId);

		// 应用更新
		if (nickname) {
			profile.displayName = nickname;
		}
		if (updates.avatar !== undefined) {
			profile.avatar = updates.avatar;
		}
		profile.updatedAt = Date.now();

		// 持久化
		await this.saveProfile(profile);

		console.log(`[ProfileService] Updated basic profile for ${playerId}`, {
			nickname: profile.displayName,
			avatarSet: !!profile.avatar,
			avatarLength: profile.avatar?.length || 0
		});

		return {
			success: true,
			nickname: profile.displayName,
			avatar: profile.avatar || "",
		};
	}

	/**
	 * 获取玩家基础档案信息
	 *
	 * @param playerId 玩家标识
	 * @returns 基础档案（nickname, avatar）
	 */
	async getBasicProfile(playerId: string): Promise<{ nickname: string; avatar: string }> {
		const profile = await persistence.profiles.get(playerId);

		if (!profile) {
			return { nickname: playerId, avatar: "" };
		}

		return {
			nickname: profile.displayName,
			avatar: profile.avatar || "",
		};
	}
}

export const profileService = new ProfileService();