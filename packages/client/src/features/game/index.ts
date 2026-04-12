/**
 * 游戏模块导出
 *
 * 提供游戏核心功能：
 * - 视图管理
 * - 组件
 */

// 视图管理
export * from './view/types';
export {
  LAYER_DEPENDENCY_GRAPH,
  VIEW_MODE_CONFIGS,
  getAffectedLayers,
  getLayerUpdateOrder,
} from './view/LayerGraph';
export {
  RenderPipeline,
  createRenderPipeline,
} from './view/RenderPipeline';
export {
  ViewStateMachine,
  createViewStateMachine,
  type ViewStateMachineOptions,
} from './view/ViewStateMachine';

// 组件
export * from './components/TokenAddons';

// 增强版回合指示器
export { EnhancedTurnIndicator } from './EnhancedTurnIndicator';

// 回合状态指示器
export { TurnIndicator } from './TurnIndicator';