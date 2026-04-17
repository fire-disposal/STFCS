import { StarfieldGenerator } from "../systems/StarfieldBackground";
import { useGameStore } from "@/state/stores";
import { useUIStore } from "@/state/stores/uiStore";
import { Application } from "@pixi/react";
import type { ShipState } from "@/sync/types";
import React, { useEffect, useMemo, useRef } from "react";
import { useCamera } from "../systems/useCamera";
import { useCanvasResize } from "./useCanvasResize";
import { useCursorRendering } from "../systems/CursorRenderer";
import { useGridRendering } from "../systems/GridRenderer";
import { useInteraction } from "../interactions/InteractionHandler";
import { useLayerSystem } from "./useLayerSystem";
import { usePixiApp } from "./usePixiApp";
import { useShipRendering } from "../entities/ShipRenderer";
import { useShipHUDRendering } from "../entities/ShipHUDRenderer";
import { useStarfieldRendering } from "../systems/StarfieldRenderer";
import { useWeaponArcsRendering } from "../entities/WeaponArcRenderer";
import { useArmorHexagonRendering } from "../entities/ArmorHexagonRenderer";
import { useMovementVisualRendering, type MovementPreviewState } from "../entities/MovementVisualRenderer";
import { useZoomInteraction } from "../interactions/ZoomHandler";

interface GameCanvasProps {
	ships: ShipState[];
	zoom: number;
	cameraX: number;
	cameraY: number;
	showGrid: boolean;
	selectedShipId?: string | null;
	onSelectShip?: (shipId: string) => void;
	onPanDelta?: (deltaX: number, deltaY: number) => void;
	onRotateDelta?: (delta: number) => void;
	showWeaponArcs?: boolean;
	showMovementRange?: boolean;
	showBackground?: boolean;
	onClick?: (x: number, y: number) => void;
	viewRotation?: number;
	/** 移动预览状态（从 BattleCommandPanel 同步） */
	movementPreview?: MovementPreviewState;
}

const useStarfield = () => {
	return useMemo(
		() =>
			new StarfieldGenerator({
				deepStars: 1000,
				midStars: 300,
				nearStars: 80,
				range: 10000,
				parallaxStrength: 0.6,
				enableNebula: true,
				nebulaCount: 4,
				nebulaOpacity: 0.12,
			}),
		[]
	);
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
	ships,
	zoom,
	cameraX,
	cameraY,
	showGrid,
	selectedShipId,
	onSelectShip,
	onPanDelta,
	onRotateDelta,
	showWeaponArcs = false,
	showMovementRange = false,
	showBackground = true,
	onClick,
	viewRotation = 0,
	movementPreview,
}) => {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasSize = useCanvasResize(hostRef);
	const starfield = useStarfield();
	const selectShipAction = useGameStore((state) => state.selectShip);
	const { setZoom, setCameraPosition, setMapCursor, mapCursor, showLabels, showEffects, showShipIcons } = useUIStore();

	const camera = useCamera(canvasSize, setZoom, setCameraPosition);
	const interaction = useInteraction(onPanDelta, onRotateDelta);
	const layerSystem = useLayerSystem();
	const zoomInteraction = useZoomInteraction(camera, canvasSize);

	const pixiApp = usePixiApp({
		canvasSize,
		cameraRef: camera.cameraRef,
		dragStateRef: interaction.dragStateRef,
		spacePressedRef: interaction.spacePressedRef,
		flushDragDelta: interaction.flushDragDelta,
		zoomInteraction,
		camera: { tickZoomAnimation: camera.tickZoomAnimation },
		onClick,
		setLayers: layerSystem.setLayers,
		setMapCursor,
	});

	useCursorRendering(layerSystem.layers, mapCursor);
	useStarfieldRendering(layerSystem.layers, starfield);

	// 舰船战术标记渲染（在 world 层）
	useShipRendering(
		layerSystem.layers,
		ships,
		selectedShipId,
		{
			zoom,
			x: cameraX,
			y: cameraY,
			canvasWidth: canvasSize.width,
			canvasHeight: canvasSize.height,
			viewRotation,
		},
		{ onSelectShip, storeSelectShip: selectShipAction }
	);

	// 舰船 HUD 渲染（血条/标签，在 HUD 层，固定像素大小）
	useShipHUDRendering(
		layerSystem.layers,
		ships,
		{ x: cameraX, y: cameraY, zoom, viewRotation },
		canvasSize,
		{ showHpBars: showLabels, showLabels: showLabels }
	);

	useWeaponArcsRendering(layerSystem.layers, ships, selectedShipId, {
		showWeaponArcs,
		showMovementRange: false,
	});
	useArmorHexagonRendering(layerSystem.layers, ships);
	useMovementVisualRendering(layerSystem.layers, ships, selectedShipId, {
		show: showMovementRange,
		preview: movementPreview,
	});
	useGridRendering(layerSystem.layers, showGrid);

	// 更新可见性
	useEffect(() => {
		if (!layerSystem.layers) return;
		layerSystem.layers.effects.visible = showEffects;
		layerSystem.layers.shipIcons.visible = showShipIcons;
	}, [layerSystem.layers, showEffects, showShipIcons]);

	// ⚠️ 使用 ref 存储 layerSystem 函数，避免对象引用作为依赖
	const updateWorldTransformsRef = useRef(layerSystem.updateWorldTransforms);
	updateWorldTransformsRef.current = layerSystem.updateWorldTransforms;
	const updateHitAreasRef = useRef(layerSystem.updateHitAreas);
	updateHitAreasRef.current = layerSystem.updateHitAreas;

	// ⚠️ 提取 canvasSize 的基本值作为依赖
	const canvasWidth = canvasSize.width;
	const canvasHeight = canvasSize.height;

	// 更新世界层和 HUD 层变换
	useEffect(() => {
		camera.cameraRef.current = { x: cameraX, y: cameraY, zoom, viewRotation };
		updateWorldTransformsRef.current(
			zoom,
			cameraX,
			cameraY,
			canvasSize,
			viewRotation,
			showBackground
		);
		updateHitAreasRef.current(canvasSize);
	}, [camera, cameraX, cameraY, zoom, viewRotation, canvasWidth, canvasHeight, showBackground]); // ⚠️ 使用 canvasWidth/canvasHeight 替代 canvasSize

	return (
		<div ref={hostRef} id="game-canvas-host" className="game-map-container">
			<Application
				resizeTo={hostRef}
				autoDensity
				antialias
				background={0x06101a}
				eventMode="static"
				onInit={pixiApp.handleInit}
			/>
		</div>
	);
};

export default GameCanvas;