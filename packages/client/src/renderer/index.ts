/**
 * 渲染层导出
 */

export type {
	ShipViewModel,
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

export { useGridRendering } from "./systems/GridRenderer";
export { useStarfieldRendering } from "./systems/StarfieldRenderer";
export { StarfieldGenerator } from "./systems/StarfieldBackground";
export { useCursorRendering } from "./systems/CursorRenderer";
export { useCamera } from "./systems/useCamera";
export { useCameraAnimation } from "./systems/useCameraAnimation";
export type { UseCameraAnimationResult } from "./systems/useCameraAnimation";

export { useInteraction, type DragState } from "./interactions/InteractionHandler";
export { useZoomInteraction, type UseZoomInteractionResult } from "./interactions/ZoomHandler";