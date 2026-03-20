/**
 * 资源加载器
 * 
 * 负责加载和管理游戏资源（图片、音频等）
 * 提供统一的资源访问接口
 */

import type { AssetManifest } from '@vt/shared/config';

export interface LoadedAsset {
	id: string;
	type: 'image' | 'audio' | 'data';
	url: string;
	data?: unknown;
	loaded: boolean;
	error?: Error;
}

export interface AssetLoaderOptions {
	/** 资源根URL */
	baseUrl?: string;
	/** 并发加载数 */
	concurrency?: number;
	/** 重试次数 */
	retryCount?: number;
}

/**
 * 资源加载器
 */
export class AssetLoader {
	private _assets: Map<string, LoadedAsset> = new Map();
	private _manifest: AssetManifest | null = null;
	private readonly _baseUrl: string;
	private readonly _concurrency: number;
	private readonly _retryCount: number;
	
	constructor(options: AssetLoaderOptions = {}) {
		this._baseUrl = options.baseUrl || '/assets';
		this._concurrency = options.concurrency || 6;
		this._retryCount = options.retryCount || 3;
	}
	
	// ==================== 清单加载 ====================
	
	/**
	 * 加载资源清单
	 */
	async loadManifest(): Promise<AssetManifest> {
		const url = `${this._baseUrl}/manifest.json`;
		
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load manifest: ${response.status}`);
			}
			
			this._manifest = await response.json() as AssetManifest;
			return this._manifest;
		} catch (e) {
			console.error('[AssetLoader] Failed to load manifest:', e);
			throw e;
		}
	}
	
	// ==================== 资源加载 ====================
	
	/**
	 * 加载单个图片
	 */
	async loadImage(id: string, url: string): Promise<HTMLImageElement> {
		const fullUrl = url.startsWith('http') ? url : `${this._baseUrl}/${url}`;
		
		return new Promise((resolve, reject) => {
			const img = new Image();
			
			img.onload = () => {
				this._assets.set(id, {
					id,
					type: 'image',
					url: fullUrl,
					data: img,
					loaded: true,
				});
				resolve(img);
			};
			
			img.onerror = () => {
				const error = new Error(`Failed to load image: ${fullUrl}`);
				this._assets.set(id, {
					id,
					type: 'image',
					url: fullUrl,
					loaded: false,
					error,
				});
				reject(error);
			};
			
			img.src = fullUrl;
		});
	}
	
	/**
	 * 加载音频
	 */
	async loadAudio(id: string, url: string): Promise<AudioBuffer> {
		const fullUrl = url.startsWith('http') ? url : `${this._baseUrl}/${url}`;
		
		try {
			const response = await fetch(fullUrl);
			if (!response.ok) {
				throw new Error(`Failed to load audio: ${response.status}`);
			}
			
			const arrayBuffer = await response.arrayBuffer();
			const audioContext = new AudioContext();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			
			this._assets.set(id, {
				id,
				type: 'audio',
				url: fullUrl,
				data: audioBuffer,
				loaded: true,
			});
			
			return audioBuffer;
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			this._assets.set(id, {
				id,
				type: 'audio',
				url: fullUrl,
				loaded: false,
				error,
			});
			throw error;
		}
	}
	
	/**
	 * 加载JSON数据
	 */
	async loadJSON<T = unknown>(id: string, url: string): Promise<T> {
		const fullUrl = url.startsWith('http') ? url : `${this._baseUrl}/${url}`;
		
		try {
			const response = await fetch(fullUrl);
			if (!response.ok) {
				throw new Error(`Failed to load JSON: ${response.status}`);
			}
			
			const data = await response.json();
			
			this._assets.set(id, {
				id,
				type: 'data',
				url: fullUrl,
				data,
				loaded: true,
			});
			
			return data;
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			this._assets.set(id, {
				id,
				type: 'data',
				url: fullUrl,
				loaded: false,
				error,
			});
			throw error;
		}
	}
	
	// ==================== 批量加载 ====================
	
	/**
	 * 批量加载资源
	 */
	async loadAssets(
		assets: Array<{ id: string; type: 'image' | 'audio' | 'data'; url: string }>,
		onProgress?: (loaded: number, total: number) => void
	): Promise<Map<string, LoadedAsset>> {
		const total = assets.length;
		let loaded = 0;
		
		// 分批加载
		const batches: Array<Array<{ id: string; type: 'image' | 'audio' | 'data'; url: string }>> = [];
		for (let i = 0; i < assets.length; i += this._concurrency) {
			batches.push(assets.slice(i, i + this._concurrency));
		}
		
		for (const batch of batches) {
			await Promise.allSettled(
				batch.map(async (asset) => {
					try {
						switch (asset.type) {
							case 'image':
								await this.loadImage(asset.id, asset.url);
								break;
							case 'audio':
								await this.loadAudio(asset.id, asset.url);
								break;
							case 'data':
								await this.loadJSON(asset.id, asset.url);
								break;
						}
					} finally {
						loaded++;
						onProgress?.(loaded, total);
					}
				})
			);
		}
		
		return this._assets;
	}
	
	/**
	 * 从清单加载所有资源
	 */
	async loadFromManifest(
		onProgress?: (loaded: number, total: number) => void
	): Promise<void> {
		if (!this._manifest) {
			await this.loadManifest();
		}
		
		if (!this._manifest) {
			throw new Error('No manifest loaded');
		}
		
		const assets: Array<{ id: string; type: 'image' | 'audio' | 'data'; url: string }> = [];
		
		// 收集所有需要加载的资源
		if (this._manifest.sprites) {
			for (const [id, url] of Object.entries(this._manifest.sprites)) {
				assets.push({ id, type: 'image', url });
			}
		}
		
		// 加载配置文件
		for (const shipId of this._manifest.ships) {
			assets.push({ id: `ship_${shipId}`, type: 'data', url: `ships/${shipId}.json` });
		}
		for (const weaponId of this._manifest.weapons) {
			assets.push({ id: `weapon_${weaponId}`, type: 'data', url: `weapons/${weaponId}.json` });
		}
		for (const hullId of this._manifest.hulls) {
			assets.push({ id: `hull_${hullId}`, type: 'data', url: `hulls/${hullId}.json` });
		}
		
		await this.loadAssets(assets, onProgress);
	}
	
	// ==================== 获取方法 ====================
	
	/**
	 * 获取已加载的资源
	 */
	getAsset<T = unknown>(id: string): T | undefined {
		const asset = this._assets.get(id);
		if (asset?.loaded && asset.data) {
			return asset.data as T;
		}
		return undefined;
	}
	
	/**
	 * 获取图片资源
	 */
	getImage(id: string): HTMLImageElement | undefined {
		return this.getAsset<HTMLImageElement>(id);
	}
	
	/**
	 * 获取音频资源
	 */
	getAudio(id: string): AudioBuffer | undefined {
		return this.getAsset<AudioBuffer>(id);
	}
	
	/**
	 * 检查资源是否已加载
	 */
	isLoaded(id: string): boolean {
		const asset = this._assets.get(id);
		return asset?.loaded ?? false;
	}
	
	/**
	 * 获取加载状态
	 */
	getLoadingStatus(): {
		total: number;
		loaded: number;
		failed: number;
	} {
		let loaded = 0;
		let failed = 0;
		
		for (const asset of this._assets.values()) {
			if (asset.loaded) {
				loaded++;
			} else if (asset.error) {
				failed++;
			}
		}
		
		return {
			total: this._assets.size,
			loaded,
			failed,
		};
	}
	
	// ==================== 清理 ====================
	
	/**
	 * 卸载资源
	 */
	unload(id: string): void {
		this._assets.delete(id);
	}
	
	/**
	 * 清除所有资源
	 */
	clear(): void {
		this._assets.clear();
		this._manifest = null;
	}
}

// 单例实例
let _instance: AssetLoader | null = null;

/**
 * 获取资源加载器单例
 */
export function getAssetLoader(options?: AssetLoaderOptions): AssetLoader {
	if (!_instance) {
		_instance = new AssetLoader(options);
	}
	return _instance;
}

/**
 * 重置资源加载器（用于测试）
 */
export function resetAssetLoader(): void {
	_instance = null;
}