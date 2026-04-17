/**
 * Layer 系统 - 管理渲染层级
 *
 * 层级结构设计（参考 RTS 游戏）：
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
 * │   ├── [zIndex 6] shipSprites (舰船精灵，预留)
 * │   ├── [zIndex 7] tacticalTokens (舰船战术标记 - 箭头)
 * │   ├── [zIndex 8] effects (特效 - 爆炸、粒子等)
 * │   ├── [zIndex 9] weaponArcs (武器射界可视化)
 * │   ├── [zIndex 10] movementVisuals (移动预览箭头)
 * │   ├── [zIndex 11] shipIcons (舰船图标层)
 * │   ├── [zIndex 12] shieldArcs (护盾辉光弧线)
 * │   ├── [zIndex 13] hexagonArmor (护甲六边形)
 * │   └── [zIndex 14] fluxIndicators (辐能/过载状态指示器)
 * │
 * └── hud (HUD层，独立于世界，固定像素大小，无变换)
 *     ├── [zIndex 0] shipBars (舰船血条 - 固定像素大小)
 *     ├── [zIndex 1] shipNames (舰船名称标签 - 固定像素大小)
 *     └── [zIndex 2] targetMarkers (目标标记 - 瞄准模式)
 *
 * 设计原则：
 * 1. world 层：所有游戏世界元素，统一受 zoom/rotation 变换
 * 2. hud 层：UI 元素，固定像素大小，通过坐标转换跟随世界元素
 * 3. 视差星空：不直接跟随 world 层变换，而是使用独立的位置计算
 *
 * 文本清晰度：
 * - hud 层的文本使用 resolution: 2，确保在高 DPI 屏幕上清晰
 * - 文本元素不继承任何缩放变换
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
	/** [zIndex 6] 舰船精灵层（预留） */
	shipSprites: Container;
	/** [zIndex 7] 舰船战术标记（箭头 token） */
	tacticalTokens: Container;
	/** [zIndex 8] 特效层 */
	effects: Container;
	/** [zIndex 9] 武器射界可视化 */
	weaponArcs: Container;
	/** [zIndex 10] 移动预览箭头 */
	movementVisuals: Container;
	/** [zIndex 11] 舰船图标层 */
	shipIcons: Container;
	/** [zIndex 12] 护盾辉光弧线 */
	shieldArcs: Container;
	/** [zIndex 13] 护甲六边形 */
	hexagonArmor: Container;
	/** [zIndex 14] 辐能/过载状态指示器 */
	fluxIndicators: Container;

	// === HUD 层（独立于世界） ===
	/** HUD 层根容器 - 固定在画布中心，无变换 */
	hud: Container;
	/** [zIndex 0] 舰船血条（固定像素大小） */
	shipBars: Container;
	/** [zIndex 1] 舰船名称标签（固定像素大小） */
	shipNames: Container;
	/** [zIndex 2] 目标标记（瞄准模式） */
	targetMarkers: Container;
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

			// 视差效果：星空层不直接跟随 world 层，而是使用独立的位置计算
			// 视差系数越小，星空移动越慢（感觉越远）
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
	canvasSize: { width: number; height: number }
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