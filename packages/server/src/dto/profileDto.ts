import type { CustomVariant, PlayerProfile, ProfileSummary } from "../schema/types.js";

/**
 * 玩家档案 DTO 转换器
 */

export const toCustomVariantDto = (variant: CustomVariant): CustomVariant => ({
	id: variant.id,
	hullId: variant.hullId,
	name: variant.name,
	description: variant.description,
	weaponLoadout: variant.weaponLoadout,
	opUsed: variant.opUsed,
	createdAt: variant.createdAt,
	updatedAt: variant.updatedAt,
	isPublic: variant.isPublic,
});

export const toPlayerProfileDto = (profile: PlayerProfile): PlayerProfile => ({
	id: profile.id,
	displayName: profile.displayName,
	avatar: profile.avatar,
	customVariants: profile.customVariants.map(toCustomVariantDto),
	favoriteVariants: profile.favoriteVariants,
	settings: profile.settings,
	createdAt: profile.createdAt,
	updatedAt: profile.updatedAt,
});

export const toProfileSummaryDto = (profile: PlayerProfile): ProfileSummary => ({
	id: profile.id,
	displayName: profile.displayName,
	variantCount: profile.customVariants.length,
	createdAt: profile.createdAt,
});
