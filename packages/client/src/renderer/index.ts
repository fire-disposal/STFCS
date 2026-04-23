/**
 * 渲染层导出入口
 *
 * 模块划分：
 * ├── core/     - 核心基础设施
 * │   ├── PixiCanvas       - 战术地图主组件
 * │   ├── usePixiApp       - Pixi 应用初始化 + 事件处理
 * │   ├── useLayerSystem   - 层级系统管理
 * │   └── useCanvasResize  - 容器尺寸监听
 * │
 * ├── entities/ - 游戏实体渲染器
 * │   ├── ShipRenderer         - 舰船战术标记
 * │   ├── ShipHUDRenderer      - 舰船 HUD（血条/标签）
 * │   ├── ArmorHexagonRenderer - 护甲六边形
 * │   ├── ShieldArcRenderer    - 护盾弧线
 * │   ├── FluxIndicatorRenderer - 辐能指示器
 * │   └── MovementVisualRenderer - 移动预览
 * │
 * ├── systems/  - 系统级渲染
 * │   ├── GridRenderer       - 网格渲染
 * │   ├── StarfieldRenderer  - 星空背景
 * │   ├── CursorRenderer     - 世界游标
 * │   ├── useCamera          - 相机控制
 * │   └── useCameraAnimation - 相机动画
 * │
 * └── interactions/ - 交互处理
 * │   ├── InteractionHandler - 拖拽状态管理
 * │   └── ZoomHandler        - 缩放交互
 */

export type {
	RenderContext,
	MovementPreviewState,
	MoveMode,
	ShipRenderOptions,
	ShipHUDRenderOptions,
	ShieldArcOptions,
	FluxIndicatorOptions,
} from "./types";

export { default as PixiCanvas } from "./core/PixiCanvas";
export { usePixiApp } from "./core/usePixiApp";
export { useCanvasResize } from "./core/useCanvasResize";
export { useLayerSystem, type LayerRegistry, worldToScreen, screenToWorldCoords } from "./core/useLayerSystem";

export { useShipRendering } from "./entities/ShipRenderer";
export { useShipHUDRendering, ShipHUDManager } from "./entities/ShipHUDRenderer";
export { useArmorHexagonRendering } from "./entities/ArmorHexagonRenderer";
export { useShieldArcRendering } from "./entities/ShieldArcRenderer";
export { useFluxIndicatorRendering } from "./entities/FluxIndicatorRenderer";
export { useMovementVisualRendering } from "./entities/MovementVisualRenderer";
export { useWeaponArcRendering } from "./entities/WeaponArcRenderer";

export { useGridRendering } from "./systems/GridRenderer";
export { useStarfieldRendering } from "./systems/StarfieldRenderer";
export { StarfieldGenerator } from "./systems/StarfieldBackground";
export { useCursorRendering } from "./systems/CursorRenderer";
export { useCamera } from "./systems/useCamera";
export { useCameraAnimation } from "./systems/useCameraAnimation";
export type { UseCameraAnimationResult } from "./systems/useCameraAnimation";

export { useInteraction, type DragState } from "./interactions/InteractionHandler";
export { useZoomInteraction, type UseZoomInteractionResult } from "./interactions/ZoomHandler";