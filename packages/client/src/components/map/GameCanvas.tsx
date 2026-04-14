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
	useCursorRendering,
	useGridRendering,
	useInteraction,
	useLayerSystem,
	useMovementRendering,
	usePixiApp,
	useShipRendering,
	useStarfieldRendering,
	useWeaponArcsRendering,
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
	const { selectShip: storeSelectShip, setMouseWorldPosition } = useSelectionStore();
	const { setZoom, setCameraPosition, setMapCursor, mapCursor } = useUIStore();
	const movementState = useAppSelector((state: any) => state.movement) as MovementState;

	const camera = useCamera(canvasSize, setZoom, setCameraPosition);
	const interaction = useInteraction(onPanDelta, onRotateDelta, camera.screenDeltaToWorldDelta);
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
	useShipRendering(
		layerSystem.layers,
		ships,
		selectedShipId,
		{ zoom, cameraX, cameraY, canvasWidth: canvasSize.width, canvasHeight: canvasSize.height, viewRotation },
		{ onSelectShip, setMouseWorldPosition, storeSelectShip }
	);
	useMovementRendering(layerSystem.layers, ships, selectedShipId, movementState);
	useWeaponArcsRendering(layerSystem.layers, ships, selectedShipId, {
		showWeaponArcs,
		showMovementRange,
	});
	useGridRendering(layerSystem.layers, showGrid);

	useEffect(() => {
		camera.cameraRef.current = { cameraX, cameraY, zoom, viewRotation };
		layerSystem.updateLayerTransforms(zoom, cameraX, cameraY, canvasSize, viewRotation, showBackground);
		layerSystem.updateHitAreas(canvasSize);
	}, [camera, cameraX, cameraY, zoom, viewRotation, layerSystem, canvasSize, showBackground]);

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