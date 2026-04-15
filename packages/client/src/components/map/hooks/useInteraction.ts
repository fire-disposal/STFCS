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
	spacePressedRef: React.MutableRefObject<boolean>;
	dragStateRef: React.MutableRefObject<DragState>;
	flushDragDelta: () => void;
}

export function useInteraction(
	onPanDelta?: (deltaX: number, deltaY: number) => void,
	onRotateDelta?: (delta: number) => void
): UseInteractionResult {
	const spacePressedRef = useRef(false);
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
		spacePressedRef,
		dragStateRef,
		flushDragDelta,
	};
}