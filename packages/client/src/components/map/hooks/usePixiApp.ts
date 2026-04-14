import { screenToWorld } from "@/utils/mathUtils";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";
import type { CameraState } from "./useCamera";
import type { CanvasSize } from "./useCanvasResize";
import type { DragState } from "./useInteraction";
import type { LayerRegistry } from "./useLayerSystem";
import type { UseZoomInteractionResult } from "./useZoomInteraction";

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
	const tickerRef = useRef<any>(null);

	onClickRef.current = onClick;
	setMapCursorRef.current = setMapCursor;

	const getWorldPoint = useCallback(
		(event: any) => {
			const screenX = event.global?.x ?? event.clientX ?? 0;
			const screenY = event.global?.y ?? event.clientY ?? 0;
			const { zoom, cameraX, cameraY, viewRotation } = cameraRef.current;
			return screenToWorld(
				screenX - canvasSize.width / 2,
				screenY - canvasSize.height / 2,
				zoom,
				cameraX,
				cameraY,
				viewRotation
			);
		},
		[canvasSize.width, canvasSize.height, cameraRef]
	);

	const handleInit = useCallback(
		(app: any) => {
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

			const shipsLayer = new Container();
			shipsLayer.zIndex = 6;
			shipsLayer.eventMode = "static";
			shipsLayer.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

			const labels = new Container();
			labels.zIndex = 7;
			labels.eventMode = "none";

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

			world.addChild(
				background,
				starfieldNebula,
				starfieldDeep,
				starfieldMid,
				starfieldNear,
				grid,
				cursorLayer,
				shipsLayer,
				labels,
				effects,
				weaponArcsLayer,
				movementVisualsLayer,
				shipIconsLayer
			);
			app.stage.addChild(world);

			const newLayers: LayerRegistry = {
				world,
				background,
				starfieldNebula,
				starfieldDeep,
				starfieldMid,
				starfieldNear,
				grid,
				cursor: cursorLayer,
				ships: shipsLayer,
				labels,
				effects,
				weaponArcs: weaponArcsLayer,
				movementVisuals: movementVisualsLayer,
				shipIcons: shipIconsLayer,
			};

			layersRef.current = newLayers;
			setLayers?.(newLayers);

			pixiAppRef.current = app;
			app.stage.eventMode = "static";
			app.stage.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
			app.stage.cursor = "default";

			const stage = app.stage;

			stage.on("pointerdown", (event: any) => {
				const button = event.button ?? event.data?.button ?? 0;
				const dragState = dragStateRef.current;

				if (button === 2) {
					event.preventDefault();
					return;
				}

				if (button === 1) {
					dragState.active = true;
					dragState.mode = "rotate";
					dragState.startX = event.global?.x ?? event.clientX ?? 0;
					dragState.startY = event.global?.y ?? event.clientY ?? 0;
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
						dragState.startX = event.global?.x ?? event.clientX ?? 0;
						dragState.startY = event.global?.y ?? event.clientY ?? 0;
						dragState.lastX = dragState.startX;
						dragState.lastY = dragState.startY;
						dragState.moved = false;
						stage.cursor = "grabbing";
					} else if (event.target === stage || event.target === world) {
						dragState.active = true;
						dragState.mode = "pan";
						dragState.startX = event.global?.x ?? event.clientX ?? 0;
						dragState.startY = event.global?.y ?? event.clientY ?? 0;
						dragState.lastX = dragState.startX;
						dragState.lastY = dragState.startY;
						dragState.moved = false;
						stage.cursor = "grabbing";
					}
				}
			});

			stage.on("pointermove", (event: any) => {
				const dragState = dragStateRef.current;
				if (!dragState.active) return;

				const currentX = event.global?.x ?? event.clientX ?? dragState.lastX;
				const currentY = event.global?.y ?? event.clientY ?? dragState.lastY;
				const dx = currentX - dragState.lastX;
				const dy = currentY - dragState.lastY;

				if (Math.abs(currentX - dragState.startX) > 3 || Math.abs(currentY - dragState.startY) > 3) {
					dragState.moved = true;
				}

				dragState.lastX = currentX;
				dragState.lastY = currentY;
				if (dragState.mode === "rotate") {
					dragState.pendingRotate += dx * 0.25;
				} else {
					dragState.pendingDx += dx;
					dragState.pendingDy += dy;
				}
				flushDragDelta();
			});

			const finishDrag = (event: any) => {
				const dragState = dragStateRef.current;

				if (dragState.active && dragState.mode === "pan" && !dragState.moved && event.target === stage || event.target === world) {
					const worldPoint = getWorldPoint(event);
					const { viewRotation } = cameraRef.current;
					setMapCursorRef.current?.(worldPoint.x, worldPoint.y, viewRotation);
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

			const ticker = app.ticker;
			ticker.add(() => {
				camera.tickZoomAnimation();
			});
			tickerRef.current = ticker;

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
		if (app?.stage && canvasSize.width > 0 && canvasSize.height > 0) {
			app.stage.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
		}
	}, [canvasSize.width, canvasSize.height]);

	useEffect(() => {
		return () => {
			const app = pixiAppRef.current;
			if (app) {
				if (tickerRef.current) {
					tickerRef.current.destroy();
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