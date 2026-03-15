/**
 * 渲染管道
 *
 * 管理渲染通道的执行顺序和条件
 */

import type { Container } from 'pixi.js';
import type { RenderPass, RenderPipelineConfig, LayerDependencyGraph, ViewState } from './types';
import { LayerId, LAYER_DEPENDENCY_GRAPH, getLayerUpdateOrder } from './LayerGraph';

/**
 * 渲染管道实现
 */
export class RenderPipeline {
  private config: RenderPipelineConfig;
  private layerGraph: LayerDependencyGraph;
  
  constructor(config?: Partial<RenderPipelineConfig>) {
    this.config = {
      passes: config?.passes ?? this.createDefaultPasses(),
      enableAutoBatching: config?.enableAutoBatching ?? true,
      maxBatchSize: config?.maxBatchSize ?? 100,
    };
    this.layerGraph = config?.passes ? LAYER_DEPENDENCY_GRAPH : LAYER_DEPENDENCY_GRAPH;
  }
  
  /**
   * 创建默认渲染通道
   */
  private createDefaultPasses(): RenderPass[] {
    return [
      {
        name: 'background',
        layers: [
          LayerId.BACKGROUND_COLOR,
          LayerId.BACKGROUND_STARS,
          LayerId.BACKGROUND_NEBULA,
          LayerId.BACKGROUND_GRID,
        ],
        skippable: false,
      },
      {
        name: 'objects',
        layers: [
          LayerId.OBJECTS_TOKENS,
          LayerId.OBJECTS_SHIELDS,
          LayerId.OBJECTS_WEAPON_RANGES,
        ],
        skippable: false,
      },
      {
        name: 'effects',
        layers: [
          LayerId.EFFECTS_EXPLOSIONS,
          LayerId.EFFECTS_PARTICLES,
        ],
        skippable: true,
      },
      {
        name: 'ui',
        layers: [
          LayerId.UI_SELECTIONS,
          LayerId.UI_HIGHLIGHTS,
          LayerId.UI_OTHER_PLAYERS_CAMERAS,
        ],
        condition: (state) => {
          // 只在有选中对象或其他玩家时渲染
          return true;
        },
        skippable: true,
      },
    ];
  }
  
  /**
   * 渲染所有通道
   */
  render(state: ViewState, layers: Record<LayerId, Container>): void {
    const passesToRender = this.config.passes.filter(pass => {
      // 检查通道条件
      if (pass.condition && !pass.condition(state)) {
        return false;
      }
      
      // 检查通道内的图层是否需要更新
      return pass.layers.some(layerId => {
        const layerState = state.layers[layerId];
        return layerState?.dirty && layerState.visible;
      });
    });
    
    // 按顺序执行渲染通道
    passesToRender.forEach(pass => {
      this.renderPass(pass, state, layers);
    });
  }
  
  /**
   * 渲染单个通道
   */
  private renderPass(
    pass: RenderPass,
    state: ViewState,
    layers: Record<LayerId, Container>
  ): void {
    // 获取需要更新的图层（按依赖顺序）
    const layersToUpdate = getLayerUpdateOrder(
      pass.layers.filter(id => {
        const layerState = state.layers[id];
        return layerState?.dirty && layerState.visible;
      }),
      this.layerGraph
    );
    
    // 渲染图层
    layersToUpdate.forEach(layerId => {
      const container = layers[layerId];
      if (!container) {
        console.warn(`[RenderPipeline] Layer container not found: ${layerId}`);
        return;
      }
      
      // 标记为已更新
      const layerState = state.layers[layerId];
      if (layerState) {
        layerState.dirty = false;
        layerState.lastUpdate = Date.now();
      }
    });
  }
  
  /**
   * 标记图层为脏
   */
  markLayerDirty(layerId: LayerId, state: ViewState): void {
    const layerState = state.layers[layerId as keyof typeof state.layers];
    if (layerState) {
      layerState.dirty = true;
    }
  }
  
  /**
   * 标记多个图层为脏
   */
  markLayersDirty(layerIds: LayerId[], state: ViewState): void {
    const order = getLayerUpdateOrder(layerIds, this.layerGraph);
    order.forEach(id => this.markLayerDirty(id, state));
  }
  
  /**
   * 获取渲染统计
   */
  getStats(): {
    totalPasses: number;
    totalLayers: number;
    skippablePasses: number;
  } {
    return {
      totalPasses: this.config.passes.length,
      totalLayers: this.config.passes.reduce((sum, pass) => sum + pass.layers.length, 0),
      skippablePasses: this.config.passes.filter(p => p.skippable).length,
    };
  }
  
  /**
   * 获取配置
   */
  getConfig(): RenderPipelineConfig {
    return { ...this.config };
  }
}

/**
 * 创建渲染管道
 */
export function createRenderPipeline(config?: Partial<RenderPipelineConfig>): RenderPipeline {
  return new RenderPipeline(config);
}
