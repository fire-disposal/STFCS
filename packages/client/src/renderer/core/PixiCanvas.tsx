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
import { useStarfieldRendering } from "../systems/StarfieldRenderer";
import { useWeaponArcsRendering } from "../entities/WeaponArcRenderer";
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
	useWeaponArcsRendering(layerSystem.layers, ships, selectedShipId, {
		showWeaponArcs,
		showMovementRange,
	});
	useGridRendering(layerSystem.layers, showGrid);

	useEffect(() => {
		if (!layerSystem.layers) return;
		layerSystem.layers.labels.visible = showLabels;
		layerSystem.layers.effects.visible = showEffects;
		layerSystem.layers.shipIcons.visible = showShipIcons;
	}, [layerSystem.layers, showLabels, showEffects, showShipIcons]);

	useEffect(() => {
		camera.cameraRef.current = { x: cameraX, y: cameraY, zoom, viewRotation };
		layerSystem.updateLayerTransforms(
			zoom,
			cameraX,
			cameraY,
			canvasSize,
			viewRotation,
			showBackground
		);
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