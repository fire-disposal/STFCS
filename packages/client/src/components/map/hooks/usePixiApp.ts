import { screenToWorld } from "@/utils/mathUtils";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";
import type { CameraState } from "./useCamera";
import type { CanvasSize } from "./useCanvasResize";
import type { DragState } from "./useInteraction";
import type { LayerRegistry } from "./useLayerSystem";

export interface UsePixiAppResult {
	handleInit: (app: any) => void;
	pixiAppRef: React.MutableRefObject<any>;
	getWorldPoint: (
		event: any,
		cameraState: CameraState,
		canvasSize: CanvasSize
	) => { x: number; y: number };
	setLayers: (layers: LayerRegistry) => void;
}

export interface UsePixiAppOptions {
	canvasSize: CanvasSize;
	cameraRef: React.MutableRefObject<CameraState>;
	dragStateRef: React.MutableRefObject<DragState>;
	spacePressedRef: React.MutableRefObject<boolean>;
	flushDragDelta: () => void;
	scheduleDragFlush: () => void;
	onClick?: (x: number, y: number) => void;
	setLayers?: (layers: LayerRegistry) => void;
	setMapCursor?: (x: number, y: number, heading: number) => void;
}

export function usePixiApp(options: UsePixiAppOptions): UsePixiAppResult {
	const {
		canvasSize,
		cameraRef,
		dragStateRef,
		spacePressedRef,
		flushDragDelta,
		scheduleDragFlush,
		onClick,
		setLayers,
		setMapCursor,
	} = options;

	const pixiAppRef = useRef<any>(null);
	const layersRef = useRef<LayerRegistry | null>(null);

	const getWorldPoint = useCallback(
		(event: any, cameraState: CameraState, canvasSize: CanvasSize) => {
			const screenX = typeof event.global?.x === "number" ? event.global.x : event.clientX;
			const screenY = typeof event.global?.y === "number" ? event.global.y : event.clientY;
			return screenToWorld(
				screenX - canvasSize.width / 2,
				screenY - canvasSize.height / 2,
				cameraState.zoom,
				cameraState.cameraX,
				cameraState.cameraY,
				cameraState.viewRotation
			);
		},
		[]
	);

	const handleInit = useCallback(
		(app: any) => {
			const world = new Container();
			world.sortableChildren = true;
			world.eventMode = "static";
			world.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);

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
			cursorLayer.zIndex = 4; // 与网格同层，但在网格之后绘制
			cursorLayer.eventMode = "none";
			// 游标层添加到 world 内，自动继承相机变换

			const shipsLayer = new Container();
			shipsLayer.zIndex = 5;
			shipsLayer.eventMode = "static";
			shipsLayer.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);

			const labels = new Container();
			labels.zIndex = 6;
			labels.eventMode = "none";

			const effects = new Container();
			effects.zIndex = 7;
			effects.eventMode = "none";

			const weaponArcsLayer = new Container();
			weaponArcsLayer.zIndex = 8;
			weaponArcsLayer.eventMode = "none";

			const movementVisualsLayer = new Container();
			movementVisualsLayer.zIndex = 9;
			movementVisualsLayer.eventMode = "none";

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
				movementVisualsLayer
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
			};

			layersRef.current = newLayers;
			setLayers?.(newLayers);

			pixiAppRef.current = app;
			app.stage.eventMode = "static";
			app.stage.hitArea = new Rectangle(
				-canvasSize.width * 2,
				-canvasSize.height * 2,
				canvasSize.width * 4,
				canvasSize.height * 4
			);
			app.stage.cursor = "grab";

			// 清理旧的事件监听器
			const stage = app.stage;
			stage.off("pointerdown");
			stage.off("pointermove");
			stage.off("pointerup");
			stage.off("pointerupoutside");

			// 绑定统一的事件监听器
			stage.on("pointerdown", (event: any) => {
				const target = event.target;
				const button = event.button ?? event.data?.button ?? 0;
				const dragState = dragStateRef.current;

				// 右键 - 设置游标
				if (button === 2) {
					event.preventDefault();
					if (setMapCursor) {
						const worldPoint = getWorldPoint(event, cameraRef.current, canvasSize);
						setMapCursor(worldPoint.x, worldPoint.y, cameraRef.current.viewRotation);
					}
					return;
				}

				// 中键 - 旋转视图
				if (button === 1) {
					dragState.active = true;
					dragState.mode = "rotate";
					dragState.startX = event.global?.x ?? event.clientX ?? 0;
					dragState.startY = event.global?.y ?? event.clientY ?? 0;
					dragState.lastX = dragState.startX;
					dragState.lastY = dragState.lastY;
					dragState.moved = false;
					app.stage.cursor = "grabbing";
					return;
				}

				// 左键 - 平移或点击空白
				if (button === 0) {
					if (!spacePressedRef.current && target !== app.stage) {
						return;
					}

					dragState.active = true;
					dragState.mode = "pan";
					dragState.startX = event.global?.x ?? event.clientX ?? 0;
					dragState.startY = event.global?.y ?? event.clientY ?? 0;
					dragState.lastX = dragState.startX;
					dragState.lastY = dragState.startY;
					dragState.moved = false;
					app.stage.cursor = "grabbing";
				}
			});

			stage.on("pointermove", (event: any) => {
				const dragState = dragStateRef.current;
				if (!dragState.active) {
					return;
				}

				const currentX = event.global?.x ?? event.clientX ?? dragState.lastX;
				const currentY = event.global?.y ?? event.clientY ?? dragState.lastY;
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
				} else {
					dragState.pendingDx += dx;
					dragState.pendingDy += dy;
				}
				scheduleDragFlush();
			});

			const finishDrag = (event: any) => {
				const dragState = dragStateRef.current;

				if (dragState.active && dragState.mode === "pan" && !dragState.moved) {
					const worldPoint = getWorldPoint(event, cameraRef.current, canvasSize);
					onClick?.(Math.round(worldPoint.x), Math.round(worldPoint.y));
				}

				dragState.active = false;
				dragState.mode = null;
				dragState.moved = false;
				dragState.pendingDx = 0;
				dragState.pendingDy = 0;
				dragState.pendingRotate = 0;
				flushDragDelta();
				app.stage.cursor = spacePressedRef.current ? "grab" : "default";
			};

			stage.on("pointerup", finishDrag);
			stage.on("pointerupoutside", finishDrag);
		},
		[
			canvasSize,
			setLayers,
			dragStateRef,
			spacePressedRef,
			scheduleDragFlush,
			getWorldPoint,
			cameraRef,
			onClick,
			flushDragDelta,
			setMapCursor,
		]
	);

	const setLayersRef = useCallback((layers: LayerRegistry) => {
		layersRef.current = layers;
	}, []);

	// 更新 hitArea 以覆盖整个画布
	useEffect(() => {
		const app = pixiAppRef.current;
		if (app?.stage && canvasSize.width > 0 && canvasSize.height > 0) {
			app.stage.hitArea = new Rectangle(0, 0, canvasSize.width, canvasSize.height);
		}
	}, [canvasSize.width, canvasSize.height]);

	return {
		handleInit,
		pixiAppRef,
		getWorldPoint,
		setLayers: setLayersRef,
	};
}
