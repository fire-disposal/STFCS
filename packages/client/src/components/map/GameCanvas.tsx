import { StarfieldGenerator } from "@/features/game/rendering/StarfieldBackground";
import { useAppSelector } from "@/store";
import { useSelectionStore } from "@/store/selectionStore";
import { useUIStore } from "@/store/uiStore";
import { Application } from "@pixi/react";
import type { ShipState } from "@vt/contracts";
import React, { useEffect, useMemo, useRef } from "react";
import {
	useCamera,
	useCanvasResize,
	useGridRendering,
	useInitializeStarfield,
	useInteraction,
	useLayerSystem,
	useMapCursor,
	useMovementRendering,
	usePixiApp,
	useShipRendering,
	useStarfieldRendering,
	useWeaponArcsRendering,
	useWheelZoom,
	useZoomInteraction,
} from "./hooks";
import type { MovementState } from "./hooks/useMovementRendering";

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
}) => {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasSize = useCanvasResize(hostRef);
	const starfield = useStarfield();
	const { selectShip: storeSelectShip, setMouseWorldPosition, handleClick } = useSelectionStore();
	const { setZoom, setCameraPosition, setMapCursor, mapCursor } = useUIStore();
	const movementState = useAppSelector((state: any) => state.movement) as MovementState;

	const camera = useCamera(canvasSize, setZoom, setCameraPosition);
	const interaction = useInteraction(onPanDelta, onRotateDelta, camera.screenDeltaToWorldDelta);
	const layerSystem = useLayerSystem();
	const zoomInteraction = useZoomInteraction(camera, canvasSize, setZoom, setCameraPosition);
	const pixiApp = usePixiApp({
		canvasSize,
		cameraRef: camera.cameraRef,
		dragStateRef: interaction.dragStateRef,
		spacePressedRef: interaction.spacePressedRef,
		flushDragDelta: interaction.flushDragDelta,
		scheduleDragFlush: interaction.scheduleDragFlush,
		onClick,
		setLayers: layerSystem.setLayers,
		setMapCursor,
	});

	// 游标渲染（作为图层挂载）
	useMapCursor({
		layers: layerSystem.layers,
		mapCursor,
	});

	useWheelZoom(hostRef, zoomInteraction.queueZoom);
	useStarfieldRendering(layerSystem.layers, starfield);
	useInitializeStarfield(layerSystem.layers, starfield);
	useShipRendering(
		layerSystem.layers,
		ships,
		selectedShipId,
		onSelectShip,
		setMouseWorldPosition,
		zoom,
		cameraX,
		cameraY,
		canvasSize.width,
		canvasSize.height,
		handleClick,
		storeSelectShip,
		viewRotation
	);
	useMovementRendering(layerSystem.layers, ships, selectedShipId, movementState);

	useWeaponArcsRendering(layerSystem.layers, ships, selectedShipId, {
		showWeaponArcs,
		showMovementRange,
	});

	useGridRendering(layerSystem.layers, showGrid);

	// 同步相机状态
	useEffect(() => {
		camera.cameraRef.current = { cameraX, cameraY, zoom, viewRotation };
	}, [camera, cameraX, cameraY, zoom, viewRotation]);

	// 更新图层变换
	useEffect(() => {
		layerSystem.updateLayerTransforms(
			zoom,
			cameraX,
			cameraY,
			canvasSize,
			viewRotation,
			showBackground
		);
	}, [layerSystem, zoom, cameraX, cameraY, canvasSize, viewRotation, showBackground]);

	// 更新点击区域
	useEffect(() => {
		layerSystem.updateHitAreas(canvasSize);
	}, [layerSystem, canvasSize]);

	// 设置游标事件监听（在 usePixiApp 中统一处理）

	const handleInit = (app: any) => {
		pixiApp.handleInit(app);
	};

	return (
		<div ref={hostRef} id="game-canvas-host" className="game-map-container">
			<Application
				resizeTo={hostRef}
				autoDensity
				antialias
				background={0x06101a}
				eventMode="static"
				onInit={handleInit}
			/>
		</div>
	);
};

export default GameCanvas;
