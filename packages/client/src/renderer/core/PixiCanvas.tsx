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
 * ├── useTextureLoader   - 贴图预加载
 * ├── useShipTextureRendering - 舰船贴图渲染
 * ├── useWeaponTextureRendering - 武器贴图渲染
 * └── useXxxRendering    - 各实体渲染
 *
 * Props 最小化原则：
 * - ships: 舰船数据列表
 * - onClick: 可选点击回调
 * - movementPreview: 移动预览状态
 * - fetchAssets: 贴图数据获取函数
 * - 所有其他状态从 uiStore 内部订阅
 */

import { StarfieldGenerator } from "../systems/StarfieldBackground";
import { useUIStore } from "@/state/stores/uiStore";
import { Application } from "@pixi/react";
import type { MovementPreviewState } from "../types";
import type { CombatToken } from "@vt/data";
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
import { useShieldArcRendering } from "../entities/ShieldArcRenderer";
import { useFluxIndicatorRendering } from "../entities/FluxIndicatorRenderer";
import { useZoomInteraction } from "../interactions/ZoomHandler";
import { normalizeRotation, screenDeltaToWorldDelta } from "@/utils/coordinateSystem";
import { useTextureLoader } from "../systems/useTextureLoader";
import { useShipTextureRendering } from "../entities/ShipTextureRenderer";
import { useWeaponTextureRendering } from "../entities/WeaponTextureRenderer";
import type { AssetListItem } from "@vt/data";

interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}

interface GameCanvasProps {
	ships: CombatToken[];
	onClick?: (x: number, y: number) => void;
	movementPreview?: MovementPreviewState;
	fetchAssets?: (assetIds: string[], includeData: boolean) => Promise<AssetBatchGetResult[]>;
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

const noopFetchAssets = async (_assetIds: string[], _includeData: boolean): Promise<AssetBatchGetResult[]> => [];

function collectAssetIds(ships: CombatToken[]): string[] {
	const assetIds = new Set<string>();

	for (const ship of ships) {
		if (ship.spec.texture?.assetId) {
			assetIds.add(ship.spec.texture.assetId);
		}

		const mounts = ship.spec.mounts;
		if (mounts) {
			for (const mount of mounts) {
				const weapon = mount.weapon;
				if (weapon?.spec?.texture?.assetId) {
					assetIds.add(weapon.spec.texture.assetId);
				}
			}
		}
	}

	return Array.from(assetIds);
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
	ships,
	onClick,
	movementPreview,
	fetchAssets = noopFetchAssets,
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
		showShipTextures,
		showWeaponTextures,
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

	const assetIds = useMemo(() => collectAssetIds(ships), [ships]);
	const textureCache = useTextureLoader({ assetIds, fetchAssets });

	useCursorRendering(layerSystem.layers, mapCursor);
	useStarfieldRendering(layerSystem.layers, starfield);

	useShipTextureRendering(layerSystem.layers, ships, textureCache);
	useWeaponTextureRendering(layerSystem.layers, ships, textureCache);

	useShipRendering(
		layerSystem.layers,
		ships,
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
		ships,
		{ x: cameraPosition.x, y: cameraPosition.y, zoom, viewRotation },
		canvasSize,
		selectedShipId ?? null,
		{ showHpBars: showLabels, showLabels: showLabels }
	);

	useArmorHexagonRendering(layerSystem.layers, ships);
	useShieldArcRendering(layerSystem.layers, ships);
	useFluxIndicatorRendering(layerSystem.layers, ships);
	useMovementVisualRendering(layerSystem.layers, ships, selectedShipId ?? null, movementPreview, {
		show: showMovementRange,
	});
	useWeaponArcRendering(layerSystem.layers, ships, selectedShipId ?? null);
	useGridRendering(layerSystem.layers, showGrid);

	useEffect(() => {
		if (!layerSystem.layers) return;
		layerSystem.layers.tacticalTokens.visible = true;
		layerSystem.layers.effects.visible = showEffects;
		layerSystem.layers.shipIcons.visible = showShipIcons;
		layerSystem.layers.shipSprites.visible = showShipTextures;
		layerSystem.layers.weaponSprites.visible = showWeaponTextures;
	}, [layerSystem.layers, showEffects, showShipIcons, showShipTextures, showWeaponTextures]);

	const updateWorldTransformsRef = useRef(layerSystem.updateWorldTransforms);
	updateWorldTransformsRef.current = layerSystem.updateWorldTransforms;
	const updateHitAreasRef = useRef(layerSystem.updateHitAreas);
	updateHitAreasRef.current = layerSystem.updateHitAreas;

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
	}, [camera, cameraPosition.x, cameraPosition.y, zoom, viewRotation, showBackground, canvasSize]);

	useEffect(() => {
		updateHitAreasRef.current(canvasSize);
	}, [canvasSize]);

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