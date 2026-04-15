import { screenToWorld } from "@/utils/coordinateSystem";
import { useCallback } from "react";
import type { UseCameraResult } from "../systems/useCamera";
import type { CanvasSize } from "../core/useCanvasResize";

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
				current.x,
				current.y,
				current.viewRotation ?? 0
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
				current.viewRotation ?? 0
			);

			queueZoomToTarget({
				zoom: nextZoom,
				x: worldPoint.x - newWorldPoint.x,
				y: worldPoint.y - newWorldPoint.y,
			});
		},
		[clampZoom, screenToWorldPoint, canvasSize.width, canvasSize.height, cameraRef, queueZoomToTarget]
	);

	return { queueZoom };
}