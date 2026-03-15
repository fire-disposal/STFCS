/**
 * 视图管理框架类型定义
 *
 * 提供：
 * 1. 视图状态机
 * 2. 图层依赖图
 * 3. 渲染管道配置
 */

import type { CameraState } from '@vt/shared/types';

/**
 * 图层 ID 枚举
 */
export enum LayerId {
  // 背景层
  BACKGROUND_COLOR = 'background.color',
  BACKGROUND_STARS = 'background.stars',
  BACKGROUND_NEBULA = 'background.nebula',
  BACKGROUND_GRID = 'background.grid',
  
  // 对象层
  OBJECTS_TOKENS = 'objects.tokens',
  OBJECTS_SHIELDS = 'objects.shields',
  OBJECTS_WEAPON_RANGES = 'objects.weaponRanges',
  
  // 效果层
  EFFECTS_EXPLOSIONS = 'effects.explosions',
  EFFECTS_PARTICLES = 'effects.particles',
  
  // UI 层
  UI_SELECTIONS = 'ui.selections',
  UI_HIGHLIGHTS = 'ui.highlights',
  UI_OTHER_PLAYERS_CAMERAS = 'ui.otherPlayersCameras',
}

/**
 * 视图模式
 */
export enum ViewMode {
  /** 战术视图 */
  TACTICAL = 'tactical',
  /** 战略视图 */
  STRATEGIC = 'strategic',
  /** 自由视图 */
  FREE = 'free',
}

/**
 * 图层配置
 */
export interface LayerConfig {
  /** 图层 ID */
  id: LayerId;
  /** 图层名称 */
  name: string;
  /** Z 索引 */
  zIndex: number;
  /** 是否可见 */
  visible: boolean;
  /** 依赖的图层 */
  dependsOn?: LayerId[];
  /** 触发更新的状态路径 */
  updateTrigger?: string[];
}

/**
 * 图层依赖图
 */
export type LayerDependencyGraph = Record<LayerId, LayerConfig>;

/**
 * 视图状态
 */
export interface ViewState {
  /** 当前视图模式 */
  mode: ViewMode;
  
  /** 图层状态 */
  layers: {
    [K in LayerId]: {
      visible: boolean;
      dirty: boolean;
      lastUpdate: number;
    };
  };
  
  /** 相机状态 */
  camera: CameraState;
  
  /** 视口状态 */
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  
  /** 渲染统计 */
  stats: {
    fps: number;
    drawCalls: number;
    lastRenderTime: number;
  };
}

/**
 * 视图变更
 */
export interface ViewChange {
  /** 变更类型 */
  type: 'layer' | 'camera' | 'viewport' | 'mode';
  /** 变更的图层 ID（如果是图层变更） */
  layerId?: LayerId;
  /** 变更的值 */
  value: unknown;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 视图更新计划
 */
export interface ViewUpdatePlan {
  /** 需要更新的图层 */
  affectedLayers: LayerId[];
  /** 是否完全重绘 */
  fullRender: boolean;
  /** 更新优先级 */
  priority: 'low' | 'medium' | 'high';
}

/**
 * 渲染通道
 */
export interface RenderPass {
  /** 通道名称 */
  name: string;
  /** 包含的图层 */
  layers: LayerId[];
  /** 渲染条件 */
  condition?: (state: ViewState) => boolean;
  /** 是否可跳过 */
  skippable?: boolean;
}

/**
 * 渲染管道配置
 */
export interface RenderPipelineConfig {
  /** 渲染通道列表 */
  passes: RenderPass[];
  /** 是否启用自动批处理 */
  enableAutoBatching: boolean;
  /** 最大批处理大小 */
  maxBatchSize: number;
}

/**
 * 图层更新策略
 */
export interface LayerUpdateStrategy {
  /** 完全重绘 */
  full: () => void;
  /** 增量更新 */
  delta: (changes: ViewChange[]) => void;
  /** 仅相机相关 */
  cameraOnly: (camera: CameraState) => void;
  /** 仅特定图层 */
  layerOnly: (layerId: LayerId) => void;
}
