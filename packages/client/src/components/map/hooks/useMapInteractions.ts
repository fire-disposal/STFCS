/**
 * 统一的地图交互 Hook
 *
 * 管理所有地图相关的交互：
 * - 点击选中（单击/双击）
 * - 拖动平移
 * - 滚轮缩放
 * - 空格 + 拖动旋转
 * - 右键游标
 *
 * 使用状态机防止竞态条件
 */

import type { ShipState } from "@vt/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

export interface InteractionState {
	// 当前交互模式
	mode: "IDLE" | "CLICKING" | "DRAGGING" | "ROTATING" | "CONTEXT_MENU";

	// 点击状态
	clickStartTime: number;
	clickPosition: { x: number; y: number };
	clickTimeoutId: number | null;

	// 拖动状态
	isDragging: boolean;
	dragStartX: number;
	dragStartY: number;
	lastDragX: number;
	lastDragY: number;
	dragThreshold: number;

	// 旋转状态
	isRotating: boolean;
	rotationStart: number;

	// 游标状态
	cursorX: number | null;
	cursorY: number | null;
	cursorHeading: number | null;
}

export interface UseMapInteractionsProps {
	ships: ShipState[];
	selectedShipId: string | null;
	onSelectShip: (shipId: string | null) => void;
	onPanDelta: (deltaX: number, deltaY: number) => void;
	onRotateDelta: (delta: number) => void;
	onSetMapCursor: (x: number, y: number, heading: number) => void;
	onClearMapCursor: () => void;
	zoom: number;
	cameraX: number;
	cameraY: number;
	viewRotation: number;
	canvasWidth: number;
	canvasHeight: number;
}

export interface UseMapInteractionsResult {
	handlePointerDown: (e: React.PointerEvent) => void;
	handlePointerMove: (e: React.PointerEvent) => void;
	handlePointerUp: (e: React.PointerEvent) => void;
	handlePointerLeave: (e: React.PointerEvent) => void;
	handleContextMenu: (e: React.MouseEvent) => void;
	handleWheel: (e: WheelEvent) => void;
	interactionState: InteractionState;
	isSpacePressed: boolean;
}

const CLICK_DELAY = 250; // 单击延迟（毫秒）
const DOUBLE_CLICK_DELAY = 300; // 双击时间窗口（毫秒）
const DRAG_THRESHOLD = 5; // 拖动阈值（像素）

