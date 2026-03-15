/**
 * 视图状态机
 *
 * 管理视图状态的变更和更新调度
 */

import type { CameraState } from '@vt/shared/types';
import type { ViewState, ViewChange, ViewUpdatePlan, LayerId } from './types';
import { ViewMode, LAYER_DEPENDENCY_GRAPH, getAffectedLayers, VIEW_MODE_CONFIGS } from './LayerGraph';

/**
 * 视图状态机配置
 */
export interface ViewStateMachineOptions {
  /** 初始视图模式 */
  initialMode?: ViewMode;
  /** 初始相机状态 */
  initialCamera?: Partial<CameraState>;
  /** 初始视口状态 */
  initialViewport?: { width: number; height: number };
  /** 是否启用日志 */
  enableLogging?: boolean;
}

/**
 * 视图状态机
 */
export class ViewStateMachine {
  private state: ViewState;
  private enableLogging: boolean;
  private changeQueue: ViewChange[] = [];
  private subscribers: Set<(state: ViewState, changes: ViewChange[]) => void> = new Set();

  constructor(options: ViewStateMachineOptions = {}) {
    this.enableLogging = options.enableLogging ?? false;
    
    // 初始化状态
    this.state = {
      mode: options.initialMode ?? ViewMode.TACTICAL,
      layers: {} as ViewState['layers'],
      camera: {
        centerX: options.initialCamera?.centerX ?? 0,
        centerY: options.initialCamera?.centerY ?? 0,
        zoom: options.initialCamera?.zoom ?? 1,
        rotation: options.initialCamera?.rotation ?? 0,
        minZoom: options.initialCamera?.minZoom ?? 0.1,
        maxZoom: options.initialCamera?.maxZoom ?? 4,
      },
      viewport: {
        width: options.initialViewport?.width ?? 1920,
        height: options.initialViewport?.height ?? 1080,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      },
      stats: {
        fps: 0,
        drawCalls: 0,
        lastRenderTime: 0,
      },
    };
    
    // 初始化图层状态
    this.initializeLayers();
  }

  /**
   * 初始化图层状态
   */
  private initializeLayers(): void {
    const modeConfig = VIEW_MODE_CONFIGS[this.state.mode];
    
    Object.values(LAYER_DEPENDENCY_GRAPH).forEach(config => {
      const defaultVisible = modeConfig.layerVisibility[config.id] ?? config.visible;
      
      this.state.layers[config.id] = {
        visible: defaultVisible,
        dirty: true, // 初始状态标记为脏
        lastUpdate: 0,
      };
    });
  }

  /**
   * 获取当前状态
   */
  getState(): ViewState {
    return { ...this.state };
  }

  /**
   * 应用变更
   */
  applyChange(change: ViewChange): void {
    this.changeQueue.push(change);
    
    if (this.enableLogging) {
      console.log('[ViewState] Applied change:', change.type, change.layerId);
    }
    
    // 批量处理变更
    requestAnimationFrame(() => this.processChanges());
  }

  /**
   * 处理变更队列
   */
  private processChanges(): void {
    if (this.changeQueue.length === 0) return;

    const changes = [...this.changeQueue];
    this.changeQueue = [];

    // 应用变更到状态
    changes.forEach(change => this.applyChangeToState(change));

    // 通知订阅者
    this.notifySubscribers(changes);

    if (this.enableLogging) {
      console.log('[ViewState] Processed', changes.length, 'changes');
    }
  }

  /**
   * 应用单个变更到状态
   */
  private applyChangeToState(change: ViewChange): void {
    switch (change.type) {
      case 'layer': {
        const { layerId } = change;
        if (layerId && this.state.layers[layerId]) {
          this.state.layers[layerId].visible = (change.value as { visible: boolean }).visible;
          this.state.layers[layerId].dirty = true;
        }
        break;
      }

      case 'camera': {
        this.state.camera = { ...this.state.camera, ...(change.value as Partial<CameraState>) };
        // 相机变化会影响多个图层
        this.markCameraAffectedLayersDirty();
        break;
      }

      case 'viewport': {
        this.state.viewport = { ...this.state.viewport, ...(change.value as Partial<ViewState['viewport']>) };
        break;
      }

      case 'mode': {
        const newMode = change.value as ViewMode;
        if (newMode !== this.state.mode) {
          this.state.mode = newMode;
          this.applyModeConfig(newMode);
        }
        break;
      }
    }
  }

  /**
   * 应用视图模式配置
   */
  private applyModeConfig(mode: ViewMode): void {
    const config = VIEW_MODE_CONFIGS[mode as keyof typeof VIEW_MODE_CONFIGS];
    if (!config) return;

    Object.entries(config.layerVisibility).forEach(([layerId, visible]) => {
      const id = layerId as LayerId;
      if (this.state.layers[id]) {
        this.state.layers[id].visible = visible as boolean;
        this.state.layers[id].dirty = true;
      }
    });
  }

  /**
   * 标记相机影响的图层为脏
   */
  private markCameraAffectedLayersDirty(): void {
    const affectedLayers = getAffectedLayers('camera', LAYER_DEPENDENCY_GRAPH);
    affectedLayers.forEach(layerId => {
      if (this.state.layers[layerId]) {
        this.state.layers[layerId].dirty = true;
      }
    });
  }

  /**
   * 创建更新计划
   */
  createUpdatePlan(): ViewUpdatePlan {
    const dirtyLayers = Object.entries(this.state.layers)
      .filter(([, state]) => state.dirty && state.visible)
      .map(([id]) => id as LayerId);

    const fullRender = dirtyLayers.length === Object.keys(this.state.layers).length;
    
    // 根据脏图层数量确定优先级
    let priority: 'low' | 'medium' | 'high' = 'low';
    if (dirtyLayers.length > 10) {
      priority = 'high';
    } else if (dirtyLayers.length > 5) {
      priority = 'medium';
    }

    return {
      affectedLayers: dirtyLayers,
      fullRender,
      priority,
    };
  }

  /**
   * 订阅状态变更
   */
  subscribe(
    callback: (state: ViewState, changes: ViewChange[]) => void
  ): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(changes: ViewChange[]): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state, changes);
      } catch (error) {
        console.error('[ViewState] Error in subscriber:', error);
      }
    });
  }

  /**
   * 更新相机
   */
  updateCamera(camera: Partial<CameraState>): void {
    this.applyChange({
      type: 'camera',
      value: camera,
      timestamp: Date.now(),
    });
  }

  /**
   * 设置图层可见性
   */
  setLayerVisibility(layerId: LayerId, visible: boolean): void {
    this.applyChange({
      type: 'layer',
      layerId,
      value: { visible },
      timestamp: Date.now(),
    });
  }

  /**
   * 设置视图模式
   */
  setViewMode(mode: ViewMode): void {
    this.applyChange({
      type: 'mode',
      value: mode,
      timestamp: Date.now(),
    });
  }

  /**
   * 更新视口
   */
  updateViewport(viewport: Partial<ViewState['viewport']>): void {
    this.applyChange({
      type: 'viewport',
      value: viewport,
      timestamp: Date.now(),
    });
  }

  /**
   * 更新渲染统计
   */
  updateStats(stats: Partial<ViewState['stats']>): void {
    this.state.stats = { ...this.state.stats, ...stats };
  }
}

/**
 * 创建视图状态机
 */
export function createViewStateMachine(options?: ViewStateMachineOptions): ViewStateMachine {
  return new ViewStateMachine(options);
}
