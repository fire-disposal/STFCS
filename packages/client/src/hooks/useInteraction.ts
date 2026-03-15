/**
 * 交互管理 Hook
 * 统一的交互操作接口，处理画布和 Token 的交互逻辑
 */

import { useCallback, useEffect } from "react";
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
import type { CameraState } from "@vt/shared/types";

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
 * @param onCanvasPan - 画布拖动回调
 * @param onTokenDragStart - Token 拖动开始回调
 * @param onTokenDrag - Token 拖动中回调
 * @param onTokenDragEnd - Token 拖动结束回调
 */
export function useInteraction(
	camera: CameraState,
	callbacks?: {
		onCanvasPan?: (dx: number, dy: number) => void;
		onTokenDragStart?: (tokenId: string) => void;
		onTokenDrag?: (tokenId: string, newPosition: { x: number; y: number }) => void;
		onTokenDragEnd?: (tokenId: string, finalPosition: { x: number; y: number }, cancelled: boolean) => void;
	}
): UseInteractionReturn {
	const dispatch = useAppDispatch();
	const interaction = useAppSelector((state) => state.interaction);

	// 判断是否应该拖动画布
	const shouldPanCanvas = useCallback(() => {
		return (
			interaction.keyboard.isSpacePressed ||
			interaction.keyboard.isCtrlPressed ||
			interaction.mode === "panCanvas"
		);
	}, [interaction.keyboard.isSpacePressed, interaction.keyboard.isCtrlPressed, interaction.mode]);

	// 判断 Token 是否可拖动
	const isTokenDraggable = useCallback(() => {
		// 如果按下空格或 Ctrl，优先拖动画布
		if (shouldPanCanvas()) {
			return false;
		}
		return interaction.mode === "hoverToken" || interaction.mode === "dragToken";
	}, [shouldPanCanvas, interaction.mode]);

	// 处理键盘按下
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			dispatch(keyDown({ key: event.key, pressed: true }));

			// 如果按下空格且当前没有拖动，切换到画布拖动准备状态
			if (event.key === " " && interaction.mode === "idle") {
				dispatch(setCursor("grab"));
			}
		},
		[dispatch, interaction.mode]
	);

	// 处理键盘释放
	const handleKeyUp = useCallback(
		(event: KeyboardEvent) => {
			dispatch(keyDown({ key: event.key, pressed: false }));

			// 如果释放空格且当前没有拖动，恢复默认光标
			if (event.key === " " && interaction.mode === "idle") {
				dispatch(setCursor("default"));
			}
		},
		[dispatch, interaction.mode]
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
			if (!interaction.drag) return;

			dispatch(updateDrag({ screenX, screenY }));

			const { startScreen, startCamera, type, tokenId, tokenOriginalPosition } = interaction.drag;

			if (type === "canvas") {
				// 画布拖动：计算相机移动
				// 关键修复：使用 startCamera 的 zoom 而不是当前 zoom
				const dx = (screenX - startScreen.x) / startCamera.zoom;
				const dy = (screenY - startScreen.y) / startCamera.zoom;

				const newCenterX = startCamera.centerX - dx;
				const newCenterY = startCamera.centerY - dy;

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
		[dispatch, interaction.drag, camera.zoom, callbacks]
	);

	// 结束当前拖动
	const endCurrentDrag = useCallback(() => {
		if (!interaction.drag) return;

		const { type, tokenId, tokenOriginalPosition } = interaction.drag;

		dispatch(endDrag());

		if (type === "token" && tokenId && tokenOriginalPosition && callbacks?.onTokenDragEnd) {
			// 计算移动距离判断是否取消
			// 实际移动距离由 TokenRenderer 计算
			const cancelled = false; // 由调用者判断
			callbacks.onTokenDragEnd(tokenId, tokenOriginalPosition, cancelled);
		}
	}, [dispatch, interaction.drag, callbacks]);

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
