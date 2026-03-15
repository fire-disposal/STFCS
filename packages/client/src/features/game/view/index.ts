/**
 * 视图管理框架导出
 *
 * 提供：
 * 1. 视图状态机 - 管理视图状态变更
 * 2. 图层依赖图 - 定义图层依赖关系
 * 3. 渲染管道 - 管理渲染通道执行
 */

// 类型定义
export * from './types';

// 图层依赖图
export {
  LAYER_DEPENDENCY_GRAPH,
  VIEW_MODE_CONFIGS,
  getAffectedLayers,
  getLayerUpdateOrder,
} from './LayerGraph';

// 渲染管道
export {
  RenderPipeline,
  createRenderPipeline,
} from './RenderPipeline';

// 视图状态机
export {
  ViewStateMachine,
  createViewStateMachine,
  type ViewStateMachineOptions,
} from './ViewStateMachine';
