/**
 * PixiJS 应用核心 Hook
 *
 * 职责：
 * 1. 初始化 Pixi Application
 * 2. 注册渲染层（调用 setLayers）
 * 3. 处理所有交互事件（鼠标/键盘）
 * 4. 管理 ticker 渲染循环
 *
 * 交互事件处理：
 * - pointerdown: 开始拖拽/点击 -> 设置游标位置
 * - pointermove: 拖拽平移/旋转
 * - pointerup: 结束拖拽
 * - wheel: 缩放控制
 *
 * 拖拽模式：
 * - 右键拖拽 = 平移（pan）
 * - 中键拖拽 = 旋转（rotate）
 * - 左键点击 = 选择/设置游标（click）
 *
 * 与其他模块协作：
 * - useLayerSystem: 提供层注册
 * - useInteraction: 拖拽状态管理
 * - useZoomInteraction: 缩放动画
 * - useCamera: 相机动画
 * - uiStore: 游标位置、舰船选择
 */

import { screenToWorld } from "@/utils/coordinateSystem";
import { Container, Graphics, Point, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";
import type { CanvasSize } from "./useCanvasResize";
import type { DragState } from "../interactions/InteractionHandler";
import type { LayerRegistry } from "./useLayerSystem";
import type { UseZoomInteractionResult } from "../interactions/ZoomHandler";

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export const DEFAULT_CAMERA: CameraState = {
	x: 0,
	y: 0,
	zoom: 1,
	viewRotation: 0,
};

export interface UsePixiAppResult {
	handleInit: (app: any) => void;
	pixiAppRef: React.MutableRefObject<any>;
	getWorldPoint: (event: any) => { x: number; y: number };
	setLayers: (layers: LayerRegistry) => void;
}

export interface UsePixiAppOptions {
	canvasSize: CanvasSize;
	cameraRef: React.MutableRefObject<CameraState>;
	dragStateRef: React.MutableRefObject<DragState>;
	flushDragDelta: () => void;
	zoomInteraction: UseZoomInteractionResult;
	camera: { tickZoomAnimation: () => void };
	onClick?: (x: number, y: number) => void;
	setLayers?: (layers: LayerRegistry) => void;
	setMapCursor?: (x: number, y: number, r: number) => void;
	overlayMode?: "none" | "pen" | "arrow" | "ping" | "note";
	overlayColor?: string;
	overlayClientRef?: React.MutableRefObject<any>;
	playerId?: string;
}

export function usePixiApp(options: UsePixiAppOptions): UsePixiAppResult {
	const {
		canvasSize,
		cameraRef,
		dragStateRef,
		flushDragDelta,
		zoomInteraction,
		camera,
		onClick,
		setLayers,
		setMapCursor,
	} = options;

	const pixiAppRef = useRef<any>(null);
	const layersRef = useRef<LayerRegistry | null>(null);
	const onClickRef = useRef(onClick);
	const setMapCursorRef = useRef(setMapCursor);
	const tickerCallbackRef = useRef<any>(null);

	onClickRef.current = onClick;
	setMapCursorRef.current = setMapCursor;

	const overlayClientRef = options.overlayClientRef;

	const isDrawingRef = useRef(false);
	const strokeIdRef = useRef("");
	const strokePointsRef = useRef<{ x: number; y: number }[]>([]);
	const arrowStartRef = useRef<{ x: number; y: number } | null>(null);
	const previewGfxRef = useRef<any>(null);
	const overlayModeRef = useRef(options.overlayMode ?? "none");
	overlayModeRef.current = options.overlayMode ?? "none";
	const overlayColorRef = useRef(options.overlayColor ?? "#FF6B6B");
	overlayColorRef.current = options.overlayColor ?? "#FF6B6B";
	const playerIdRef = useRef(options.playerId);
	playerIdRef.current = options.playerId;

	const getWorldPoint = useCallback(
		(event: any) => {
			const app = pixiAppRef.current;
			const screenWidth = app?.renderer?.screen?.width ?? canvasSize.width;
			const screenHeight = app?.renderer?.screen?.height ?? canvasSize.height;
			let screenX = event.global?.x;
			let screenY = event.global?.y;
			if (screenX === undefined || screenY === undefined) {
				const rect = app?.view?.getBoundingClientRect();
				const clientX = event.clientX ?? 0;
				const clientY = event.clientY ?? 0;
				if (rect) {
					screenX = ((clientX - rect.left) / rect.width) * screenWidth;
					screenY = ((clientY - rect.top) / rect.height) * screenHeight;
				} else {
					screenX = clientX;
					screenY = clientY;
				}
			}

			const world = layersRef.current?.world;
			if (world && screenX !== undefined && screenY !== undefined) {
				const local = world.toLocal(new Point(screenX, screenY));
				return { x: local.x, y: local.y };
			}

			const { zoom, x, y, viewRotation } = cameraRef.current;
			return screenToWorld(
				screenX - screenWidth / 2,
				screenY - screenHeight / 2,
				zoom,
				x,
				y,
				viewRotation ?? 0
			);
		},
		[canvasSize.width, canvasSize.height, cameraRef]
	);

	const handleInit = useCallback(
		(app: any) => {
			const getScreenCoords = (event: any) => {
				const screenWidth = app?.renderer?.screen?.width ?? canvasSize.width;
				const screenHeight = app?.renderer?.screen?.height ?? canvasSize.height;
				const scaleX = screenWidth ? canvasSize.width / screenWidth : 1;
				const scaleY = screenHeight ? canvasSize.height / screenHeight : 1;
				let x = event.global?.x;
				let y = event.global?.y;
				if (x === undefined || y === undefined) {
					const rect = app?.view?.getBoundingClientRect();
					const clientX = event.clientX ?? 0;
					const clientY = event.clientY ?? 0;
					if (rect) {
						x = ((clientX - rect.left) / rect.width) * screenWidth;
						y = ((clientY - rect.top) / rect.height) * screenHeight;
					} else {
						return { x: clientX, y: clientY };
					}
				}
				return { x: x * scaleX, y: y * scaleY };
			};

			// === 世界层（有 zoom/rotation） ===
			const world = new Container();
			world.sortableChildren = true;
			world.eventMode = "static";
			world.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

			const background = new Container();
			background.zIndex = 0;
			background.eventMode = "none";

			const starfieldNebula = new Container();
			starfieldNebula.zIndex = 0;
			starfieldNebula.eventMode = "none";

			const starfieldDeep = new Container();
			starfieldDeep.zIndex = 1;
			starfieldDeep.eventMode = "none";

			const starfieldMid = new Container();
			starfieldMid.zIndex = 2;
			starfieldMid.eventMode = "none";

			const starfieldNear = new Container();
			starfieldNear.zIndex = 3;
			starfieldNear.eventMode = "none";

			// 星空层作为 world 子容器（视差通过 position 堆叠）
			// background 是静态背景，星空层有视差效果

			const grid = new Container();
			grid.zIndex = 4;
			grid.eventMode = "none";

			const cursorLayer = new Container();
			cursorLayer.zIndex = 5;
			cursorLayer.eventMode = "none";
			cursorLayer.sortableChildren = true;

			const overlayLayer = new Container();
			overlayLayer.zIndex = 6;
			overlayLayer.eventMode = "none";
			overlayLayer.sortableChildren = true;

			const tacticalTokensLayer = new Container();
			tacticalTokensLayer.zIndex = 7;
			tacticalTokensLayer.eventMode = "static";
			tacticalTokensLayer.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

			const weaponArcsLayer = new Container();
			weaponArcsLayer.zIndex = 8;
			weaponArcsLayer.eventMode = "none";

			const movementVisualsLayer = new Container();
			movementVisualsLayer.zIndex = 9;
			movementVisualsLayer.eventMode = "none";

			const shieldArcsLayer = new Container();
			shieldArcsLayer.zIndex = 10;
			shieldArcsLayer.eventMode = "none";

			const hexagonArmorLayer = new Container();
			hexagonArmorLayer.zIndex = 11;
			hexagonArmorLayer.eventMode = "none";

			const shipSpritesLayer = new Container();
			shipSpritesLayer.zIndex = 13;
			shipSpritesLayer.eventMode = "none";

			const weaponSpritesLayer = new Container();
			weaponSpritesLayer.zIndex = 14;
			weaponSpritesLayer.eventMode = "none";

			world.addChild(
				background,
				starfieldNebula,
				starfieldDeep,
				starfieldMid,
				starfieldNear,
				grid,
				cursorLayer,
				overlayLayer,
				tacticalTokensLayer,
				weaponArcsLayer,
				movementVisualsLayer,
				shieldArcsLayer,
				hexagonArmorLayer,
				shipSpritesLayer,
				weaponSpritesLayer
			);

			// === HUD 层（独立于世界，固定像素大小） ===
			const hud = new Container();
			hud.eventMode = "none";
			hud.sortableChildren = true;

			const shipBarsLayer = new Container();
			shipBarsLayer.zIndex = 0;
			shipBarsLayer.eventMode = "none";

			const fluxBarsLayer = new Container();
			fluxBarsLayer.zIndex = 1;
			fluxBarsLayer.eventMode = "none";

			const shipNamesLayer = new Container();
			shipNamesLayer.zIndex = 2;
			shipNamesLayer.eventMode = "none";

			const ownerLabelsLayer = new Container();
			ownerLabelsLayer.zIndex = 3;
			ownerLabelsLayer.eventMode = "none";

			const targetMarkersLayer = new Container();
			targetMarkersLayer.zIndex = 4;
			targetMarkersLayer.eventMode = "none";

			hud.addChild(shipBarsLayer, fluxBarsLayer, shipNamesLayer, ownerLabelsLayer);

			// 添加到舞台
			app.stage.addChild(world);
			app.stage.addChild(hud);

			const newLayers: LayerRegistry = {
				world,
				background,
				starfieldNebula,
				starfieldDeep,
				starfieldMid,
				starfieldNear,
				grid,
				cursor: cursorLayer,
				overlay: overlayLayer,
				shipSprites: shipSpritesLayer,
				weaponSprites: weaponSpritesLayer,
				tacticalTokens: tacticalTokensLayer,
				weaponArcs: weaponArcsLayer,
				movementVisuals: movementVisualsLayer,
				shieldArcs: shieldArcsLayer,
				hexagonArmor: hexagonArmorLayer,
				// HUD 层
				hud,
				shipBars: shipBarsLayer,
				fluxBars: fluxBarsLayer,
				shipNames: shipNamesLayer,
				ownerLabels: ownerLabelsLayer,
			};

			const shipsLayerRef = newLayers.tacticalTokens;
			const isShipObject = (target: any) => {
				let current = target;
				while (current) {
					if (current === shipsLayerRef) {
						return target !== shipsLayerRef;
					}
					current = current.parent;
				}
				return false;
			};

			layersRef.current = newLayers;
			setLayers?.(newLayers);

			pixiAppRef.current = app;
			app.stage.eventMode = "static";
			if ((app.renderer as any)?.events) {
				(app.renderer as any).events.eventMode = "static";
			}
			const initScreen = app?.renderer?.screen;
			if (initScreen) {
				app.stage.hitArea = new Rectangle(0, 0, initScreen.width, initScreen.height);
			}
			app.stage.cursor = "default";

			const stage = app.stage;

			stage.on("pointerdown", (event: any) => {
				const button = event.button ?? event.data?.button ?? 0;
				const dragState = dragStateRef.current;
				const screen = getScreenCoords(event);

				event.preventDefault();
				event.stopPropagation();

				if (button === 2) {
					// 右键 -> 平移
					dragState.active = true;
					dragState.mode = "pan";
					dragState.startX = screen.x;
					dragState.startY = screen.y;
					dragState.lastX = dragState.startX;
					dragState.lastY = dragState.startY;
					dragState.moved = false;
					stage.cursor = "grabbing";
					return;
				}

				if (button === 1) {
					// 中键 -> 旋转
					dragState.active = true;
					dragState.mode = "rotate";
					dragState.startX = screen.x;
					dragState.startY = screen.y;
					dragState.lastX = dragState.startX;
					dragState.lastY = dragState.startY;
					dragState.moved = false;
					stage.cursor = "grabbing";
					return;
				}

				if (button === 0 && overlayModeRef.current !== "none") {
					const wp = getWorldPoint(event);
					const mode = overlayModeRef.current;
					const color = overlayColorRef.current;

					if (mode === "pen") {
						isDrawingRef.current = true;
						strokeIdRef.current = `${playerIdRef.current}_${Date.now()}`;
						strokePointsRef.current = [{ x: wp.x, y: wp.y }];
						overlayClientRef?.current?.sendDrawStream(strokeIdRef.current, wp.x, wp.y, color, 3);
						event.stopPropagation();
						return;
					}

					if (mode === "arrow") {
						if (!arrowStartRef.current) {
							arrowStartRef.current = { x: wp.x, y: wp.y };
							if (!previewGfxRef.current && layersRef.current) {
								const g = new Graphics();
								layersRef.current.overlay.addChild(g);
								previewGfxRef.current = g;
							}
						} else {
							const start = arrowStartRef.current;
							const points = [start, { x: wp.x, y: wp.y }];
							overlayClientRef?.current?.sendDrawCommit(`${playerIdRef.current}_${Date.now()}`, "arrow", color, 3, points);
							arrowStartRef.current = null;
							if (previewGfxRef.current) { previewGfxRef.current.clear(); }
						}
						event.stopPropagation();
						return;
					}

					if (mode === "ping") {
						overlayClientRef?.current?.sendPing(wp.x, wp.y, color);
						event.stopPropagation();
						return;
					}

					if (mode === "note") {
						const text = window.prompt("输入标注文字");
						if (text) {
							overlayClientRef?.current?.sendNote("create", `${playerIdRef.current}_${Date.now()}`, wp.x, wp.y, text, color);
						}
						event.stopPropagation();
						return;
					}

					event.stopPropagation();
					return;
				}

				if (button === 0) {
					// 左键 -> 点击（选择/设置游标）
					if (!isShipObject(event.target)) {
						dragState.active = true;
						dragState.mode = "click";
						dragState.startX = screen.x;
						dragState.startY = screen.y;
						dragState.lastX = dragState.startX;
						dragState.lastY = dragState.startY;
						dragState.moved = false;
					}
				}
			});

			stage.on("pointermove", (event: any) => {
				const wp2 = getWorldPoint(event);
				if (overlayModeRef.current === "pen" && isDrawingRef.current) {
					strokePointsRef.current.push({ x: wp2.x, y: wp2.y });
					overlayClientRef?.current?.sendDrawStream(strokeIdRef.current, wp2.x, wp2.y, overlayColorRef.current, 3);
				} else if (overlayModeRef.current === "arrow" && arrowStartRef.current && previewGfxRef.current) {
					const g = previewGfxRef.current;
					g.clear();
					const s = arrowStartRef.current;
					const c = parseInt(overlayColorRef.current.replace("#", ""), 16);
					g.moveTo(s.x, s.y);
					g.lineTo(wp2.x, wp2.y);
					g.stroke({ color: c, width: 3, alpha: 0.6 });
				}

				const dragState = dragStateRef.current;
				if (!dragState.active) return;
				const screen = getScreenCoords(event);
				const currentX = screen.x;
				const currentY = screen.y;
				const dx = currentX - dragState.lastX;
				const dy = currentY - dragState.lastY;

				if (
					Math.abs(currentX - dragState.startX) > 3 ||
					Math.abs(currentY - dragState.startY) > 3
				) {
					dragState.moved = true;
				}

				dragState.lastX = currentX;
				dragState.lastY = currentY;
				if (dragState.mode === "rotate") {
					dragState.pendingRotate += dx * 0.25;
				} else if (dragState.mode === "pan") {
					dragState.pendingDx += dx;
					dragState.pendingDy += dy;
				}
				if (dragState.mode === "pan" || dragState.mode === "rotate") {
					flushDragDelta();
				}
			});

			const finishDrag = (event: any) => {
				if (overlayModeRef.current === "pen" && isDrawingRef.current && (event.button ?? 0) === 0) {
					isDrawingRef.current = false;
					overlayClientRef?.current?.sendDrawCommit(strokeIdRef.current, "pen", overlayColorRef.current, 3, strokePointsRef.current);
					strokePointsRef.current = [];
					return;
				}

				const dragState = dragStateRef.current;

				if (
					dragState.active &&
					(dragState.mode === "pan" || dragState.mode === "click") &&
					!dragState.moved &&
					!isShipObject(event.target)
				) {
					const worldPoint = getWorldPoint(event);
					const { viewRotation } = cameraRef.current;
					setMapCursorRef.current?.(worldPoint.x, worldPoint.y, -(viewRotation ?? 0));
					onClickRef.current?.(Math.round(worldPoint.x), Math.round(worldPoint.y));
				}

				dragState.active = false;
				dragState.mode = null;
				dragState.moved = false;
				dragState.pendingDx = 0;
				dragState.pendingDy = 0;
				dragState.pendingRotate = 0;
				stage.cursor = "default";
			};

			stage.on("pointerup", finishDrag);
			stage.on("pointerupoutside", finishDrag);

			stage.on("wheel", (event: any) => {
				const wheelEvent = event.data?.originalEvent as WheelEvent;
				if (wheelEvent) {
					zoomInteraction.queueZoom(wheelEvent);
				}
			});

			const tickerCallback = () => {
				camera.tickZoomAnimation();
			};
			app.ticker.add(tickerCallback);
			tickerCallbackRef.current = tickerCallback;
		},
		[
			canvasSize,
			setLayers,
			dragStateRef,
			flushDragDelta,
			getWorldPoint,
			cameraRef,
			zoomInteraction,
			camera,
		]
	);

	const setLayersRef = useCallback((layers: LayerRegistry) => {
		layersRef.current = layers;
	}, []);

	useEffect(() => {
		const app = pixiAppRef.current;
		const screen = app?.renderer?.screen;
		if (app?.stage && screen && screen.width > 0 && screen.height > 0) {
			app.stage.hitArea = new Rectangle(0, 0, screen.width, screen.height);
		}
	}, [canvasSize.width, canvasSize.height]);

	useEffect(() => {
		return () => {
			const app = pixiAppRef.current;
			if (app) {
				if (tickerCallbackRef.current) {
					app.ticker.remove(tickerCallbackRef.current);
					tickerCallbackRef.current = null;
				}
			}
			previewGfxRef.current?.destroy();
			previewGfxRef.current = null;
		};
	}, []);

	return {
		handleInit,
		pixiAppRef,
		getWorldPoint,
		setLayers: setLayersRef,
	};
}
