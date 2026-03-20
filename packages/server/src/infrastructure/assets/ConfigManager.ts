/**
 * 配置管理器
 * 
 * 负责加载、缓存和管理游戏配置数据
 * 支持从文件系统加载或使用默认配置
 */

import type {
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
	AssetManifest,
	IConfigLoader,
} from '@vt/shared/config';
import {
	DEFAULT_WEAPONS,
	DEFAULT_HULLS,
	DEFAULT_SHIPS,
	validateWeaponDefinition,
	validateHullDefinition,
	validateShipDefinition,
	validateShipReferences,
} from '@vt/shared/config';

export interface ConfigManagerOptions {
	/** 配置文件根目录 */
	configPath?: string;
	/** 是否使用默认配置作为回退 */
	useDefaults?: boolean;
	/** 是否启用热重载 */
	enableHotReload?: boolean;
}

/**
 * 配置管理器实现
 */
export class ConfigManager implements IConfigLoader {
	private _weapons: Map<string, WeaponDefinition> = new Map();
	private _hulls: Map<string, HullDefinition> = new Map();
	private _ships: Map<string, ShipDefinition> = new Map();
	private _manifest: AssetManifest | null = null;
	private _loaded: boolean = false;
	
	private readonly _configPath: string;
	private readonly _useDefaults: boolean;
	private readonly _enableHotReload: boolean;
	
	constructor(options: ConfigManagerOptions = {}) {
		this._configPath = options.configPath || './assets';
		this._useDefaults = options.useDefaults ?? true;
		this._enableHotReload = options.enableHotReload ?? false;
	}
	
	// ==================== 加载方法 ====================
	
