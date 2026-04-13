import { useCallback, useEffect, useRef } from "react";
import type { UseCameraResult } from "./useCamera";
import type { CanvasSize } from "./useCanvasResize";

export interface UseZoomInteractionResult {
	queueZoom: (event: WheelEvent) => void;
}

export function useZoomInteraction(
	camera: UseCameraResult,
	canvasSize: CanvasSize,
	setZoom: (zoom: number) => void,
	setCameraPosition: (x: number, y: number) => void
): UseZoomInteractionResult {
	const {
		clampZoom,
		screenToWorldPoint,
		cameraRef,
		animateZoomToTarget,
		zoomTargetRef,
		zoomAnimationRef,
	} = camera;

	const queueZoom = useCallback(
		(event: WheelEvent) => {
			event.preventDefault();

			const hostRef = document.getElementById("game-canvas-host");
			const rect = hostRef?.getBoundingClientRect();
			if (!rect) return;

			const screenX = event.clientX - rect.left;
			const screenY = event.clientY - rect.top;
			const wheelStrength = event.deltaMode === 1 ? 0.09 : event.deltaMode === 2 ? 0.18 : 0.0016;
			const zoomFactor = Math.exp(-event.deltaY * wheelStrength);
			const current = cameraRef.current;
			const nextZoom = clampZoom(current.zoom * zoomFactor);
			const worldPoint = screenToWorldPoint(
				screenX,
				screenY,
				current.zoom,
				current.cameraX,
				current.cameraY,
				current.viewRotation
			);

			const centerX = canvasSize.width / 2;
			const centerY = canvasSize.height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;
			const theta = (current.viewRotation * Math.PI) / 180;
			const cos = Math.cos(-theta);
			const sin = Math.sin(-theta);
			const newWorldDeltaX = (relativeX * cos - relativeY * sin) / nextZoom;
			const newWorldDeltaY = (relativeX * sin + relativeY * cos) / nextZoom;

			zoomTargetRef.current = {
				zoom: nextZoom,
				cameraX: worldPoint.x - newWorldDeltaX,
				cameraY: worldPoint.y - newWorldDeltaY,
			};

			if (zoomAnimationRef.current !== null) {
				cancelAnimationFrame(zoomAnimationRef.current);
			}
			zoomAnimationRef.current = requestAnimationFrame(animateZoomToTarget);
		},
		[
			animateZoomToTarget,
			clampZoom,
			screenToWorldPoint,
			canvasSize.width,
			canvasSize.height,
			cameraRef,
			zoomTargetRef,
			zoomAnimationRef,
		]
	);

	return {
		queueZoom,
	};
}

export function useWheelZoom(
	containerRef: React.RefObject<HTMLDivElement | null>,
	queueZoom: (event: WheelEvent) => void
) {
	const queueZoomRef = useRef(queueZoom);

	useEffect(() => {
		queueZoomRef.current = queueZoom;
	}, [queueZoom]);

	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;

		const handleWheel = (event: WheelEvent) => {
			queueZoomRef.current(event);
		};

		node.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			node.removeEventListener("wheel", handleWheel);
		};
	}, [containerRef]);
}
