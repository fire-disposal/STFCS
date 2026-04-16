import { screenToWorld } from "@/utils/coordinateSystem";
import { Container, Point, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";
import type { CameraState } from "@/sync/types";
import type { CanvasSize } from "./useCanvasResize";
import type { DragState } from "../interactions/InteractionHandler";
import type { LayerRegistry } from "./useLayerSystem";
import type { UseZoomInteractionResult } from "../interactions/ZoomHandler";

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
	spacePressedRef: React.MutableRefObject<boolean>;
	flushDragDelta: () => void;
	zoomInteraction: UseZoomInteractionResult;
	camera: { tickZoomAnimation: () => void };
	onClick?: (x: number, y: number) => void;
	setLayers?: (layers: LayerRegistry) => void;
	setMapCursor?: (x: number, y: number, r: number) => void;
}

export function usePixiApp(options: UsePixiAppOptions): UsePixiAppResult {
	const {
		canvasSize,
		cameraRef,
		dragStateRef,
		spacePressedRef,
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

			const grid = new Container();
			grid.zIndex = 4;
			grid.eventMode = "none";

			const cursorLayer = new Container();
			cursorLayer.zIndex = 5;
			cursorLayer.eventMode = "none";
			cursorLayer.sortableChildren = true;

			const shipSpritesLayer = new Container();
			shipSpritesLayer.zIndex = 6;
			shipSpritesLayer.eventMode = "none";

			const tacticalTokensLayer = new Container();
			tacticalTokensLayer.zIndex = 7;
			tacticalTokensLayer.eventMode = "static";
			tacticalTokensLayer.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

			const effects = new Container();
			effects.zIndex = 8;
			effects.eventMode = "none";

			const weaponArcsLayer = new Container();
			weaponArcsLayer.zIndex = 9;
			weaponArcsLayer.eventMode = "none";

			const movementVisualsLayer = new Container();
			movementVisualsLayer.zIndex = 10;
			movementVisualsLayer.eventMode = "none";

			const shipIconsLayer = new Container();
			shipIconsLayer.zIndex = 11;
			shipIconsLayer.eventMode = "none";

			const hexagonArmorLayer = new Container();
			hexagonArmorLayer.zIndex = 12;
			hexagonArmorLayer.eventMode = "none";

			world.addChild(
				background,
				starfieldNebula,
				starfieldDeep,
				starfieldMid,
				starfieldNear,
				grid,
				cursorLayer,
				shipSpritesLayer,
				tacticalTokensLayer,
				effects,
				weaponArcsLayer,
				movementVisualsLayer,
				shipIconsLayer,
				hexagonArmorLayer
			);

			// === HUD 层（独立于世界，固定像素大小） ===
			const hud = new Container();
			hud.eventMode = "none";
			hud.sortableChildren = true;

			const shipBarsLayer = new Container();
			shipBarsLayer.zIndex = 0;
			shipBarsLayer.eventMode = "none";

			const shipNamesLayer = new Container();
			shipNamesLayer.zIndex = 1;
			shipNamesLayer.eventMode = "none";

			const targetMarkersLayer = new Container();
			targetMarkersLayer.zIndex = 2;
			targetMarkersLayer.eventMode = "none";

			hud.addChild(shipBarsLayer, shipNamesLayer, targetMarkersLayer);

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
				shipSprites: shipSpritesLayer,
				tacticalTokens: tacticalTokensLayer,
				effects,
				weaponArcs: weaponArcsLayer,
				movementVisuals: movementVisualsLayer,
				shipIcons: shipIconsLayer,
				hexagonArmor: hexagonArmorLayer,
				// HUD 层
				hud,
				shipBars: shipBarsLayer,
				shipNames: shipNamesLayer,
				targetMarkers: targetMarkersLayer,
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

				if (button === 2) {
					event.preventDefault();
					return;
				}

				if (button === 1) {
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

				if (button === 0) {
					if (spacePressedRef.current) {
						dragState.active = true;
						dragState.mode = "pan";
						dragState.startX = screen.x;
						dragState.startY = screen.y;
						dragState.lastX = dragState.startX;
						dragState.lastY = dragState.startY;
						dragState.moved = false;
						stage.cursor = "grabbing";
					} else if (!isShipObject(event.target)) {
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
				stage.cursor = spacePressedRef.current ? "grab" : "default";
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

			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.code === "Space" && !e.repeat) {
					spacePressedRef.current = true;
					stage.cursor = "grab";
					e.preventDefault();
				}
			};

			const handleKeyUp = (e: KeyboardEvent) => {
				if (e.code === "Space") {
					spacePressedRef.current = false;
					stage.cursor = dragStateRef.current.active ? "grabbing" : "default";
				}
			};

			const handleBlur = () => {
				spacePressedRef.current = false;
				stage.cursor = "default";
			};

			window.addEventListener("keydown", handleKeyDown);
			window.addEventListener("keyup", handleKeyUp);
			window.addEventListener("blur", handleBlur);

			const cleanupKeyListeners = () => {
				window.removeEventListener("keydown", handleKeyDown);
				window.removeEventListener("keyup", handleKeyUp);
				window.removeEventListener("blur", handleBlur);
			};

			(app as any).__cleanupKeyListeners = cleanupKeyListeners;
		},
		[
			canvasSize,
			setLayers,
			dragStateRef,
			spacePressedRef,
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
				if ((app as any).__cleanupKeyListeners) {
					(app as any).__cleanupKeyListeners();
				}
			}
		};
	}, []);

	return {
		handleInit,
		pixiAppRef,
		getWorldPoint,
		setLayers: setLayersRef,
	};
}
