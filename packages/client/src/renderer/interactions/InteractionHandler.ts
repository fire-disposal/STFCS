/**
 * 交互状态管理 Hook
 *
 * 职责：
 * 1. 管理拖拽状态（平移/旋转/点击模式）
 * 2. 累积拖拽 delta，通过 flushDragDelta 批量提交
 *
 * 拖拽模式：
 * - pan: 平移地图（右键拖拽）
 * - rotate: 旋转地图（Ctrl+右键拖拽，Shift+拖拽）
 * - click: 单击选择舰船/设置游标
 *
 * 与 usePixiApp 协作：
 * - usePixiApp 监听 pointer 事件，更新 dragStateRef
 * - ticker 循环中调用 flushDragDelta 提交累积 delta
 * - onPanDelta/onRotateDelta 回调更新 uiStore 相机状态
 */

import { useRef } from "react";

export interface DragState {
	active: boolean;
	mode: "pan" | "rotate" | "click" | null;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	moved: boolean;
	pendingDx: number;
	pendingDy: number;
	pendingRotate: number;
}

export interface UseInteractionResult {
	dragStateRef: React.MutableRefObject<DragState>;
	flushDragDelta: () => void;
}

export function useInteraction(
	onPanDelta?: (deltaX: number, deltaY: number) => void,
	onRotateDelta?: (delta: number) => void
): UseInteractionResult {
	const onPanDeltaRef = useRef(onPanDelta);
	const onRotateDeltaRef = useRef(onRotateDelta);
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

	onPanDeltaRef.current = onPanDelta;
	onRotateDeltaRef.current = onRotateDelta;

	const flushDragDelta = () => {
		const dragState = dragStateRef.current;
		if (dragState.pendingDx === 0 && dragState.pendingDy === 0 && dragState.pendingRotate === 0) {
			return;
		}

		const deltaX = dragState.pendingDx;
		const deltaY = dragState.pendingDy;
		const rotateDelta = dragState.pendingRotate;
		dragState.pendingDx = 0;
		dragState.pendingDy = 0;
		dragState.pendingRotate = 0;

		if (deltaX !== 0 || deltaY !== 0) {
			onPanDeltaRef.current?.(deltaX, deltaY);
		}
		if (rotateDelta !== 0) {
			onRotateDeltaRef.current?.(rotateDelta);
		}
	};

	return {
		dragStateRef,
		flushDragDelta,
	};
}
