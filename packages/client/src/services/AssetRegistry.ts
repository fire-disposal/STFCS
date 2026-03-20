/**
 * 客户端资源注册表
 * 
 * 管理客户端游戏资源（配置、贴图、音频）
 * 提供统一的资源访问接口
 */

import type {
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
	AssetManifest,
} from '@vt/shared/config';
import {
	DEFAULT_WEAPONS,
	DEFAULT_HULLS,
	DEFAULT_SHIPS,
} from '@vt/shared/config';

export interface AssetRegistryOptions {
	/** 资源基础URL */
	baseUrl?: string;
	/** 是否预加载默认配置 */
	preloadDefaults?: boolean;
}

export type AssetLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AssetRegistryState {
	configStatus: AssetLoadStatus;
	spritesStatus: AssetLoadStatus;
	weaponsCount: number;
	hullsCount: number;
	shipsCount: number;
	spritesCount: number;
	error?: string;
}

type AssetRegistryListener = (state: AssetRegistryState) => void;

/**
 * 客户端资源注册表
 */
export class AssetRegistry {
	private _weapons: Map<string, WeaponDefinition> = new Map();
	private _hulls: Map<string, HullDefinition> = new Map();
	private _ships: Map<string, ShipDefinition> = new Map();
	private _sprites: Map<string, HTMLImageElement> = new Map();
	private _manifest: AssetManifest | null = null;
	
	private _state: AssetRegistryState = {
		configStatus: 'idle',
		spritesStatus: 'idle',
		weaponsCount: 0,
		hullsCount: 0,
		shipsCount: 0,
		spritesCount: 0,
	};
	
	private _listeners: Set<AssetRegistryListener> = new Set();
	private readonly _baseUrl: string;
	
	constructor(options: AssetRegistryOptions = {}) {
		this._baseUrl = options.baseUrl || '/assets';
		
		if (options.preloadDefaults !== false) {
			this._loadDefaults();
		}
	}
	
	// ==================== 状态管理 ====================
	
	/**
	 * 获取当前状态
	 */
	getState(): AssetRegistryState {
		return { ...this._state };
	}
	
	/**
	 * 订阅状态变化
	 */
	subscribe(listener: AssetRegistryListener): () => void {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}
	
	private _updateState(partial: Partial<AssetRegistryState>): void {
		this._state = { ...this._state, ...partial };
		this._listeners.forEach(listener => listener(this._state));
	}
	
	// ==================== 默认配置 ====================
	
	/**
	 * 加载默认配置
	 */
	private _loadDefaults(): void {
		for (const [id, weapon] of Object.entries(DEFAULT_WEAPONS)) {
			this._weapons.set(id, weapon);
		}
		for (const [id, hull] of Object.entries(DEFAULT_HULLS)) {
			this._hulls.set(id, hull);
		}
		for (const [id, ship] of Object.entries(DEFAULT_SHIPS)) {
			this._ships.set(id, ship);
		}
		
		this._updateState({
			weaponsCount: this._weapons.size,
			hullsCount: this._hulls.size,
			shipsCount: this._ships.size,
		});
	}
	
	// ==================== 配置加载 ====================
	
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
			
