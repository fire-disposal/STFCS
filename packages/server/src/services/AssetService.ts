/**
 * 资产服务 - 文件系统存储（简化版：全部公开）
 *
 * 存储结构：
 * data/assets/
 * ├── ships/
 * │   ├── index.json
 * │   └── {assetId}.png       # 仅PNG格式
 * └── weapons/
 *     ├── index.json
 *     └── {assetId}.png       # 仅PNG格式
 */

import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { createLogger } from "../infra/simple-logger.js";
import { DEFAULT_ASSET_CONFIG } from "@vt/data";
import type { Asset, AssetListItem, AssetType, AssetLimitsConfig } from "@vt/data";

const logger = createLogger("asset-service");

// 资产类型到子文件夹的映射
const ASSET_TYPE_DIR: Record<AssetType, string> = {
	ship_texture: "ships",
	weapon_texture: "weapons",
};

// 资产基础目录
const ASSETS_BASE_DIR = join(process.cwd(), "storage", "assets");

// 扩展名映射
const MIME_TO_EXT: Record<string, string> = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/gif": ".gif",
	"image/webp": ".webp",
};

interface AssetIndex {
	assets: Record<string, AssetListItem>;
	lastUpdated: number;
}

interface ImageDimensions {
	width: number;
	height: number;
}

function generateAssetId(type: AssetType): string {
	const uuid = crypto.randomUUID();
	return `${type}:${uuid}`;
}

function getAssetDir(type: AssetType): string {
	const subdir = ASSET_TYPE_DIR[type];
	if (!subdir) {
		throw new Error(`Unknown asset type: ${type}`);
	}
	return join(ASSETS_BASE_DIR, subdir);
}

function getExtension(mimeType: string): string {
	return MIME_TO_EXT[mimeType] ?? ".dat";
}

function getLimits(type: AssetType): AssetLimitsConfig {
	return DEFAULT_ASSET_CONFIG[type];
}

/**
 * 解析PNG图像尺寸（简单解析，不依赖外部库）
 */
function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
	// PNG文件头: 8字节签名 + 4字节长度 + 4字节类型(IHDR) + 数据
	// IHDR块包含宽度(4字节)和高度(4字节)
	if (buffer.length < 24) return null;

	// PNG签名: 89 50 4E 47 0D 0A 1A 0A
	const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	for (let i = 0; i < 8; i++) {
		if (buffer[i] !== signature[i]) return null;
	}

	// IHDR块在签名后，偏移8字节
	// 格式: 长度(4) + "IHDR"(4) + 宽度(4) + 高度(4) + ...
	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);

	return { width, height };
}

/**
 * 解析JPEG图像尺寸（简单解析）
 */
function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
	if (buffer.length < 10) return null;

	// JPEG签名: FF D8
	if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

	let offset = 2;
	while (offset < buffer.length - 8) {
		// 查找 SOF0 (FF C0) 或 SOF2 (FF C2) 标记
		if (buffer[offset] === 0xff) {
			const marker = buffer[offset + 1];
			if (marker === undefined) break;

			if (marker === 0xc0 || marker === 0xc2) {
				// SOF标记后: 长度(2) + 精度(1) + 高度(2) + 宽度(2)
				const height = buffer.readUInt16BE(offset + 5);
				const width = buffer.readUInt16BE(offset + 7);
				return { width, height };
			}
			// 跳过其他标记
			if (marker >= 0xd0 && marker <= 0xd9) {
				offset += 2;
			} else if (marker === 0x01) {
				offset += 4;
			} else {
				offset += 2 + buffer.readUInt16BE(offset + 2);
			}
		} else {
			offset++;
		}
	}

	return null;
}

/**
 * 解析图像尺寸
 */
function parseImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
	switch (mimeType) {
		case "image/png":
			return parsePngDimensions(buffer);
		case "image/jpeg":
			return parseJpegDimensions(buffer);
		default:
			return null;
	}
}

export class AssetService {
	private initialized = false;

