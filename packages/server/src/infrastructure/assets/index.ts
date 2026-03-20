/**
 * 资源管理模块
 * 
 * 导出配置管理和资源加载功能
 */

export {
	ConfigManager,
	getConfigManager,
	resetConfigManager,
	type ConfigManagerOptions,
} from './ConfigManager';

export {
	AssetLoader,
	getAssetLoader,
	resetAssetLoader,
	type AssetLoaderOptions,
	type LoadedAsset,
} from './AssetLoader';