/**
 * 统一的地图交互 Hook
 * 整合拖动、旋转、缩放功能，提供稳定的交互体验
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ==================== 类型定义 ====================

export interface CameraState {
	cameraX: number;
	cameraY: number;
	zoom: number;
	viewRotation: number;
}

export interface DragState {
	active: boolean;
	mode: "pan" | "rotate" | null;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	moved: boolean;
	pendingDx: number;
	pendingDy: number;
	pendingRotate: number;
}

export interface ZoomTarget {
	zoom: number;
	cameraX: number;
	cameraY: number;
}

export interface UseMapInteractionOptions {
	/** 画布尺寸 */
	canvasSize: { width: number; height: number };
	/** 最小缩放 */
	minZoom?: number;
	/** 最大缩放 */
	maxZoom?: number;
	/** 旋转灵敏度 */
	rotateSensitivity?: number;
	/** 缩放动画速度 */
	zoomAnimationSpeed?: number;
	/** 拖动力度衰减 */
	dragDecay?: number;
}

export interface UseMapInteractionResult {
	/** 相机状态引用 */
	cameraRef: React.MutableRefObject<CameraState>;
	/** 拖动状态引用 */
	dragStateRef: React.MutableRefObject<DragState>;
	/** 空格键状态引用 */
	spacePressedRef: React.MutableRefObject<boolean>;
	/** 钳制缩放值 */
	clampZoom: (value: number) => number;
	/** 屏幕坐标转世界坐标 */
	screenToWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
	/** 屏幕增量转世界增量 */
	screenDeltaToWorldDelta: (deltaX: number, deltaY: number) => { x: number; y: number };
	/** 处理滚轮缩放 */
	handleWheel: (event: WheelEvent) => void;
	/** 处理指针按下 */
	handlePointerDown: (event: React.PointerEvent) => void;
	/** 处理指针移动 */
	handlePointerMove: (event: React.PointerEvent) => void;
	/** 处理指针释放 */
	handlePointerUp: (event: React.PointerEvent) => void;
	/** 处理指针离开 */
	handlePointerLeave: (event: React.PointerEvent) => void;
	/** 执行缩放动画到目标值 */
	animateZoomToTarget: (target: ZoomTarget) => void;
	/** 取消缩放动画 */
	cancelZoomAnimation: () => void;
	/** 是否是缩放动画中 */
	isZoomAnimating: boolean;
}

// ==================== 常量 ====================

const DEFAULT_OPTIONS: Required<UseMapInteractionOptions> = {
	canvasSize: { width: 800, height: 600 },
	minZoom: 0.5,
	maxZoom: 3,
	rotateSensitivity: 0.3,
	zoomAnimationSpeed: 0.18,
	dragDecay: 0.05,
};

// ==================== 主 Hook ====================