	/**
	 * 初始化资产目录结构
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			if (!existsSync(ASSETS_BASE_DIR)) {
				await mkdir(ASSETS_BASE_DIR, { recursive: true });
				logger.info("Created assets base directory", { path: ASSETS_BASE_DIR });
			}

			for (const subdir of Object.values(ASSET_TYPE_DIR)) {
				const dir = join(ASSETS_BASE_DIR, subdir);
				if (!existsSync(dir)) {
					await mkdir(dir, { recursive: true });
				}

				const indexPath = join(dir, "index.json");
				if (!existsSync(indexPath)) {
					await writeFile(indexPath, JSON.stringify({ assets: {}, lastUpdated: Date.now() }, null, 2));
				}
			}

			this.initialized = true;
			logger.info("AssetService initialized");
		} catch (error) {
			logger.error("Failed to initialize AssetService", error);
			throw error;
		}
	}

	/**
	 * 验证资产上传
	 */
	validateAsset(
		type: AssetType,
		mimeType: string,
		data: Buffer
	): { valid: boolean; error?: string; dimensions?: ImageDimensions } {
		const limits = getLimits(type);

		// 1. 验证 MIME 类型
		if (!limits.allowedMimeTypes.includes(mimeType)) {
			const allowedStr = limits.allowedMimeTypes.join(", ");
			return { valid: false, error: `Invalid MIME type for ${type}. Allowed: ${allowedStr}` };
		}

		// 2. 验证文件大小
		if (data.length > limits.maxFileSize) {
			const maxKB = limits.maxFileSize / 1024;
			return { valid: false, error: `File too large. Max size: ${maxKB}KB` };
		}

		// 3. 解析并验证图像尺寸
		const dimensions = parseImageDimensions(data, mimeType);
		if (!dimensions) {
			return { valid: false, error: "Unable to parse image dimensions" };
		}

		if (dimensions.width < limits.minWidth || dimensions.height < limits.minHeight) {
			return { valid: false, error: `Image too small. Min: ${limits.minWidth}x${limits.minHeight}` };
		}

		if (dimensions.width > limits.maxWidth || dimensions.height > limits.maxHeight) {
			return { valid: false, error: `Image too large. Max: ${limits.maxWidth}x${limits.maxHeight}` };
		}

		return { valid: true, dimensions };
	}

	/**
	 * 上传资产
	 */
	async uploadAsset(
		userId: string,
		type: AssetType,
		filename: string,
		mimeType: string,
		data: Buffer,
		metadata?: { name?: string; description?: string; tags?: string[] }
	): Promise<Asset> {
		await this.initialize();

		// 验证
		const validation = this.validateAsset(type, mimeType, data);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		const assetId = generateAssetId(type);
		const dir = getAssetDir(type);
		const ext = getExtension(mimeType);
		const now = Date.now();

		const ownerId = userId.startsWith("player:") ? userId : `player:${userId}`;

		const asset: Asset = {
			$id: assetId,
			type,
			filename,
			mimeType,
			size: data.length,
			metadata: {
				name: metadata?.name ?? filename,
				description: metadata?.description,
				tags: metadata?.tags,
				width: validation.dimensions?.width,
				height: validation.dimensions?.height,
			},
			ownerId,
			uploadedAt: now,
		};

		// 保存元数据
		await writeFile(join(dir, `${assetId}.json`), JSON.stringify(asset, null, 2));

		// 保存数据文件
		await writeFile(join(dir, `${assetId}${ext}`), data);

		// 更新索引
		await this.updateIndex(type, assetId, this.toListItem(asset));

		logger.info("Asset uploaded", {
			assetId,
			type,
			size: data.length,
			dimensions: validation.dimensions,
			ownerId,
		});

		return asset;
	}

	/**
	 * 上传舰船贴图（仅PNG）
	 */
	async uploadShipTexture(
		userId: string,
		data: Buffer,
		filename: string,
		mimeType: string,
		metadata?: { name?: string; description?: string }
	): Promise<string> {
		const asset = await this.uploadAsset(userId, "ship_texture", filename, mimeType, data, metadata);
		return asset.$id;
	}

	/**
	 * 上传武器贴图（仅PNG）
	 */
	async uploadWeaponTexture(
		userId: string,
		data: Buffer,
		filename: string,
		mimeType: string,
		metadata?: { name?: string; description?: string }
	): Promise<string> {
		const asset = await this.uploadAsset(userId, "weapon_texture", filename, mimeType, data, metadata);
		return asset.$id;
	}

	/**
	 * 获取资产元数据
	 */
	async getAsset(assetId: string): Promise<Asset | null> {
		await this.initialize();

		const type = this.parseType(assetId);
		if (!type) return null;

		const metaPath = join(getAssetDir(type), `${assetId}.json`);
		if (!existsSync(metaPath)) return null;

		try {
			const content = await readFile(metaPath, "utf-8");
			return JSON.parse(content) as Asset;
		} catch {
			return null;
		}
	}

	/**
	 * 获取资产二进制数据
	 */
	async getAssetData(assetId: string): Promise<Buffer | null> {
		await this.initialize();

		const asset = await this.getAsset(assetId);
		if (!asset) return null;

		const type = this.parseType(assetId);
		if (!type) return null;

		const dir = getAssetDir(type);
		const ext = getExtension(asset.mimeType);
		const dataPath = join(dir, `${assetId}${ext}`);

		if (existsSync(dataPath)) {
			return readFile(dataPath);
		}

		// 尝试 .dat
		const datPath = join(dir, `${assetId}.dat`);
		if (existsSync(datPath)) {
			return readFile(datPath);
		}

		return null;
	}

	/**
	 * 获取资产信息（列表项）
	 */
	async getAssetInfo(assetId: string): Promise<AssetListItem | null> {
		const asset = await this.getAsset(assetId);
		return asset ? this.toListItem(asset) : null;
	}

