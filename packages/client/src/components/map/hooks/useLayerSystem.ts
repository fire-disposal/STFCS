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
	/** 舰船素材图层（预留：后续加载 Sprite 资源） */
	shipSprites: Container;
	/** 战术视图图层（线条化 token） */
	tacticalTokens: Container;
	/** 标签图层（血条/名称，保持清晰可读） */
	shipLabels: Container;
	effects: Container;
	weaponArcs: Container;
	movementVisuals: Container;
	shipIcons: Container;
	/** 六边形护甲图层 */
	hexagonArmor: Container;
	/**
	 * @deprecated 兼容旧代码，指向 tacticalTokens
	 */
	ships: Container;
	/**
	 * @deprecated 兼容旧代码，指向 shipLabels
	 */
	labels: Container;
}

export interface UseLayerSystemResult {
	layers: LayerRegistry | null;
	setLayers: (layers: LayerRegistry) => void;
	updateLayerTransforms: (
		zoom: number,
		x: number,
		y: number,
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
			x: number,
			y: number,
			canvasSize: CanvasSize,
			viewRotation: number,
			showBackground: boolean
		) => {
			const currentLayers = layersRef.current;
			if (!currentLayers) return;

			currentLayers.world.scale.set(zoom);
			currentLayers.world.pivot.set(x, y);
			currentLayers.world.position.set(canvasSize.width * 0.5, canvasSize.height * 0.5);
			currentLayers.world.rotation = (viewRotation * Math.PI) / 180;
			currentLayers.background.visible = showBackground;
			currentLayers.starfieldNebula.visible = showBackground;
			currentLayers.starfieldDeep.visible = showBackground;
			currentLayers.starfieldMid.visible = showBackground;
			currentLayers.starfieldNear.visible = showBackground;

			const parallaxFactor = 0.5;
			const deepFactor = parallaxFactor * 0.3;
			const midFactor = parallaxFactor * 0.5;
			const nearFactor = parallaxFactor * 0.8;
			const nebulaFactor = parallaxFactor * 0.2;

			currentLayers.starfieldDeep.position.set(
				x * (1 - deepFactor),
				y * (1 - deepFactor)
			);
			currentLayers.starfieldMid.position.set(
				x * (1 - midFactor),
				y * (1 - midFactor)
			);
			currentLayers.starfieldNear.position.set(
				x * (1 - nearFactor),
				y * (1 - nearFactor)
			);
			currentLayers.starfieldNebula.position.set(
				x * (1 - nebulaFactor),
				y * (1 - nebulaFactor)
			);
		},
		[]
	);

	const updateHitAreas = useCallback((canvasSize: CanvasSize) => {
		const currentLayers = layersRef.current;
		if (!currentLayers) return;

		const largeSize = Math.max(canvasSize.width, canvasSize.height, 10000) * 10;
		const halfSize = largeSize / 2;
		currentLayers.world.hitArea = new Rectangle(-halfSize, -halfSize, largeSize, largeSize);
		currentLayers.tacticalTokens.hitArea = new Rectangle(
			-halfSize,
			-halfSize,
			largeSize,
			largeSize
		);
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
