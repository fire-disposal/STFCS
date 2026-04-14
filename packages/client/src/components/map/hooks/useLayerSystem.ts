import { Container, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasSize } from "./useCanvasResize";

export interface LayerRegistry {
	world: Container;
	background: Container;
	starfieldDeep: Container;
	starfieldMid: Container;
	starfieldNear: Container;
	starfieldNebula: Container;
	grid: Container;
	cursor: Container;
	ships: Container;
	labels: Container;
	effects: Container;
	weaponArcs: Container;
	movementVisuals: Container;
	shipIcons: Container;
}

export interface UseLayerSystemResult {
	layers: LayerRegistry | null;
	setLayers: (layers: LayerRegistry) => void;
	updateLayerTransforms: (
		zoom: number,
		cameraX: number,
		cameraY: number,
		canvasSize: CanvasSize,
		viewRotation: number,
		showBackground: boolean
	) => void;
	updateHitAreas: (canvasSize: CanvasSize) => void;
}

export function useLayerSystem(): UseLayerSystemResult {
	const [layers, setLayersState] = useState<LayerRegistry | null>(null);
	const layersRef = useRef<LayerRegistry | null>(null);

	const setLayers = useCallback((newLayers: LayerRegistry) => {
		setLayersState(newLayers);
		layersRef.current = newLayers;
	}, []);

	const updateLayerTransforms = useCallback(
		(
			zoom: number,
			cameraX: number,
			cameraY: number,
			canvasSize: CanvasSize,
			viewRotation: number,
			showBackground: boolean
		) => {
			const currentLayers = layersRef.current;
			if (!currentLayers) return;

			currentLayers.world.scale.set(zoom);
			currentLayers.world.position.set(
				canvasSize.width * 0.5 - cameraX * zoom,
				canvasSize.height * 0.5 - cameraY * zoom
			);

			currentLayers.world.rotation = (viewRotation * Math.PI) / 180;
			currentLayers.background.visible = showBackground;
			currentLayers.starfieldNebula.visible = showBackground;
			currentLayers.starfieldDeep.visible = showBackground;
			currentLayers.starfieldMid.visible = showBackground;
			currentLayers.starfieldNear.visible = showBackground;

			const parallaxFactor = 0.5;
			currentLayers.starfieldDeep.position.set(
				-cameraX * parallaxFactor * 0.3,
				-cameraY * parallaxFactor * 0.3
			);
			currentLayers.starfieldMid.position.set(
				-cameraX * parallaxFactor * 0.5,
				-cameraY * parallaxFactor * 0.5
			);
			currentLayers.starfieldNear.position.set(
				-cameraX * parallaxFactor * 0.8,
				-cameraY * parallaxFactor * 0.8
			);
			currentLayers.starfieldNebula.position.set(
				-cameraX * parallaxFactor * 0.2,
				-cameraY * parallaxFactor * 0.2
			);
		},
		[]
	);

	const updateHitAreas = useCallback((canvasSize: CanvasSize) => {
		const currentLayers = layersRef.current;
		if (!currentLayers) return;

		currentLayers.world.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
		currentLayers.ships.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
		currentLayers.cursor.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
	}, []);

	useEffect(() => {
		return () => {
			layersRef.current = null;
		};
	}, []);

	return {
		layers,
		setLayers,
		updateLayerTransforms,
		updateHitAreas,
	};
}
