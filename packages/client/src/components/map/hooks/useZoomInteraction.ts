import { screenToWorld } from "@/utils/mathUtils";
import { useCallback } from "react";
import type { UseCameraResult } from "./useCamera";
import type { CanvasSize } from "./useCanvasResize";

export interface UseZoomInteractionResult {
	queueZoom: (event: WheelEvent) => void;
}

export function useZoomInteraction(
	camera: UseCameraResult,
	canvasSize: CanvasSize
): UseZoomInteractionResult {
	const { clampZoom, screenToWorldPoint, cameraRef, queueZoomToTarget } = camera;

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
			const newWorldPoint = screenToWorld(
				relativeX,
				relativeY,
				nextZoom,
				0,
				0,
				current.viewRotation
			);

			queueZoomToTarget({
				zoom: nextZoom,
				cameraX: worldPoint.x - newWorldPoint.x,
				cameraY: worldPoint.y - newWorldPoint.y,
			});
		},
		[clampZoom, screenToWorldPoint, canvasSize.width, canvasSize.height, cameraRef, queueZoomToTarget]
	);

	return { queueZoom };
}