	/**
	 * 列出资产（全部公开）
	 */
	async listAssets(type?: AssetType, ownerId?: string): Promise<AssetListItem[]> {
		await this.initialize();

		const results: AssetListItem[] = [];
		const typesToList = type ? [type] : Object.keys(ASSET_TYPE_DIR) as AssetType[];

		for (const t of typesToList) {
			const indexPath = join(getAssetDir(t), "index.json");
			if (!existsSync(indexPath)) continue;

			try {
				const content = await readFile(indexPath, "utf-8");
				const index: AssetIndex = JSON.parse(content);

				for (const item of Object.values(index.assets)) {
					if (!ownerId || item.ownerId === ownerId) {
						results.push(item);
					}
				}
			} catch {
				logger.error("Failed to read asset index", { type: t });
			}
		}

		return results.sort((a, b) => b.uploadedAt - a.uploadedAt);
	}

	/**
	 * 批量获取资产（包含可选数据）
	 */
	async batchGetAssets(
		assetIds: string[],
		includeData?: boolean
	): Promise<{ assetId: string; info: AssetListItem | null; data?: string }[]> {
		await this.initialize();

		const results: { assetId: string; info: AssetListItem | null; data?: string }[] = [];

		for (const assetId of assetIds) {
			const info = await this.getAssetInfo(assetId);
			if (!info) {
				results.push({ assetId, info: null });
				continue;
			}

			const item: { assetId: string; info: AssetListItem; data?: string } = {
				assetId,
				info,
			};

			if (includeData) {
				const data = await this.getAssetData(assetId);
				if (data) {
					item.data = data.toString("base64");
				}
			}

			results.push(item);
		}

		return results;
	}

	/**
	 * 删除资产
	 */
	async deleteAsset(assetId: string): Promise<boolean> {
		await this.initialize();

		const asset = await this.getAsset(assetId);
		if (!asset) return false;

		const type = this.parseType(assetId);
		if (!type) return false;

		const dir = getAssetDir(type);

		// 删除元数据
		const metaPath = join(dir, `${assetId}.json`);
		if (existsSync(metaPath)) await unlink(metaPath);

		// 删除数据文件
		const ext = getExtension(asset.mimeType);
		const dataPath = join(dir, `${assetId}${ext}`);
		if (existsSync(dataPath)) await unlink(dataPath);

		const datPath = join(dir, `${assetId}.dat`);
		if (existsSync(datPath)) await unlink(datPath);

		// 从索引移除
		await this.removeFromIndex(type, assetId);

		logger.info("Asset deleted", { assetId, type });

		return true;
	}

	/**
	 * 获取资产配置限制
	 */
	getAssetLimits(type: AssetType): AssetLimitsConfig {
		return getLimits(type);
	}

	/**
	 * 获取统计
	 */
	async getStats(): Promise<{ total: number; byType: Record<string, number>; totalSize: number }> {
		await this.initialize();

		const byType: Record<string, number> = {};
		let total = 0;
		let totalSize = 0;

		for (const [type, subdir] of Object.entries(ASSET_TYPE_DIR)) {
			const indexPath = join(ASSETS_BASE_DIR, subdir, "index.json");
			if (!existsSync(indexPath)) continue;

			try {
				const content = await readFile(indexPath, "utf-8");
				const index: AssetIndex = JSON.parse(content);
				const count = Object.keys(index.assets).length;
				byType[type] = count;
				total += count;

				for (const item of Object.values(index.assets)) {
					totalSize += item.size;
				}
			} catch {
				// ignore
			}
		}

		return { total, byType, totalSize };
	}

	// ==================== 私有方法 ====================

	private async updateIndex(type: AssetType, assetId: string, item: AssetListItem): Promise<void> {
		const indexPath = join(getAssetDir(type), "index.json");

		try {
			let index: AssetIndex = { assets: {}, lastUpdated: Date.now() };
			if (existsSync(indexPath)) {
				index = JSON.parse(await readFile(indexPath, "utf-8"));
			}

			index.assets[assetId] = item;
			index.lastUpdated = Date.now();

			await writeFile(indexPath, JSON.stringify(index, null, 2));
		} catch (error) {
			logger.error("Failed to update index", error, { type, assetId });
		}
	}

	private async removeFromIndex(type: AssetType, assetId: string): Promise<void> {
		const indexPath = join(getAssetDir(type), "index.json");
		if (!existsSync(indexPath)) return;

		try {
			const index: AssetIndex = JSON.parse(await readFile(indexPath, "utf-8"));
			delete index.assets[assetId];
			index.lastUpdated = Date.now();
			await writeFile(indexPath, JSON.stringify(index, null, 2));
		} catch (error) {
			logger.error("Failed to remove from index", error, { type, assetId });
		}
	}

	private parseType(assetId: string): AssetType | null {
		const match = assetId.match(/^([^:]+):/);
		if (match && match[1]) {
			const type = match[1] as AssetType;
			return ASSET_TYPE_DIR[type] ? type : null;
		}
		return null;
	}

	private toListItem(asset: Asset): AssetListItem {
		return {
			$id: asset.$id,
			type: asset.type,
			filename: asset.filename,
			mimeType: asset.mimeType,
			size: asset.size,
			metadata: asset.metadata,
			ownerId: asset.ownerId,
			uploadedAt: asset.uploadedAt,
			updatedAt: asset.updatedAt,
		};
	}
}

export const assetService = new AssetService();