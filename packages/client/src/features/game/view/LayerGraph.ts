/**
 * 图层依赖图配置
 *
 * 定义所有图层的依赖关系和更新策略
 */

import type { LayerDependencyGraph } from './types';
import { LayerId, ViewMode } from './types';

// 重新导出 LayerId 和 ViewMode
export { LayerId, ViewMode };

/**
 * 图层依赖图配置
 * 
 * 定义原则：
 * 1. 背景层在最底层，无依赖
 * 2. 对象层依赖背景层
 * 3. 效果层依赖对象层
 * 4. UI 层在最上层
 */
export const LAYER_DEPENDENCY_GRAPH: LayerDependencyGraph = {
  // ===== 背景层 =====
  [LayerId.BACKGROUND_COLOR]: {
    id: LayerId.BACKGROUND_COLOR,
    name: 'Background Color',
    zIndex: 0,
    visible: true,
    dependsOn: [],
    updateTrigger: ['camera'],
  },
  [LayerId.BACKGROUND_STARS]: {
    id: LayerId.BACKGROUND_STARS,
    name: 'Background Stars',
    zIndex: 1,
    visible: true,
    dependsOn: [LayerId.BACKGROUND_COLOR],
    updateTrigger: ['camera'],
  },
  [LayerId.BACKGROUND_NEBULA]: {
    id: LayerId.BACKGROUND_NEBULA,
    name: 'Background Nebula',
    zIndex: 2,
    visible: true,
    dependsOn: [LayerId.BACKGROUND_STARS],
    updateTrigger: ['camera'],
  },
  [LayerId.BACKGROUND_GRID]: {
    id: LayerId.BACKGROUND_GRID,
    name: 'Grid',
    zIndex: 3,
    visible: true,
    dependsOn: [LayerId.BACKGROUND_COLOR],
    updateTrigger: ['camera', 'map.config.showGrid'],
  },
  
  // ===== 对象层 =====
  [LayerId.OBJECTS_TOKENS]: {
    id: LayerId.OBJECTS_TOKENS,
    name: 'Tokens',
    zIndex: 10,
    visible: true,
    dependsOn: [],
    updateTrigger: ['map.tokens', 'camera'],
  },
  [LayerId.OBJECTS_SHIELDS]: {
    id: LayerId.OBJECTS_SHIELDS,
    name: 'Shields',
    zIndex: 11,
    visible: true,
    dependsOn: [LayerId.OBJECTS_TOKENS],
    updateTrigger: ['map.tokens', 'camera'],
  },
  [LayerId.OBJECTS_WEAPON_RANGES]: {
    id: LayerId.OBJECTS_WEAPON_RANGES,
    name: 'Weapon Ranges',
    zIndex: 12,
    visible: false,
    dependsOn: [LayerId.OBJECTS_TOKENS],
    updateTrigger: ['selection.selectedTokenId', 'camera'],
  },
  
  // ===== 效果层 =====
  [LayerId.EFFECTS_EXPLOSIONS]: {
    id: LayerId.EFFECTS_EXPLOSIONS,
    name: 'Explosions',
    zIndex: 20,
    visible: true,
    dependsOn: [],
    updateTrigger: ['combat.explosions'],
  },
  [LayerId.EFFECTS_PARTICLES]: {
    id: LayerId.EFFECTS_PARTICLES,
    name: 'Particles',
    zIndex: 21,
    visible: true,
    dependsOn: [],
    updateTrigger: ['combat.particles'],
  },
  
  // ===== UI 层 =====
  [LayerId.UI_SELECTIONS]: {
    id: LayerId.UI_SELECTIONS,
    name: 'Selections',
    zIndex: 30,
    visible: true,
    dependsOn: [LayerId.OBJECTS_TOKENS],
    updateTrigger: ['selection.selections', 'camera'],
  },
  [LayerId.UI_HIGHLIGHTS]: {
    id: LayerId.UI_HIGHLIGHTS,
    name: 'Highlights',
    zIndex: 31,
    visible: true,
    dependsOn: [LayerId.OBJECTS_TOKENS],
    updateTrigger: ['interaction.hoverTokenId', 'camera'],
  },
  [LayerId.UI_OTHER_PLAYERS_CAMERAS]: {
    id: LayerId.UI_OTHER_PLAYERS_CAMERAS,
    name: 'Other Players Cameras',
    zIndex: 32,
    visible: true,
    dependsOn: [],
    updateTrigger: ['camera.remote', 'camera.local'],
  },
};

