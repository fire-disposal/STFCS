/**
 * 交互管理 Hook
 * 统一的交互操作接口，处理画布和 Token 的交互逻辑
 * 
 * 优化内容：
 * - 仅保留中键拖拽画布
 * - 移除空格键等特殊逻辑
 * - 改进平移计算
 * - 添加边界约束
 */

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	setCursor,
	startDrag,
	updateDrag,
	endDrag,
	keyDown,
	hoverToken,
	leaveToken,
	resetInteraction,
	type DragState,
	type InteractionMode,
	type KeyboardState,
	type CursorType,
} from "@/store/slices/interactionSlice";
import { updateCamera } from "@/store/slices/cameraSlice";
import type { CameraState } from "@vt/contracts/types";
import { clampCameraCenter, calculateCameraBounds } from "@/utils/cameraBounds";

export interface UseInteractionReturn {
	// 状态
	mode: InteractionMode;
	cursor: CursorType;
	keyboard: KeyboardState;
	drag: DragState | null;

	// 键盘事件处理
	handleKeyDown: (event: KeyboardEvent) => void;
	handleKeyUp: (event: KeyboardEvent) => void;

	// 鼠标事件处理
	handleTokenHover: () => void;
	handleTokenLeave: () => void;
	handleCanvasHover: () => void;

	// 拖拽控制
	startTokenDrag: (dragState: Omit<DragState, "type">) => void;
	startCanvasPan: (dragState: Omit<DragState, "type">) => void;
	updateDragPosition: (screenX: number, screenY: number) => void;
	endCurrentDrag: () => void;

	// 工具方法
	shouldPanCanvas: () => boolean;
	isTokenDraggable: () => boolean;
}

/**
 * 交互管理 Hook
 * @param camera - 当前相机状态
 * @param mapBounds - 地图边界配置
 * @param callbacks - 回调函数
 */