export function useMapInteractions(props: UseMapInteractionsProps): UseMapInteractionsResult {
	const {
		ships,
		selectedShipId,
		onSelectShip,
		onPanDelta,
		onRotateDelta,
		onSetMapCursor,
		onClearMapCursor,
		zoom,
		cameraX,
		cameraY,
		viewRotation,
		canvasWidth,
		canvasHeight,
	} = props;

	// 交互状态
	const [interactionState, setInteractionState] = useState<InteractionState>({
		mode: "IDLE",
		clickStartTime: 0,
		clickPosition: { x: 0, y: 0 },
		clickTimeoutId: null,
		isDragging: false,
		dragStartX: 0,
		dragStartY: 0,
		lastDragX: 0,
		lastDragY: 0,
		dragThreshold: DRAG_THRESHOLD,
		isRotating: false,
		rotationStart: 0,
		cursorX: null,
		cursorY: null,
		cursorHeading: null,
	});

	// 空格键状态
	const [isSpacePressed, setIsSpacePressed] = useState(false);

	// 引用（避免闭包问题）
	const stateRef = useRef(interactionState);
	const propsRef = useRef(props);
	const spaceRef = useRef(isSpacePressed);
	const lastClickTimeRef = useRef(0);
	const lastClickShipIdRef = useRef<string | null>(null);

	useEffect(() => {
		stateRef.current = interactionState;
	}, [interactionState]);

	useEffect(() => {
		propsRef.current = props;
	}, [props]);

	useEffect(() => {
		spaceRef.current = isSpacePressed;
	}, [isSpacePressed]);

	// 空格键监听
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				setIsSpacePressed(true);
				e.preventDefault();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				setIsSpacePressed(false);
			}
		};

		const handleBlur = () => {
			setIsSpacePressed(false);
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleBlur);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleBlur);
		};
	}, []);

	// 屏幕坐标转世界坐标（考虑旋转）
	const screenToWorld = useCallback((screenX: number, screenY: number) => {
		const { zoom, cameraX, cameraY, canvasWidth, canvasHeight, viewRotation } = propsRef.current;
		const centerX = canvasWidth / 2;
		const centerY = canvasHeight / 2;
		const relativeX = screenX - centerX;
		const relativeY = screenY - centerY;

		const theta = (viewRotation * Math.PI) / 180;
		const cos = Math.cos(theta);
		const sin = Math.sin(theta);

		const rotatedX = relativeX * cos - relativeY * sin;
		const rotatedY = relativeX * sin + relativeY * cos;

		return {
			worldX: cameraX + rotatedX / zoom,
			worldY: cameraY + rotatedY / zoom,
		};
	}, []);

	// 检查点击是否命中舰船
	const checkShipHit = useCallback((worldX: number, worldY: number): string | null => {
		const { ships } = propsRef.current;
		const clickRadius = 25; // 点击判定半径

		for (const ship of ships) {
			const dx = worldX - ship.transform.x;
			const dy = worldY - ship.transform.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance <= clickRadius) {
				return ship.id;
			}
		}

		return null;
	}, []);

	// 处理单击/双击逻辑
	const handleShipClick = useCallback((shipId: string, isDoubleClick: boolean) => {
		const { onSelectShip, selectedShipId } = propsRef.current;

		if (isDoubleClick) {
			// 双击：选中并聚焦
			onSelectShip(shipId);
			console.log("[Interaction] Double click ship:", shipId);
		} else {
			// 单击：切换选中
			if (shipId === selectedShipId) {
				onSelectShip(null);
			} else {
				onSelectShip(shipId);
			}
		}

		lastClickShipIdRef.current = shipId;
	}, []);

	// 处理指针按下
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			target.setPointerCapture(e.pointerId);

			const screenX = e.clientX;
			const screenY = e.clientY;
			const { worldX, worldY } = screenToWorld(screenX, screenY);

			setInteractionState((prev) => ({
				...prev,
				mode: spaceRef.current ? "ROTATING" : "CLICKING",
				clickStartTime: Date.now(),
				clickPosition: { x: screenX, y: screenY },
				isDragging: false,
				dragStartX: screenX,
				dragStartY: screenY,
				lastDragX: screenX,
				lastDragY: screenY,
				isRotating: spaceRef.current,
				rotationStart: screenX,
			}));
		},
		[screenToWorld]
	);

	// 处理指针移动
	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();

			const state = stateRef.current;
			if (state.mode === "IDLE") return;

			const screenX = e.clientX;
			const screenY = e.clientY;

			// 检查是否开始拖动
			if ((state.mode === "CLICKING" || state.mode === "ROTATING") && !state.isDragging) {
				const dx = screenX - state.dragStartX;
				const dy = screenY - state.dragStartY;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance > state.dragThreshold) {
					setInteractionState((prev) => ({
						...prev,
						isDragging: true,
						lastDragX: screenX,
						lastDragY: screenY,
					}));

					// 清除单击延迟
					if (state.clickTimeoutId !== null) {
						window.clearTimeout(state.clickTimeoutId);
					}
				}
			}

			// 处理拖动
			if (state.isDragging) {
				const dx = screenX - state.lastDragX;
				const dy = screenY - state.lastDragY;

				if (state.isRotating) {
					// 旋转视图
					const rotateDelta = dx * 0.5; // 旋转灵敏度
					if (Math.abs(rotateDelta) > 0.5) {
						propsRef.current.onRotateDelta(rotateDelta);
					}
				} else {
					// 平移视图（使用统一的坐标转换工具）
					const { x: worldDx, y: worldDy } = screenToWorld(dx, dy);
					if (Math.abs(worldDx) > 0.1 || Math.abs(worldDy) > 0.1) {
						propsRef.current.onPanDelta(worldDx, worldDy);
					}
				}

				setInteractionState((prev) => ({
					...prev,
					lastDragX: screenX,
					lastDragY: screenY,
				}));
			}
		},
		[screenToWorld]
	);

	// 处理指针释放
	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			target.releasePointerCapture(e.pointerId);

			const state = stateRef.current;
			const now = Date.now();

			// 如果是拖动，不处理点击
			if (state.isDragging) {
				setInteractionState((prev) => ({
					...prev,
					mode: "IDLE",
					isDragging: false,
					isRotating: false,
				}));
				return;
			}

			// 检查是否点击了舰船
			const { worldX, worldY } = screenToWorld(state.clickPosition.x, state.clickPosition.y);
			const hitShipId = checkShipHit(worldX, worldY);

			// 检查双击
			const isDoubleClick =
				now - lastClickTimeRef.current < DOUBLE_CLICK_DELAY &&
				hitShipId !== null &&
				hitShipId === lastClickShipIdRef.current;

			if (hitShipId) {
				// 点击了舰船
				handleShipClick(hitShipId, isDoubleClick);
			} else {
				// 点击了空白区域
				if (!isDoubleClick) {
					propsRef.current.onSelectShip(null);
				}
			}

			// 更新双击状态
			if (hitShipId) {
				lastClickTimeRef.current = now;
			}

			setInteractionState((prev) => ({
				...prev,
				mode: "IDLE",
				isDragging: false,
				isRotating: false,
			}));
		},
		[screenToWorld, checkShipHit, handleShipClick]
	);

	// 处理指针离开
	const handlePointerLeave = useCallback((e: React.PointerEvent) => {
		e.preventDefault();

		const state = stateRef.current;
		if (state.clickTimeoutId !== null) {
			window.clearTimeout(state.clickTimeoutId);
		}

		setInteractionState((prev) => ({
			...prev,
			mode: "IDLE",
			isDragging: false,
			isRotating: false,
		}));
	}, []);

	// 处理右键菜单（设置游标）
	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();

			const screenX = e.clientX;
			const screenY = e.clientY;
			const { worldX, worldY } = screenToWorld(screenX, screenY);

			// 设置游标，朝向继承摄像机朝向
			onSetMapCursor(worldX, worldY, viewRotation);

			setInteractionState((prev) => ({
				...prev,
				cursorX: worldX,
				cursorY: worldY,
				cursorHeading: viewRotation,
			}));
		},
		[screenToWorld, onSetMapCursor, viewRotation]
	);

	// 处理滚轮缩放
	const handleWheel = useCallback((e: WheelEvent) => {
		e.preventDefault();
		// 滚轮处理在 GameCanvas 中单独处理
	}, []);

	return {
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerLeave,
		handleContextMenu,
		handleWheel,
		interactionState,
		isSpacePressed,
	};
}

export default useMapInteractions;