export function useMapInteraction(
	onPanDelta?: (deltaX: number, deltaY: number) => void,
	onRotateDelta?: (delta: number) => void,
	onClick?: (worldX: number, worldY: number) => void,
	options: Partial<UseMapInteractionOptions> = {}
): UseMapInteractionResult {
	// 合并配置
	const config = { ...DEFAULT_OPTIONS, ...options };

	// 状态引用
	const cameraRef = useRef<CameraState>({ cameraX: 0, cameraY: 0, zoom: 1, viewRotation: 0 });
	const dragStateRef = useRef<DragState>({
		active: false,
		mode: null,
		startX: 0,
		startY: 0,
		lastX: 0,
		lastY: 0,
		moved: false,
		pendingDx: 0,
		pendingDy: 0,
		pendingRotate: 0,
	});
	const spacePressedRef = useRef(false);
	const zoomTargetRef = useRef<ZoomTarget | null>(null);
	const zoomAnimationRef = useRef<number | null>(null);
	const clickTimerRef = useRef<number | null>(null);
	const lastClickTimeRef = useRef(0);

	// 动画状态
	const [isZoomAnimating, setIsZoomAnimating] = useState(false);

	// 回调引用（用于避免依赖更新问题）
	const onPanDeltaRef = useRef(onPanDelta);
	const onRotateDeltaRef = useRef(onRotateDelta);
	const onClickRef = useRef(onClick);

	useEffect(() => {
		onPanDeltaRef.current = onPanDelta;
	}, [onPanDelta]);

	useEffect(() => {
		onRotateDeltaRef.current = onRotateDelta;
	}, [onRotateDelta]);

	useEffect(() => {
		onClickRef.current = onClick;
	}, [onClick]);

	// ==================== 工具函数 ====================

	const clampZoom = useCallback(
		(value: number) => {
			return Math.max(config.minZoom, Math.min(config.maxZoom, value));
		},
		[config.minZoom, config.maxZoom]
	);

	const screenToWorldPoint = useCallback(
		(screenX: number, screenY: number) => {
			const { width, height } = config.canvasSize;
			const { zoom, cameraX, cameraY, viewRotation } = cameraRef.current;

			const centerX = width / 2;
			const centerY = height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;

			const theta = (viewRotation * Math.PI) / 180;
			const cos = Math.cos(-theta);
			const sin = Math.sin(-theta);

			const worldDeltaX = (relativeX * cos - relativeY * sin) / zoom;
			const worldDeltaY = (relativeX * sin + relativeY * cos) / zoom;

			return {
				x: cameraX + worldDeltaX,
				y: cameraY + worldDeltaY,
			};
		},
		[config.canvasSize]
	);

	const screenDeltaToWorldDelta = useCallback((deltaX: number, deltaY: number) => {
		const { zoom, viewRotation } = cameraRef.current;
		const theta = (viewRotation * Math.PI) / 180;
		const cos = Math.cos(-theta);
		const sin = Math.sin(-theta);
		const scaledX = -deltaX / zoom;
		const scaledY = -deltaY / zoom;

		return {
			x: scaledX * cos - scaledY * sin,
			y: scaledX * sin + scaledY * cos,
		};
	}, []);

	// ==================== 缩放动画 ====================

	const cancelZoomAnimation = useCallback(() => {
		if (zoomAnimationRef.current !== null) {
			cancelAnimationFrame(zoomAnimationRef.current);
			zoomAnimationRef.current = null;
		}
		setIsZoomAnimating(false);
	}, []);

	const animateZoomToTarget = useCallback(
		(target: ZoomTarget) => {
			cancelZoomAnimation();
			zoomTargetRef.current = target;
			setIsZoomAnimating(true);

			const step = () => {
				const currentTarget = zoomTargetRef.current;
				if (!currentTarget) {
					zoomAnimationRef.current = null;
					setIsZoomAnimating(false);
					return;
				}

				const current = cameraRef.current;
				const zoomDiff = currentTarget.zoom - current.zoom;
				const cameraXDiff = currentTarget.cameraX - current.cameraX;
				const cameraYDiff = currentTarget.cameraY - current.cameraY;

				// 检查是否到达目标
				if (
					Math.abs(zoomDiff) < 0.001 &&
					Math.abs(cameraXDiff) < 0.05 &&
					Math.abs(cameraYDiff) < 0.05
				) {
					onPanDeltaRef.current?.(cameraXDiff, cameraYDiff);
					zoomTargetRef.current = null;
					zoomAnimationRef.current = null;
					setIsZoomAnimating(false);
					return;
				}

				// 平滑插值
				const t = config.zoomAnimationSpeed;
				const nextZoom = clampZoom(current.zoom + zoomDiff * t);
				const nextCameraX = current.cameraX + cameraXDiff * t;
				const nextCameraY = current.cameraY + cameraYDiff * t;

				// 应用变化
				const dCameraX = nextCameraX - current.cameraX;
				const dCameraY = nextCameraY - current.cameraY;
				onPanDeltaRef.current?.(dCameraX, dCameraY);
				zoomTargetRef.current = { zoom: nextZoom, cameraX: nextCameraX, cameraY: nextCameraY };

				zoomAnimationRef.current = requestAnimationFrame(step);
			};

			zoomAnimationRef.current = requestAnimationFrame(step);
		},
		[clampZoom, cancelZoomAnimation, config.zoomAnimationSpeed]
	);

	// ==================== 滚轮缩放 ====================

	const handleWheel = useCallback(
		(event: WheelEvent) => {
			event.preventDefault();

			const rect = (event.target as HTMLElement)?.getBoundingClientRect();
			if (!rect) return;

			const screenX = event.clientX - rect.left;
			const screenY = event.clientY - rect.top;

			// 计算缩放因子
			const wheelStrength = event.deltaMode === 1 ? 0.09 : event.deltaMode === 2 ? 0.18 : 0.0016;
			const zoomFactor = Math.exp(-event.deltaY * wheelStrength);

			const current = cameraRef.current;
			const nextZoom = clampZoom(current.zoom * zoomFactor);

			// 计算鼠标位置对应的世界坐标
			const worldPoint = screenToWorldPoint(screenX, screenY);

			// 计算新的相机位置以保持鼠标位置不变
			const centerX = config.canvasSize.width / 2;
			const centerY = config.canvasSize.height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;

			const theta = (current.viewRotation * Math.PI) / 180;
			const cos = Math.cos(-theta);
			const sin = Math.sin(-theta);

			const newWorldDeltaX = (relativeX * cos - relativeY * sin) / nextZoom;
			const newWorldDeltaY = (relativeX * sin + relativeY * cos) / nextZoom;

			const target: ZoomTarget = {
				zoom: nextZoom,
				cameraX: worldPoint.x - newWorldDeltaX,
				cameraY: worldPoint.y - newWorldDeltaY,
			};

			animateZoomToTarget(target);
		},
		[animateZoomToTarget, clampZoom, screenToWorldPoint, config.canvasSize]
	);

	// ==================== 指针事件处理 ====================

	const handlePointerDown = useCallback((event: React.PointerEvent) => {
		const dragState = dragStateRef.current;
		const spacePressed = spacePressedRef.current;

		// 记录点击时间用于判断是否是点击而非拖动
		clickTimerRef.current = window.setTimeout(() => {
			clickTimerRef.current = null;
		}, 200);

		dragState.active = true;
		dragState.mode = spacePressed ? "pan" : null;
		dragState.startX = event.clientX;
		dragState.startY = event.clientY;
		dragState.lastX = event.clientX;
		dragState.lastY = event.clientY;
		dragState.moved = false;
		dragState.pendingDx = 0;
		dragState.pendingDy = 0;
		dragState.pendingRotate = 0;

		(event.target as Element).setPointerCapture(event.pointerId);
	}, []);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent) => {
			const dragState = dragStateRef.current;
			if (!dragState.active) return;

			const dx = event.clientX - dragState.lastX;
			const dy = event.clientY - dragState.lastY;

			// 检测是否开始拖动
			if (!dragState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
				dragState.moved = true;
				if (clickTimerRef.current !== null) {
					window.clearTimeout(clickTimerRef.current);
					clickTimerRef.current = null;
				}
			}

			// 根据模式处理
			if (dragState.mode === "pan") {
				dragState.pendingDx += dx;
				dragState.pendingDy += dy;

				// 应用拖动力度衰减
				const decay = Math.max(0, 1 - config.dragDecay);
				dragState.pendingDx *= decay;
				dragState.pendingDy *= decay;

				const worldDelta = screenDeltaToWorldDelta(dragState.pendingDx, dragState.pendingDy);
				onPanDeltaRef.current?.(worldDelta.x, worldDelta.y);

				dragState.pendingDx = 0;
				dragState.pendingDy = 0;
			} else if (dragState.mode === "rotate") {
				const centerX = dragState.startX;
				const centerY = dragState.startY;
				const prevAngle = Math.atan2(dragState.lastY - centerY, dragState.lastX - centerX);
				const currAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
				const deltaAngle = ((currAngle - prevAngle) * 180) / Math.PI;

				if (Math.abs(deltaAngle) > config.rotateSensitivity) {
					onRotateDeltaRef.current?.(deltaAngle);
				}
			}

			dragState.lastX = event.clientX;
			dragState.lastY = event.clientY;
		},
		[screenDeltaToWorldDelta, config.rotateSensitivity, config.dragDecay]
	);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent) => {
			const dragState = dragStateRef.current;
			if (!dragState.active) return;

			(event.target as Element).releasePointerCapture(event.pointerId);

			// 如果是点击而非拖动，触发点击事件
			if (!dragState.moved && clickTimerRef.current !== null) {
				window.clearTimeout(clickTimerRef.current);
				clickTimerRef.current = null;

				const now = Date.now();
				if (now - lastClickTimeRef.current < 300) {
					// 双击
					lastClickTimeRef.current = 0;
				} else {
					// 单击
					lastClickTimeRef.current = now;
					const worldPos = screenToWorldPoint(event.clientX, event.clientY);
					onClickRef.current?.(worldPos.x, worldPos.y);
				}
			}

			dragState.active = false;
			dragState.mode = null;
			dragState.pendingDx = 0;
			dragState.pendingDy = 0;
			dragState.pendingRotate = 0;
		},
		[screenToWorldPoint]
	);

	const handlePointerLeave = useCallback(
		(event: React.PointerEvent) => {
			const dragState = dragStateRef.current;
			if (dragState.active) {
				handlePointerUp(event as unknown as React.PointerEvent);
			}
		},
		[handlePointerUp]
	);

	// ==================== 键盘事件 ====================

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space" && !event.repeat) {
				spacePressedRef.current = true;
				event.preventDefault();
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") {
				spacePressedRef.current = false;
			}
		};

		const handleBlur = () => {
			spacePressedRef.current = false;
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

	// ==================== 清理 ====================

	useEffect(() => {
		return () => {
			cancelZoomAnimation();
			if (clickTimerRef.current !== null) {
				window.clearTimeout(clickTimerRef.current);
			}
		};
	}, [cancelZoomAnimation]);

	// ==================== 返回结果 ====================

	return {
		cameraRef,
		dragStateRef,
		spacePressedRef,
		clampZoom,
		screenToWorldPoint,
		screenDeltaToWorldDelta,
		handleWheel,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerLeave,
		animateZoomToTarget,
		cancelZoomAnimation,
		isZoomAnimating,
	};
}
