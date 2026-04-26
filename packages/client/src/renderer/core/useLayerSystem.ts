/**
 * Layer 系统 - 管理渲染层级
 *
 * 层级结构：
 *
 * Stage
 * ├── world (游戏世界层，有 zoom/rotation/pivot)
 * │   ├── [zIndex 0] background (背景星空)
 * │   ├── [zIndex 0] starfieldNebula (星云层，视差)
 * │   ├── [zIndex 1] starfieldDeep (深层星空，视差)
 * │   ├── [zIndex 2] starfieldMid (中层星空，视差)
 * │   ├── [zIndex 3] starfieldNear (近层星空，视差)
 * │   ├── [zIndex 4] grid (网格)
 * │   ├── [zIndex 5] cursor (世界坐标系光标)
 * │   ├── [zIndex 7] tacticalTokens (舰船战术标记+挂载点+武器标记)
 * │   ├── [zIndex 8] weaponArcs (武器射界)
 * │   ├── [zIndex 9] movementVisuals (移动预览)
 * │   ├── [zIndex 10] shieldArcs (护盾弧)
 * │   ├── [zIndex 11] hexagonArmor (护甲六边形)
 * │   ├── [zIndex 13] shipSprites (舰船贴图)
 * │   └── [zIndex 14] weaponSprites (武器贴图)
 * │
 * └── hud (HUD层，独立于世界，固定像素大小，无变换)
 *     ├── [zIndex 0] shipBars (舰船血条)
 *     ├── [zIndex 1] fluxBars (辐能条)
 *     ├── [zIndex 2] shipNames (舰船名称)
 *     └── [zIndex 3] ownerLabels (所有者标签)
 */

import { Container, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasSize } from "./useCanvasResize";

/**
 * 渲染层注册表
 *
 * 包含所有渲染层的引用，分为：
 * - 世界层（world 及其子层）：受相机变换影响
 * - HUD 层（hud 及其子层）：固定像素大小，独立于相机
 */
export interface LayerRegistry {
	// === 根层 ===
	/** 世界层根容器 - 有 zoom/rotation/pivot */
	world: Container;

	// === 世界层子层（按 zIndex 排序） ===
	/** [zIndex 0] 背景星空 */
	background: Container;
	/** [zIndex 0] 星云层（视差） */
	starfieldNebula: Container;
	/** [zIndex 1] 深层星空（视差） */
	starfieldDeep: Container;
	/** [zIndex 2] 中层星空（视差） */
	starfieldMid: Container;
	/** [zIndex 3] 近层星空（视差） */
	starfieldNear: Container;
	/** [zIndex 4] 网格 */
	grid: Container;
	/** [zIndex 5] 世界坐标系光标 */
	cursor: Container;
	/** [zIndex 7] 舰船战术标记（箭头 token + 挂载点 + 武器标记） */
	tacticalTokens: Container;
	/** [zIndex 8] 武器射界可视化 */
	weaponArcs: Container;
	/** [zIndex 9] 移动预览箭头 */
	movementVisuals: Container;
	/** [zIndex 10] 护盾辉光弧线 */
	shieldArcs: Container;
	/** [zIndex 11] 护甲六边形 */
	hexagonArmor: Container;
	/** [zIndex 13] 舰船贴图精灵层 */
	shipSprites: Container;
	/** [zIndex 14] 武器贴图精灵层（最高层） */
	weaponSprites: Container;

	// === HUD 层（独立于世界） ===
	/** HUD 层根容器 - 固定在画布中心，无变换 */
	hud: Container;
	/** [zIndex 0] 舰船血条（固定像素大小） */
	shipBars: Container;
	/** [zIndex 1] 辐能条（固定像素大小） */
	fluxBars: Container;
	/** [zIndex 2] 舰船名称标签（固定像素大小） */
	shipNames: Container;
	/** [zIndex 3] 所有者标签（固定像素大小） */
	ownerLabels: Container;
}

export interface UseLayerSystemResult {
	layers: LayerRegistry | null;
	setLayers: (layers: LayerRegistry) => void;
	/** 更新世界层变换（zoom/rotation/pivot） */
	updateWorldTransforms: (
		zoom: number,
		x: number,
		y: number,
		canvasSize: CanvasSize,
		viewRotation: number,
		showBackground: boolean
	) => void;
	/** 更新点击区域 */
	updateHitAreas: (canvasSize: CanvasSize) => void;
}

