/**
 * 图层系统类型定义
 * 支持多种视图模式和图层组管理
 */

/**
 * 图层 ID 枚举
 * 每个图层有唯一标识
 */
export enum LayerId {
	// 背景层
	BACKGROUND_STARS = "background.stars",
	BACKGROUND_NEBULA = "background.nebula",
	BACKGROUND_GRID = "background.grid",
	
	// 游戏对象层
	OBJECTS_TOKENS = "objects.tokens",
	OBJECTS_SHIELDS = "objects.shields",
	OBJECTS_WEAPON_RANGES = "objects.weaponRanges",
	
	// UI 层
	UI_STATUS_BARS = "ui.statusBars",
	UI_LABELS = "ui.labels",
	UI_SELECTION = "ui.selection",
	
	// 效果层
	EFFECTS_EXPLOSIONS = "effects.explosions",
	EFFECTS_DAMAGE_NUMBERS = "effects.damageNumbers",
	
	// 其他玩家层
	OTHER_PLAYERS_CAMERAS = "otherPlayers.cameras",
}

/**
 * 图层组 ID
 * 相关图层可以分组管理
 */
export enum LayerGroupId {
	BACKGROUND = "background",
	OBJECTS = "objects",
	UI = "ui",
	EFFECTS = "effects",
	OTHER_PLAYERS = "otherPlayers",
}

/**
 * 视图模式
 * 预设的图层可见性配置
 */
export enum ViewMode {
	/** 战术视图：显示所有游戏相关信息 */
	TACTICAL = "tactical",
	
	/** 航海视图：只显示导航相关信息，隐藏装饰 */
	NAVIGATION = "navigation",
	
	/** 装饰视图：只显示背景效果，隐藏游戏元素 */
	DECORATIVE = "decorative",
	
	/** 自定义：用户自定义配置 */
	CUSTOM = "custom",
}

/**
 * 图层配置
 */
export interface LayerConfig {
	/** 图层 ID */
	id: LayerId;
	/** 图层名称（用于 UI 显示） */
	name: string;
	/** 所属组 */
	groupId: LayerGroupId;
	/** 是否默认可见 */
	defaultVisible: boolean;
	/** 是否在视图切换时自动管理 */
	autoManaged: boolean;
}

/**
 * 图层组配置
 */
export interface LayerGroupConfig {
	/** 组 ID */
	id: LayerGroupId;
	/** 组名称 */
	name: string;
	/** 组内图层 ID 列表 */
	layerIds: LayerId[];
}

/**
 * 视图模式配置
 */
export interface ViewModeConfig {
	/** 视图模式 */
	mode: ViewMode;
	/** 视图名称 */
	name: string;
	/** 视图描述 */
	description: string;
	/** 图层可见性配置 */
	layerVisibility: Record<LayerId, boolean>;
}

/**
 * 图层状态
 */
export interface LayerState {
	/** 图层可见性 */
	visibility: Record<LayerId, boolean>;
	/** 当前视图模式 */
	currentViewMode: ViewMode;
	/** 图层不透明度（0-1） */
	opacity: Record<LayerId, number>;
}

/**
 * 图层管理器接口
 */
export interface ILayerManager {
	/** 设置图层可见性 */
	setLayerVisible(layerId: LayerId, visible: boolean): void;
	
	/** 获取图层可见性 */
	isLayerVisible(layerId: LayerId): boolean;
	
	/** 设置图层组可见性 */
	setGroupVisible(groupId: LayerGroupId, visible: boolean): void;
	
	/** 切换视图模式 */
	setViewMode(mode: ViewMode): void;
	
	/** 获取当前视图模式 */
	getViewMode(): ViewMode;
	
	/** 设置图层不透明度 */
	setLayerOpacity(layerId: LayerId, opacity: number): void;
	
	/** 重置为默认配置 */
	resetToDefaults(): void;
}

// 默认图层配置
export const DEFAULT_LAYER_CONFIGS: LayerConfig[] = [
	// 背景层
	{
		id: LayerId.BACKGROUND_STARS,
		name: "星空背景",
		groupId: LayerGroupId.BACKGROUND,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.BACKGROUND_NEBULA,
		name: "星云效果",
		groupId: LayerGroupId.BACKGROUND,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.BACKGROUND_GRID,
		name: "网格",
		groupId: LayerGroupId.BACKGROUND,
		defaultVisible: true,
		autoManaged: true,
	},
	
	// 游戏对象层
	{
		id: LayerId.OBJECTS_TOKENS,
		name: "游戏对象",
		groupId: LayerGroupId.OBJECTS,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.OBJECTS_SHIELDS,
		name: "护盾效果",
		groupId: LayerGroupId.OBJECTS,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.OBJECTS_WEAPON_RANGES,
		name: "武器射程",
		groupId: LayerGroupId.OBJECTS,
		defaultVisible: true,
		autoManaged: true,
	},
	
	// UI 层
	{
		id: LayerId.UI_STATUS_BARS,
		name: "状态条",
		groupId: LayerGroupId.UI,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.UI_LABELS,
		name: "标签",
		groupId: LayerGroupId.UI,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.UI_SELECTION,
		name: "选中高亮",
		groupId: LayerGroupId.UI,
		defaultVisible: true,
		autoManaged: true,
	},
	
	// 效果层
	{
		id: LayerId.EFFECTS_EXPLOSIONS,
		name: "爆炸效果",
		groupId: LayerGroupId.EFFECTS,
		defaultVisible: true,
		autoManaged: true,
	},
	{
		id: LayerId.EFFECTS_DAMAGE_NUMBERS,
		name: "伤害数字",
		groupId: LayerGroupId.EFFECTS,
		defaultVisible: true,
		autoManaged: true,
	},
	
	// 其他玩家层
	{
		id: LayerId.OTHER_PLAYERS_CAMERAS,
		name: "其他玩家相机",
		groupId: LayerGroupId.OTHER_PLAYERS,
		defaultVisible: true,
		autoManaged: true,
	},
];