	/**
	 * 加载所有配置
	 */
	async loadAll(): Promise<void> {
		// 先加载默认配置
		if (this._useDefaults) {
			this._loadDefaults();
		}
		
		// 尝试加载清单文件
		try {
			await this._loadManifest();
		} catch {
			console.warn('[ConfigManager] No manifest file found, using defaults');
		}
		
		// 加载配置文件
		await this._loadConfigFiles();
		
		this._loaded = true;
	}
	
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
	}
	
	/**
	 * 加载清单文件
	 */
	private async _loadManifest(): Promise<void> {
		const manifestPath = `${this._configPath}/manifest.json`;
		
		// 在浏览器环境中跳过文件加载
		if (typeof window !== 'undefined') {
			return;
		}
		
		try {
			const fs = await import('fs/promises');
			const content = await fs.readFile(manifestPath, 'utf-8');
			this._manifest = JSON.parse(content);
		} catch {
			throw new Error(`Failed to load manifest: ${manifestPath}`);
		}
	}
	
	/**
	 * 加载配置文件
	 */
	private async _loadConfigFiles(): Promise<void> {
		// 在浏览器环境中跳过文件加载
		if (typeof window !== 'undefined') {
			return;
		}
		
		const fs = await import('fs/promises');
		const path = await import('path');
		
		// 加载武器配置
		const weaponsPath = path.join(this._configPath, 'weapons');
		await this._loadConfigsFromDirectory(weaponsPath, 'weapon', fs, path);
		
		// 加载船体配置
		const hullsPath = path.join(this._configPath, 'hulls');
		await this._loadConfigsFromDirectory(hullsPath, 'hull', fs, path);
		
		// 加载舰船配置
		const shipsPath = path.join(this._configPath, 'ships');
		await this._loadConfigsFromDirectory(shipsPath, 'ship', fs, path);
	}
	
	/**
	 * 从目录加载配置文件
	 */
	private async _loadConfigsFromDirectory(
		dirPath: string,
		type: 'weapon' | 'hull' | 'ship',
		fs: typeof import('fs/promises'),
		path: typeof import('path')
	): Promise<void> {
		try {
			const files = await fs.readdir(dirPath);
			
			for (const file of files) {
				if (!file.endsWith('.json')) continue;
				
				const filePath = path.join(dirPath, file);
				try {
					const content = await fs.readFile(filePath, 'utf-8');
					const data = JSON.parse(content);
					
					this._addConfig(type, data);
				} catch (e) {
					console.error(`[ConfigManager] Failed to load ${filePath}:`, e);
				}
			}
		} catch {
			// 目录不存在，跳过
		}
	}
	
	/**
	 * 添加配置到缓存
	 */
	private _addConfig(type: 'weapon' | 'hull' | 'ship', data: unknown): void {
		switch (type) {
			case 'weapon': {
				const result = validateWeaponDefinition(data);
				if (result.valid && data && typeof data === 'object' && 'id' in data) {
					this._weapons.set((data as { id: string }).id, data as WeaponDefinition);
				} else {
					console.warn(`[ConfigManager] Invalid weapon config:`, result.errors);
				}
				break;
			}
			case 'hull': {
				const result = validateHullDefinition(data);
				if (result.valid && data && typeof data === 'object' && 'id' in data) {
					this._hulls.set((data as { id: string }).id, data as HullDefinition);
				} else {
					console.warn(`[ConfigManager] Invalid hull config:`, result.errors);
				}
				break;
			}
			case 'ship': {
				const result = validateShipDefinition(data);
				if (result.valid && data && typeof data === 'object' && 'id' in data) {
					const ship = data as ShipDefinition;
					// 验证引用完整性
					const refResult = validateShipReferences(
						ship,
						this._getAllHulls(),
						this._getAllWeapons()
					);
					if (refResult.valid) {
						this._ships.set(ship.id, ship);
					} else {
						console.warn(`[ConfigManager] Invalid ship references for ${ship.id}:`, refResult.errors);
					}
				} else {
					console.warn(`[ConfigManager] Invalid ship config:`, result.errors);
				}
				break;
			}
		}
	}
	
	// ==================== 获取方法 ====================
	
	/**
	 * 异步获取舰船定义
	 */
	async loadShipDefinition(id: string): Promise<ShipDefinition | null> {
		if (!this._loaded) {
			await this.loadAll();
		}
		return this._ships.get(id) || null;
	}
	
	/**
	 * 异步获取船体定义
	 */
	async loadHullDefinition(id: string): Promise<HullDefinition | null> {
		if (!this._loaded) {
			await this.loadAll();
		}
		return this._hulls.get(id) || null;
	}
	
	/**
	 * 异步获取武器定义
	 */
	async loadWeaponDefinition(id: string): Promise<WeaponDefinition | null> {
		if (!this._loaded) {
			await this.loadAll();
		}
		return this._weapons.get(id) || null;
	}
	
	/**
	 * 同步获取舰船定义
	 */
	getShipDefinition(id: string): ShipDefinition | undefined {
		return this._ships.get(id);
	}
	
	/**
	 * 同步获取船体定义
	 */
	getHullDefinition(id: string): HullDefinition | undefined {
		return this._hulls.get(id);
	}
	
	/**
	 * 同步获取武器定义
	 */
	getWeaponDefinition(id: string): WeaponDefinition | undefined {
		return this._weapons.get(id);
	}
	
	// ==================== 批量获取 ====================
	
	/**
	 * 获取所有舰船定义
	 */
	getAllShips(): Record<string, ShipDefinition> {
		return Object.fromEntries(this._ships);
	}
	
	/**
	 * 获取所有船体定义
	 */
	getAllHulls(): Record<string, HullDefinition> {
		return Object.fromEntries(this._hulls);
	}
	
	/**
	 * 获取所有武器定义
	 */
	getAllWeapons(): Record<string, WeaponDefinition> {
		return Object.fromEntries(this._weapons);
	}
	
	private _getAllHulls(): Record<string, HullDefinition> {
		return this.getAllHulls();
	}
	
	private _getAllWeapons(): Record<string, WeaponDefinition> {
		return this.getAllWeapons();
	}
	
	// ==================== 工具方法 ====================
	
	/**
	 * 检查是否已加载
	 */
	isLoaded(): boolean {
		return this._loaded;
	}
	
	/**
	 * 获取清单
	 */
	getManifest(): AssetManifest | null {
		return this._manifest;
	}
	
	/**
	 * 获取配置统计
	 */
	getStats(): {
		weapons: number;
		hulls: number;
		ships: number;
	} {
		return {
			weapons: this._weapons.size,
			hulls: this._hulls.size,
			ships: this._ships.size,
		};
	}
	
	/**
	 * 清除缓存
	 */
	clear(): void {
		this._weapons.clear();
		this._hulls.clear();
		this._ships.clear();
		this._manifest = null;
		this._loaded = false;
	}
}

// 单例实例
let _instance: ConfigManager | null = null;

/**
 * 获取配置管理器单例
 */
export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
	if (!_instance) {
		_instance = new ConfigManager(options);
	}
	return _instance;
}

/**
 * 重置配置管理器（用于测试）
 */
export function resetConfigManager(): void {
	_instance = null;
}