/**
 * 渲染层导出
 */

// Core - 渲染基础设施
export { default as PixiCanvas } from "./core/PixiCanvas";
export { usePixiApp } from "./core/usePixiApp";
export { useCanvasResize } from "./core/useCanvasResize";
export { useLayerSystem, type LayerRegistry, worldToScreen, screenToWorldCoords } from "./core/useLayerSystem";

// Entities - 实体渲染
export { useShipRendering } from "./entities/ShipRenderer";
export { useShipHUDRendering, ShipHUDManager, type ShipHUDRenderOptions } from "./entities/ShipHUDRenderer";
export { useWeaponArcsRendering } from "./entities/WeaponArcRenderer";
export { useArmorHexagonRendering } from "./entities/ArmorHexagonRenderer";
export { useMovementVisualRendering, type MovementPreviewState, type MoveMode, type MoveDirection } from "./entities/MovementVisualRenderer";
export { useTargetMarkers, type TargetMarkerOptions } from "./entities/TargetMarkerRenderer";

// Systems - 渲染系统
export { useGridRendering } from "./systems/GridRenderer";
export { useStarfieldRendering } from "./systems/StarfieldRenderer";
export { StarfieldGenerator } from "./systems/StarfieldBackground";
export { useCursorRendering } from "./systems/CursorRenderer";
export { useCamera } from "./systems/useCamera";
export { useCameraAnimation } from "./systems/useCameraAnimation";
export type { UseCameraAnimationResult } from "./systems/useCameraAnimation";

// Interactions - 交互处理
export { useInteraction, type DragState } from "./interactions/InteractionHandler";
export { useZoomInteraction, type UseZoomInteractionResult } from "./interactions/ZoomHandler";
export { useTokenSelection } from "./interactions/useTokenSelection";
export { useCanvasInteraction } from "./interactions/useCanvasInteraction";