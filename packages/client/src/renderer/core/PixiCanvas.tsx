/**
 * PixiCanvas - 战术地图主组件
 *
 * 职责：
 * 1. 组合所有渲染 hooks，构建完整渲染管线
 * 2. 直接订阅 uiStore，管理相机/选中舰船状态
 * 3. 封装交互逻辑（平移/旋转/缩放），不依赖父组件传递
 *
 * 渲染管线：
 * ├── useCanvasResize    - 容器尺寸监听
 * ├── useLayerSystem     - 层级系统初始化
 * ├── useCamera          - 相机动画控制
 * ├── useInteraction     - 拖拽交互状态
 * ├── useZoomInteraction - 缩放交互
 * ├── usePixiApp         - Pixi 应用 + 事件绑定
 * ├── useStarfield       - 星空背景生成
 * └── useXxxRendering    - 各实体渲染
 *
 * Props 最小化原则：
 * - ships: 舰船数据列表
 * - onClick: 可选点击回调
 * - movementPreview: 移动预览状态
 * - 所有其他状态从 uiStore 内部订阅
 */

import { StarfieldGenerator } from "../systems/StarfieldBackground";
import { useUIStore } from "@/state/stores/uiStore";
import { Application } from "@pixi/react";
import type { ShipViewModel, MovementPreviewState } from "../types";
import React, { useEffect, useRef, useCallback, useMemo } from "react";
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
import { useArmorHexagonRendering } from "../entities/ArmorHexagonRenderer";
import { useMovementVisualRendering } from "../entities/MovementVisualRenderer";
import { useWeaponArcRendering } from "../entities/WeaponArcRenderer";
import { useZoomInteraction } from "../interactions/ZoomHandler";
import { normalizeRotation, screenDeltaToWorldDelta } from "@/utils/coordinateSystem";

interface GameCanvasProps {
	ships: ShipViewModel[];
	onClick?: (x: number, y: number) => void;
	movementPreview?: MovementPreviewState;
}

const useStarfield = () => {
	return useMemo(() => new StarfieldGenerator({
		deepStars: 1000,
		midStars: 300,
		nearStars: 80,
		range: 10000,
		parallaxStrength: 0.6,
		enableNebula: true,
		nebulaCount: 4,
		nebulaOpacity: 0.12,
	}), []);
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
	ships,
	onClick,
	movementPreview,
}) => {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasSize = useCanvasResize(hostRef);
	const starfield = useStarfield();

	const {
		zoom,
		cameraPosition,
		setCameraPosition,
		viewRotation,
		setViewRotation,
		showGrid,
		showBackground,
		showMovementRange,
		showLabels,
		showEffects,
		showShipIcons,
		selectedShipId,
		setZoom,
		setMapCursor,
		mapCursor,
		selectShip,
	} = useUIStore();

	const cameraPositionRef = useRef(cameraPosition);
	cameraPositionRef.current = cameraPosition;
	const viewRotationRef = useRef(viewRotation);
	viewRotationRef.current = viewRotation;

	const shipsWithSelected = useMemo(() => {
		return ships.map((ship) => ({
			...ship,
			selected: ship.id === selectedShipId,
		}));
	}, [ships, selectedShipId]);

	const handlePanDelta = useCallback((deltaX: number, deltaY: number) => {
		const worldDelta = screenDeltaToWorldDelta(deltaX, deltaY, zoom, -viewRotationRef.current);
		setCameraPosition(cameraPositionRef.current.x - worldDelta.x, cameraPositionRef.current.y - worldDelta.y);
	}, [setCameraPosition, zoom]);

	const handleRotateDelta = useCallback((delta: number) => {
		setViewRotation(normalizeRotation(viewRotationRef.current + delta));
	}, [setViewRotation]);

	const camera = useCamera(canvasSize, setZoom, setCameraPosition);
	const interaction = useInteraction(handlePanDelta, handleRotateDelta);
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
		shipsWithSelected,
		selectedShipId,
		{
			zoom,
			x: cameraPosition.x,
			y: cameraPosition.y,
			canvasWidth: canvasSize.width,
			canvasHeight: canvasSize.height,
			viewRotation,
		},
		{ onSelectShip: selectShip, storeSelectShip: selectShip }
	);

	useShipHUDRendering(
		layerSystem.layers,
		shipsWithSelected,
		{ x: cameraPosition.x, y: cameraPosition.y, zoom, viewRotation },
		canvasSize,
		{ showHpBars: showLabels, showLabels: showLabels }
	);

	useArmorHexagonRendering(layerSystem.layers, shipsWithSelected);
	useMovementVisualRendering(layerSystem.layers, shipsWithSelected, selectedShipId ?? null, movementPreview, {
		show: showMovementRange,
	});
	useWeaponArcRendering(layerSystem.layers, shipsWithSelected, selectedShipId ?? null);
	useGridRendering(layerSystem.layers, showGrid);

	useEffect(() => {
		if (!layerSystem.layers) return;
		layerSystem.layers.effects.visible = showEffects;
		layerSystem.layers.shipIcons.visible = showShipIcons;
	}, [layerSystem.layers, showEffects, showShipIcons]);

	const updateWorldTransformsRef = useRef(layerSystem.updateWorldTransforms);
	updateWorldTransformsRef.current = layerSystem.updateWorldTransforms;
	const updateHitAreasRef = useRef(layerSystem.updateHitAreas);
	updateHitAreasRef.current = layerSystem.updateHitAreas;

	const canvasWidth = canvasSize.width;
	const canvasHeight = canvasSize.height;

	useEffect(() => {
		camera.cameraRef.current = { x: cameraPosition.x, y: cameraPosition.y, zoom, viewRotation };
		updateWorldTransformsRef.current(
			zoom,
			cameraPosition.x,
			cameraPosition.y,
			canvasSize,
			viewRotation,
			showBackground
		);
		updateHitAreasRef.current(canvasSize);
	}, [camera, cameraPosition.x, cameraPosition.y, zoom, viewRotation, canvasWidth, canvasHeight, showBackground]);

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