/**
 * 视图模式配置
 */
export const VIEW_MODE_CONFIGS: Record<ViewMode, {
  name: string;
  description: string;
  layerVisibility: Partial<Record<LayerId, boolean>>;
}> = {
  [ViewMode.TACTICAL]: {
    name: 'Tactical',
    description: 'Detailed tactical view with all information',
    layerVisibility: {
      [LayerId.BACKGROUND_STARS]: true,
      [LayerId.BACKGROUND_NEBULA]: true,
      [LayerId.BACKGROUND_GRID]: true,
      [LayerId.OBJECTS_TOKENS]: true,
      [LayerId.OBJECTS_SHIELDS]: true,
      [LayerId.OBJECTS_WEAPON_RANGES]: true,
      [LayerId.EFFECTS_EXPLOSIONS]: true,
      [LayerId.EFFECTS_PARTICLES]: true,
      [LayerId.UI_SELECTIONS]: true,
      [LayerId.UI_HIGHLIGHTS]: true,
      [LayerId.UI_OTHER_PLAYERS_CAMERAS]: true,
    },
  },
  [ViewMode.STRATEGIC]: {
    name: 'Strategic',
    description: 'Overview view with simplified details',
    layerVisibility: {
      [LayerId.BACKGROUND_STARS]: true,
      [LayerId.BACKGROUND_NEBULA]: false,
      [LayerId.BACKGROUND_GRID]: false,
      [LayerId.OBJECTS_TOKENS]: true,
      [LayerId.OBJECTS_SHIELDS]: false,
      [LayerId.OBJECTS_WEAPON_RANGES]: false,
      [LayerId.EFFECTS_EXPLOSIONS]: true,
      [LayerId.EFFECTS_PARTICLES]: false,
      [LayerId.UI_SELECTIONS]: true,
      [LayerId.UI_HIGHLIGHTS]: false,
      [LayerId.UI_OTHER_PLAYERS_CAMERAS]: true,
    },
  },
  [ViewMode.FREE]: {
    name: 'Free',
    description: 'Free view mode with customizable layers',
    layerVisibility: {},
  },
};

/**
 * 获取受影响的图层
 */
export function getAffectedLayers(
  statePath: string,
  graph: LayerDependencyGraph = LAYER_DEPENDENCY_GRAPH
): LayerId[] {
  const affected: Set<LayerId> = new Set();
  
  // 查找直接受影响的图层
  Object.values(graph).forEach(config => {
    if (config.updateTrigger?.some(trigger => 
      trigger === statePath || trigger.startsWith(statePath + '.')
    )) {
      affected.add(config.id);
    }
  });
  
  // 查找依赖这些图层的其他图层（传递闭包）
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(graph).forEach(config => {
      if (config.dependsOn?.some(dep => affected.has(dep)) && !affected.has(config.id)) {
        affected.add(config.id);
        changed = true;
      }
    });
  }
  
  return Array.from(affected);
}

/**
 * 获取图层更新顺序（拓扑排序）
 */
export function getLayerUpdateOrder(
  layerIds: LayerId[],
  graph: LayerDependencyGraph = LAYER_DEPENDENCY_GRAPH
): LayerId[] {
  const visited = new Set<LayerId>();
  const result: LayerId[] = [];
  
  function visit(id: LayerId): void {
    if (visited.has(id)) return;
    visited.add(id);
    
    const config = graph[id];
    config?.dependsOn?.forEach(dep => visit(dep));
    
    result.push(id);
  }
  
  layerIds.forEach(id => visit(id));
  return result;
}