export function useInteraction(
	camera: CameraState,
	mapBounds?: { width: number; height: number },
	callbacks?: {
		onCanvasPan?: (dx: number, dy: number) => void;
		onTokenDragStart?: (tokenId: string) => void;
		onTokenDrag?: (tokenId: string, newPosition: { x: number; y: number }) => void;
		onTokenDragEnd?: (tokenId: string, finalPosition: { x: number; y: number }, cancelled: boolean) => void;
	}
): UseInteractionReturn {
	const dispatch = useAppDispatch();
	const interaction = useAppSelector((state) => state.interaction);

	// Drag state ref - always has the latest drag state for event handlers
	const dragRef = useRef<DragState | null>(null);

	// Sync drag state to ref
	useEffect(() => {
		dragRef.current = interaction.drag;
	}, [interaction.drag]);

	// 判断是否应该拖动画布 - 仅检查模式，不检查键盘状态
	const shouldPanCanvas = useCallback(() => {
		return interaction.mode === "panCanvas";
	}, [interaction.mode]);

	// 判断 Token 是否可拖动
	const isTokenDraggable = useCallback(() => {
		// 画布拖动模式时不可拖动 Token
		if (shouldPanCanvas()) {
			return false;
		}
		return interaction.mode === "hoverToken" || interaction.mode === "dragToken";
	}, [shouldPanCanvas, interaction.mode]);

	// 处理键盘按下
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			dispatch(keyDown({ key: event.key, pressed: true }));
			// 移除空格键光标更新逻辑 - 仅中键拖拽
		},
		[dispatch]
	);

	// 处理键盘释放
	const handleKeyUp = useCallback(
		(event: KeyboardEvent) => {
			dispatch(keyDown({ key: event.key, pressed: false }));
			// 移除空格键光标更新逻辑 - 仅中键拖拽
		},
		[dispatch]
	);

	// 处理 Token 悬停
	const handleTokenHover = useCallback(() => {
		if (!interaction.drag) {
			dispatch(hoverToken());
		}
	}, [dispatch, interaction.drag]);

	// 处理 Token 离开
	const handleTokenLeave = useCallback(() => {
		dispatch(leaveToken());
	}, [dispatch]);

	// 处理画布悬停
	const handleCanvasHover = useCallback(() => {
		if (interaction.mode === "hoverToken" && !interaction.drag) {
			dispatch(leaveToken());
		}
	}, [dispatch, interaction.mode, interaction.drag]);

	// 开始 Token 拖动
	const startTokenDrag = useCallback(
		(dragState: Omit<DragState, "type">) => {
			dispatch(
				startDrag({
					...dragState,
					type: "token",
				})
			);
			if (callbacks?.onTokenDragStart && dragState.tokenId) {
				callbacks.onTokenDragStart(dragState.tokenId);
			}
		},
		[dispatch, callbacks]
	);

	// 开始画布拖动
	const startCanvasPan = useCallback(
		(dragState: Omit<DragState, "type">) => {
			dispatch(
				startDrag({
					...dragState,
					type: "canvas",
				})
			);
		},
		[dispatch]
	);

	// 更新拖动位置
	const updateDragPosition = useCallback(
		(screenX: number, screenY: number) => {
			const drag = dragRef.current;
			if (!drag) return;

			dispatch(updateDrag({ screenX, screenY }));

			const { startScreen, startCamera, type, tokenId, tokenOriginalPosition } = drag;

			if (type === "canvas") {
				// 画布拖动：计算相机移动
				// 关键修复：使用 startCamera 的 zoom 而不是当前 zoom
				const dx = (screenX - startScreen.x) / startCamera.zoom;
				const dy = (screenY - startScreen.y) / startCamera.zoom;

				let newCenterX = startCamera.centerX - dx;
				let newCenterY = startCamera.centerY - dy;

				// 应用边界约束（允许部分出界，但屏幕中心点不能离开地图）
				if (mapBounds) {
					const bounds = calculateCameraBounds(
						{
							mapWidth: mapBounds.width,
							mapHeight: mapBounds.height,
							minZoom: startCamera.zoom,
							maxZoom: startCamera.zoom,
							outOfBoundsMargin: 0.15, // 15% 允许出界查看
						},
						// 假设标准视口，实际边界在 GameCanvas 中精确计算
						800,
						600
					);
					const clamped = clampCameraCenter(newCenterX, newCenterY, bounds);
					newCenterX = clamped.x;
					newCenterY = clamped.y;
				}

				dispatch(updateCamera({ centerX: newCenterX, centerY: newCenterY }));

				callbacks?.onCanvasPan?.(dx, dy);
			} else if (type === "token" && tokenId && tokenOriginalPosition) {
				// Token 拖动：计算新位置
				const dx = (screenX - startScreen.x) / camera.zoom;
				const dy = (screenY - startScreen.y) / camera.zoom;

				const newPosition = {
					x: tokenOriginalPosition.x + dx,
					y: tokenOriginalPosition.y + dy,
				};

				callbacks?.onTokenDrag?.(tokenId, newPosition);
			}
		},
		[dispatch, camera.zoom, mapBounds, callbacks]
	);

	// 结束当前拖动
	const endCurrentDrag = useCallback(() => {
		const drag = dragRef.current;
		if (!drag) return;

		const { type, tokenId, tokenOriginalPosition } = drag;

		dispatch(endDrag());

		if (type === "token" && tokenId && tokenOriginalPosition && callbacks?.onTokenDragEnd) {
			// 计算移动距离判断是否取消
			// 实际移动距离由 TokenRenderer 计算
			const cancelled = false; // 由调用者判断
			callbacks.onTokenDragEnd(tokenId, tokenOriginalPosition, cancelled);
		}
	}, [dispatch, callbacks]);

	// 全局键盘事件监听
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			// 如果用户在输入框中，不处理空格键
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}
			handleKeyDown(e);
		};

		const handleGlobalKeyUp = (e: KeyboardEvent) => {
			handleKeyUp(e);
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		window.addEventListener("keyup", handleGlobalKeyUp);

		return () => {
			window.removeEventListener("keydown", handleGlobalKeyDown);
			window.removeEventListener("keyup", handleGlobalKeyUp);
		};
	}, [handleKeyDown, handleKeyUp]);

	// 组件卸载时重置
	useEffect(() => {
		return () => {
			dispatch(resetInteraction());
		};
	}, [dispatch]);

	return {
		// 状态
		mode: interaction.mode,
		cursor: interaction.cursor,
		keyboard: interaction.keyboard,
		drag: interaction.drag,

		// 键盘事件处理
		handleKeyDown,
		handleKeyUp,

		// 鼠标事件处理
		handleTokenHover,
		handleTokenLeave,
		handleCanvasHover,

		// 拖拽控制
		startTokenDrag,
		startCanvasPan,
		updateDragPosition,
		endCurrentDrag,

		// 工具方法
		shouldPanCanvas,
		isTokenDraggable,
	};
}
