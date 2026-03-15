/**
 * 图层渲染模块导出
 */

// 图层管理器
export {
	createLayers,
	setupLayerOrder,
	LAYER_CONFIG,
	type LayerRegistry,
} from "./LayerManager";

// 背景渲染器
export {
	renderBackground,
	updateBackground,
	updateParallax,
	type BackgroundConfig,
} from "./BackgroundRenderer";

// 网格渲染器
export {
	renderGrid,
	updateGrid,
	toggleGridVisibility,
	type GridConfig,
} from "./GridRenderer";

// Token 渲染器
export {
	renderToken,
	renderAllTokens,
	type TokenRendererConfig,
} from "./TokenRenderer";

// 护盾渲染器
export {
	renderShield,
	updateShield,
	clearShield,
	type ShieldRenderConfig,
} from "./ShieldRenderer";

// 武器射程渲染器
export {
	renderWeaponRanges,
	updateWeaponRanges,
	clearWeaponRanges,
	type WeaponRangeConfig,
	type WeaponMountData,
} from "./WeaponRangeRenderer";

// 其他玩家相机渲染器
export {
	renderCameraIndicator,
	renderAllOtherPlayersCameras,
	updateCameraIndicator,
	type CameraIndicatorConfig,
} from "./OtherPlayersCameraRenderer";

// 选中状态图层渲染器
export {
	renderSelectionLayer,
	updateSelectionLayer,
	type SelectionLayerConfig,
} from "./SelectionLayerRenderer";