export function useLayerSystem(): UseLayerSystemResult {
	const [layers, setLayersState] = useState<LayerRegistry | null>(null);
	const layersRef = useRef<LayerRegistry | null>(null);

	const setLayers = useCallback((newLayers: LayerRegistry) => {
		setLayersState(newLayers);
		layersRef.current = newLayers;
	}, []);

	/**
	 * 更新世界层变换
	 */
	const updateWorldTransforms = useCallback(
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

			// 世界层变换：缩放、pivot（相机中心）、位置（画布中心）、旋转
			currentLayers.world.scale.set(zoom);
			currentLayers.world.pivot.set(x, y);
			currentLayers.world.position.set(canvasSize.width * 0.5, canvasSize.height * 0.5);
			currentLayers.world.rotation = (viewRotation * Math.PI) / 180;

			// 背景可见性
			currentLayers.background.visible = showBackground;
			currentLayers.starfieldNebula.visible = showBackground;
			currentLayers.starfieldDeep.visible = showBackground;
			currentLayers.starfieldMid.visible = showBackground;
			currentLayers.starfieldNear.visible = showBackground;

			// 视差效果：星空层是 world 的子容器，继承 world.pivot/scale/rotation
			// 通过子层 position 堆叠实现视差：
			// - world.pivot = (x, y) 相机位置
			// - starfield.position = (x*(1-factor), y*(1-factor))
			// - 实际屏幕偏移 = position - pivot = -x*factor（视差移动）
			// factor 越大，星空移动越多（越近）
			const parallaxBase = 0.5;
			const nebulaFactor = parallaxBase * 0.2;  // 最远
			const deepFactor = parallaxBase * 0.3;
			const midFactor = parallaxBase * 0.5;
			const nearFactor = parallaxBase * 0.8;    // 最近

			currentLayers.starfieldNebula.position.set(
				x * (1 - nebulaFactor),
				y * (1 - nebulaFactor)
			);
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

			// HUD 层：固定在画布中心，无变换
			// HUD 元素位置通过 worldToScreen 计算，直接设置到元素上
			currentLayers.hud.position.set(canvasSize.width * 0.5, canvasSize.height * 0.5);
			currentLayers.hud.scale.set(1);
			currentLayers.hud.rotation = 0;
		},
		[]
	);

	/**
	 * 更新点击区域
	 */
	const updateHitAreas = useCallback((canvasSize: CanvasSize) => {
		const currentLayers = layersRef.current;
		if (!currentLayers) return;

		// 世界层点击区域：足够大以覆盖所有可能的点击
		const largeSize = Math.max(canvasSize.width, canvasSize.height, 10000) * 10;
		const halfSize = largeSize / 2;
		currentLayers.world.hitArea = new Rectangle(-halfSize, -halfSize, largeSize, largeSize);

		// 战术标记层点击区域（舰船选择）
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
		updateWorldTransforms,
		updateHitAreas,
	};
}

/**
 * 世界坐标转屏幕坐标（HUD 层坐标系）
 *
 * HUD 层坐标系：中心 (0, 0) 对应画布中心
 *
 * 计算步骤：
 * 1. 计算世界坐标相对于相机中心的偏移
 * 2. 应用视角旋转（逆时针旋转 viewRotation）
 * 3. 应用缩放
 *
 * @param worldX 世界 X 坐标
 * @param worldY 世界 Y 坐标
 * @param camera 相机状态 { x, y, zoom, viewRotation }
 * @param canvasSize 画布尺寸
 * @returns 屏幕坐标（相对于 HUD 层坐标系）
 */
export function worldToScreen(
	worldX: number,
	worldY: number,
	camera: { x: number; y: number; zoom: number; viewRotation: number },
	_canvasSize: { width: number; height: number }
): { screenX: number; screenY: number } {
	// 相对于相机中心的偏移（世界坐标系）
	const dx = worldX - camera.x;
	const dy = worldY - camera.y;

	// 应用视角旋转
	// 当 viewRotation > 0 时，世界逆时针旋转，屏幕上的元素顺时针旋转
	// 所以我们需要逆旋转来计算屏幕位置
	const rad = (camera.viewRotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const rotatedX = dx * cos - dy * sin;
	const rotatedY = dx * sin + dy * cos;

	// 应用缩放，得到 HUD 层坐标
	const screenX = rotatedX * camera.zoom;
	const screenY = rotatedY * camera.zoom;

	return { screenX, screenY };
}

/**
 * 屏幕坐标转世界坐标
 *
 * 逆向计算：HUD 层坐标 → 世界坐标
 *
 * @param screenX 屏幕 X 坐标（相对于 HUD 层坐标系）
 * @param screenY 屏幕 Y 坐标（相对于 HUD 层坐标系）
 * @param camera 相机状态
 * @returns 世界坐标
 */
export function screenToWorldCoords(
	screenX: number,
	screenY: number,
	camera: { x: number; y: number; zoom: number; viewRotation: number }
): { worldX: number; worldY: number } {
	// 逆缩放
	const scaledX = screenX / camera.zoom;
	const scaledY = screenY / camera.zoom;

	// 逆旋转
	const rad = -(camera.viewRotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const rotatedX = scaledX * cos - scaledY * sin;
	const rotatedY = scaledX * sin + scaledY * cos;

	// 加上相机偏移
	const worldX = rotatedX + camera.x;
	const worldY = rotatedY + camera.y;

	return { worldX, worldY };
}