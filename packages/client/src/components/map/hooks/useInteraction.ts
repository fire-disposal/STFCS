import { useCallback, useEffect, useRef } from "react";

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
	rafId: number | null;
}

export interface UseInteractionResult {
	spacePressedRef: React.MutableRefObject<boolean>;
	dragStateRef: React.MutableRefObject<DragState>;
	flushDragDelta: () => void;
	scheduleDragFlush: () => void;
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
		rafId: null,
	});

	useEffect(() => {
		onPanDeltaRef.current = onPanDelta;
	}, [onPanDelta]);

	useEffect(() => {
		onRotateDeltaRef.current = onRotateDelta;
	}, [onRotateDelta]);

	useEffect(() => {
		screenDeltaToWorldDeltaRef.current = screenDeltaToWorldDelta;
	}, [screenDeltaToWorldDelta]);

	const flushDragDelta = useCallback(() => {
		const dragState = dragStateRef.current;
		if (dragState.rafId !== null) {
			cancelAnimationFrame(dragState.rafId);
			dragState.rafId = null;
		}

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
	}, [dragStateRef]);

	const scheduleDragFlush = useCallback(() => {
		const dragState = dragStateRef.current;
		if (dragState.rafId !== null) {
			return;
		}

		dragState.rafId = requestAnimationFrame(() => {
			dragState.rafId = null;
			flushDragDelta();
		});
	}, [flushDragDelta, dragStateRef]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space") {
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

	return {
		spacePressedRef,
		dragStateRef,
		flushDragDelta,
		scheduleDragFlush,
	};
}
