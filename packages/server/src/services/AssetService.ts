/**
 * 资产服务 - 统一管理图像素材（头像、贴图等）
 */

import type { Asset, AssetUploadRequest, AssetListItem } from "@vt/data";

let idCounter = 0;

function generateAssetId(type: string): string {
	idCounter++;
	return `asset:${type}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class AssetService {
	private assets = new Map<string, Asset>();

	async uploadAsset(userId: string, request: AssetUploadRequest): Promise<Asset> {
		const assetId = generateAssetId(request.type);
		const now = Date.now();

		const asset: Asset = {
			$schema: "asset-v1",
			$id: assetId,
			type: request.type,
			filename: request.filename,
			mimeType: request.mimeType,
			size: request.buffer.length,
			metadata: request.metadata ?? {},
			ownerId: `player:${userId}`,
			uploadedAt: now,
			updatedAt: now,
			visibility: request.visibility ?? "private",
			sharedWith: request.sharedWith ?? [],
			data: request.buffer,
		};

		this.assets.set(assetId, asset);
		return asset;
	}

	async uploadAvatar(
		userId: string,
		buffer: Buffer,
		filename: string,
		mimeType: string
	): Promise<string> {
		const asset = await this.uploadAsset(userId, {
			type: "avatar",
			filename,
			mimeType,
			buffer,
			metadata: { name: `头像 - ${filename}`, tags: ["avatar", "profile"] },
			visibility: "public",
		});
		return asset.$id;
	}

	async uploadShipTexture(
		userId: string,
		buffer: Buffer,
		filename: string,
		mimeType: string,
		metadata?: { name?: string; description?: string; width?: number; height?: number }
	): Promise<string> {
		const asset = await this.uploadAsset(userId, {
			type: "ship_texture",
			filename,
			mimeType,
			buffer,
			metadata: { name: metadata?.name ?? `舰船贴图 - ${filename}`, ...metadata },
			visibility: "private",
		});
		return asset.$id;
	}

	async getAsset(assetId: string): Promise<Asset | null> {
		return this.assets.get(assetId) ?? null;
	}

	async getAssetData(assetId: string): Promise<Uint8Array | null> {
		const asset = await this.getAsset(assetId);
		return asset?.data ?? null;
	}

	async getAssetInfo(assetId: string): Promise<AssetListItem | null> {
		const asset = await this.getAsset(assetId);
		if (!asset) return null;
		return this.assetToListItem(asset);
	}

	async listUserAssets(userId: string): Promise<AssetListItem[]> {
		const allAssets = Array.from(this.assets.values());
		const userAssets = allAssets.filter(
			(a) =>
				a.ownerId === `player:${userId}` ||
				a.visibility === "public" ||
				(a.visibility === "shared" && a.sharedWith?.includes(`player:${userId}`))
		);
		return userAssets.sort((a, b) => b.uploadedAt - a.uploadedAt).map((a) => this.assetToListItem(a));
	}

	async deleteAsset(assetId: string): Promise<boolean> {
		return this.assets.delete(assetId);
	}

	async getUserAvatar(userId: string): Promise<AssetListItem | null> {
		const userAssets = await this.listUserAssets(userId);
		const avatars = userAssets.filter((a) => a.type === "avatar");
		if (avatars.length === 0) return null;
		return avatars.sort((a, b) => b.uploadedAt - a.uploadedAt)[0] ?? null;
	}

	private assetToListItem(asset: Asset): AssetListItem {
		return {
			$id: asset.$id,
			type: asset.type,
			filename: asset.filename,
			mimeType: asset.mimeType,
			size: asset.size,
			metadata: asset.metadata,
			ownerId: asset.ownerId,
			uploadedAt: asset.uploadedAt,
			updatedAt: asset.updatedAt ?? asset.uploadedAt,
			visibility: asset.visibility,
		};
	}

	clear(): void {
		this.assets.clear();
	}

	getStats(): { total: number; byType: Record<string, number> } {
		const byType: Record<string, number> = {};
		for (const asset of this.assets.values()) {
			byType[asset.type] = (byType[asset.type] ?? 0) + 1;
		}
		return { total: this.assets.size, byType };
	}
}

export const assetService = new AssetService();