			const manifest = await response.json() as AssetManifest;
			this._manifest = manifest;
			return manifest;
		} catch (e) {
			console.warn('[AssetRegistry] Failed to load manifest, using defaults');
			throw e;
		}
	}
	
	/**
	 * 加载所有配置
	 */
	async loadConfigs(onProgress?: (loaded: number, total: number) => void): Promise<void> {
		this._updateState({ configStatus: 'loading' });
		
		try {
			// 尝试加载清单
			try {
				await this.loadManifest();
			} catch {
				// 使用默认配置
			}
			
			// 加载舰船配置
			if (this._manifest) {
				const total = this._manifest.ships.length + this._manifest.weapons.length + this._manifest.hulls.length;
				let loaded = 0;
				
				for (const shipId of this._manifest.ships) {
					await this._loadShipConfig(shipId);
					loaded++;
					onProgress?.(loaded, total);
				}
				
				for (const weaponId of this._manifest.weapons) {
					await this._loadWeaponConfig(weaponId);
					loaded++;
					onProgress?.(loaded, total);
				}
				
				for (const hullId of this._manifest.hulls) {
					await this._loadHullConfig(hullId);
					loaded++;
					onProgress?.(loaded, total);
				}
			}
			
			this._updateState({
				configStatus: 'loaded',
				weaponsCount: this._weapons.size,
				hullsCount: this._hulls.size,
				shipsCount: this._ships.size,
			});
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			this._updateState({
				configStatus: 'error',
				error,
			});
			throw e;
		}
	}
	
	private async _loadShipConfig(id: string): Promise<void> {
		try {
			const response = await fetch(`${this._baseUrl}/ships/${id}.json`);
			if (response.ok) {
				const config = await response.json();
				this._ships.set(id, config);
			}
		} catch {
			// 使用默认配置
		}
	}
	
	private async _loadWeaponConfig(id: string): Promise<void> {
		try {
			const response = await fetch(`${this._baseUrl}/weapons/${id}.json`);
			if (response.ok) {
				const config = await response.json();
				this._weapons.set(id, config);
			}
		} catch {
			// 使用默认配置
		}
	}
	
	private async _loadHullConfig(id: string): Promise<void> {
		try {
			const response = await fetch(`${this._baseUrl}/hulls/${id}.json`);
			if (response.ok) {
				const config = await response.json();
				this._hulls.set(id, config);
			}
		} catch {
			// 使用默认配置
		}
	}
	
	// ==================== 贴图加载 ====================
	
	/**
	 * 加载贴图
	 */
	async loadSprites(onProgress?: (loaded: number, total: number) => void): Promise<void> {
		this._updateState({ spritesStatus: 'loading' });
		
		try {
			const sprites = this._manifest?.sprites || {};
			const entries = Object.entries(sprites);
			const total = entries.length;
			let loaded = 0;
			
			await Promise.all(
				entries.map(async ([id, url]) => {
					try {
						const img = await this._loadImage(`${this._baseUrl}/${url}`);
						this._sprites.set(id, img);
					} catch (e) {
						console.warn(`[AssetRegistry] Failed to load sprite: ${id}`);
					} finally {
						loaded++;
						onProgress?.(loaded, total);
					}
				})
			);
			
			this._updateState({
				spritesStatus: 'loaded',
				spritesCount: this._sprites.size,
			});
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			this._updateState({
				spritesStatus: 'error',
				error,
			});
		}
	}
	
	private _loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
			img.src = url;
		});
	}
	
	// ==================== 获取方法 ====================
	
	/**
	 * 获取舰船定义
	 */
	getShip(id: string): ShipDefinition | undefined {
		return this._ships.get(id);
	}
	
	/**
	 * 获取船体定义
	 */
	getHull(id: string): HullDefinition | undefined {
		return this._hulls.get(id);
	}
	
	/**
	 * 获取武器定义
	 */
	getWeapon(id: string): WeaponDefinition | undefined {
		return this._weapons.get(id);
	}
	
	/**
	 * 获取贴图
	 */
	getSprite(id: string): HTMLImageElement | undefined {
		return this._sprites.get(id);
	}
	
	/**
	 * 获取所有舰船定义
	 */
	getAllShips(): ShipDefinition[] {
		return Array.from(this._ships.values());
	}
	
	/**
	 * 获取所有船体定义
	 */
	getAllHulls(): HullDefinition[] {
		return Array.from(this._hulls.values());
	}
	
	/**
	 * 获取所有武器定义
	 */
	getAllWeapons(): WeaponDefinition[] {
		return Array.from(this._weapons.values());
	}
	
	/**
	 * 检查配置是否已加载
	 */
	isConfigLoaded(): boolean {
		return this._state.configStatus === 'loaded';
	}
	
	/**
	 * 检查贴图是否已加载
	 */
	isSpritesLoaded(): boolean {
		return this._state.spritesStatus === 'loaded';
	}
	
	// ==================== 清理 ====================
	
	/**
	 * 清除所有资源
	 */
	clear(): void {
		this._weapons.clear();
		this._hulls.clear();
		this._ships.clear();
		this._sprites.clear();
		this._manifest = null;
		
		this._updateState({
			configStatus: 'idle',
			spritesStatus: 'idle',
			weaponsCount: 0,
			hullsCount: 0,
			shipsCount: 0,
			spritesCount: 0,
		});
	}
}

// 全局单例
let _instance: AssetRegistry | null = null;

/**
 * 获取资源注册表单例
 */
export function getAssetRegistry(options?: AssetRegistryOptions): AssetRegistry {
	if (!_instance) {
		_instance = new AssetRegistry(options);
	}
	return _instance;
}

/**
 * 重置资源注册表（用于测试）
 */
export function resetAssetRegistry(): void {
	_instance?.clear();
	_instance = null;
}