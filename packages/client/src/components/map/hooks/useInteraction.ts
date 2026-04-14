import { useRef } from "react";

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

export interface UseInteractionResult {
	spacePressedRef: React.MutableRefObject<boolean>;
	dragStateRef: React.MutableRefObject<DragState>;
	flushDragDelta: () => void;
}

export function useInteraction(
	onPanDelta?: (deltaX: number, deltaY: number) => void,
	onRotateDelta?: (delta: number) => void,
	screenDeltaToWorldDelta?: (deltaX: number, deltaY: number) => { x: number; y: number }
): UseInteractionResult {
	const spacePressedRef = useRef(false);
	const onPanDeltaRef = useRef(onPanDelta);
	const onRotateDeltaRef = useRef(onRotateDelta);
	const screenDeltaToWorldDeltaRef = useRef(screenDeltaToWorldDelta);
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
	screenDeltaToWorldDeltaRef.current = screenDeltaToWorldDelta;

	const flushDragDelta = () => {
		const dragState = dragStateRef.current;
		if (dragState.pendingDx === 0 && dragState.pendingDy === 0 && dragState.pendingRotate === 0) {
			return;
		}

		const delta = screenDeltaToWorldDeltaRef.current?.(dragState.pendingDx, dragState.pendingDy);
		const rotateDelta = dragState.pendingRotate;
		dragState.pendingDx = 0;
		dragState.pendingDy = 0;
		dragState.pendingRotate = 0;

		if (delta && (delta.x !== 0 || delta.y !== 0)) {
			onPanDeltaRef.current?.(delta.x, delta.y);
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