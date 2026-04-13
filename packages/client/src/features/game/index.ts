/**
 * 游戏模块导出
 *
 * 提供游戏核心功能：
 * - 视图管理
 * - 组件
 */

// 视图管理
export * from "./view/types";
export {
	LAYER_DEPENDENCY_GRAPH,
	VIEW_MODE_CONFIGS,
	getAffectedLayers,
	getLayerUpdateOrder,
} from "./view/LayerGraph";
export {
	RenderPipeline,
	createRenderPipeline,
} from "./view/RenderPipeline";
export {
	ViewStateMachine,
	createViewStateMachine,
	type ViewStateMachineOptions,
} from "./view/ViewStateMachine";

// 组件
export * from "./components/TokenAddons";

// 阶段状态条
export { PhaseBar } from "./PhaseBar";