// 默认图层组配置
export const DEFAULT_LAYER_GROUPS: LayerGroupConfig[] = [
	{
		id: LayerGroupId.BACKGROUND,
		name: "背景",
		layerIds: [
			LayerId.BACKGROUND_STARS,
			LayerId.BACKGROUND_NEBULA,
			LayerId.BACKGROUND_GRID,
		],
	},
	{
		id: LayerGroupId.OBJECTS,
		name: "游戏对象",
		layerIds: [
			LayerId.OBJECTS_TOKENS,
			LayerId.OBJECTS_SHIELDS,
			LayerId.OBJECTS_WEAPON_RANGES,
		],
	},
	{
		id: LayerGroupId.UI,
		name: "UI",
		layerIds: [
			LayerId.UI_STATUS_BARS,
			LayerId.UI_LABELS,
			LayerId.UI_SELECTION,
		],
	},
	{
		id: LayerGroupId.EFFECTS,
		name: "效果",
		layerIds: [
			LayerId.EFFECTS_EXPLOSIONS,
			LayerId.EFFECTS_DAMAGE_NUMBERS,
		],
	},
	{
		id: LayerGroupId.OTHER_PLAYERS,
		name: "其他玩家",
		layerIds: [
			LayerId.OTHER_PLAYERS_CAMERAS,
		],
	},
];

// 视图模式配置
export const VIEW_MODE_CONFIGS: ViewModeConfig[] = [
	{
		mode: ViewMode.TACTICAL,
		name: "战术视图",
		description: "显示所有游戏相关信息",
		layerVisibility: {
			[LayerId.BACKGROUND_STARS]: true,
			[LayerId.BACKGROUND_NEBULA]: false,
			[LayerId.BACKGROUND_GRID]: true,
			[LayerId.OBJECTS_TOKENS]: true,
			[LayerId.OBJECTS_SHIELDS]: true,
			[LayerId.OBJECTS_WEAPON_RANGES]: true,
			[LayerId.UI_STATUS_BARS]: true,
			[LayerId.UI_LABELS]: true,
			[LayerId.UI_SELECTION]: true,
			[LayerId.EFFECTS_EXPLOSIONS]: true,
			[LayerId.EFFECTS_DAMAGE_NUMBERS]: true,
			[LayerId.OTHER_PLAYERS_CAMERAS]: true,
		},
	},
	{
		mode: ViewMode.NAVIGATION,
		name: "航海视图",
		description: "只显示导航相关信息",
		layerVisibility: {
			[LayerId.BACKGROUND_STARS]: false,
			[LayerId.BACKGROUND_NEBULA]: false,
			[LayerId.BACKGROUND_GRID]: true,
			[LayerId.OBJECTS_TOKENS]: true,
			[LayerId.OBJECTS_SHIELDS]: false,
			[LayerId.OBJECTS_WEAPON_RANGES]: false,
			[LayerId.UI_STATUS_BARS]: false,
			[LayerId.UI_LABELS]: true,
			[LayerId.UI_SELECTION]: true,
			[LayerId.EFFECTS_EXPLOSIONS]: false,
			[LayerId.EFFECTS_DAMAGE_NUMBERS]: false,
			[LayerId.OTHER_PLAYERS_CAMERAS]: true,
		},
	},
	{
		mode: ViewMode.DECORATIVE,
		name: "装饰视图",
		description: "只显示背景效果",
		layerVisibility: {
			[LayerId.BACKGROUND_STARS]: true,
			[LayerId.BACKGROUND_NEBULA]: true,
			[LayerId.BACKGROUND_GRID]: false,
			[LayerId.OBJECTS_TOKENS]: false,
			[LayerId.OBJECTS_SHIELDS]: false,
			[LayerId.OBJECTS_WEAPON_RANGES]: false,
			[LayerId.UI_STATUS_BARS]: false,
			[LayerId.UI_LABELS]: false,
			[LayerId.UI_SELECTION]: false,
			[LayerId.EFFECTS_EXPLOSIONS]: false,
			[LayerId.EFFECTS_DAMAGE_NUMBERS]: false,
			[LayerId.OTHER_PLAYERS_CAMERAS]: false,
		},
	},
];
