import { screenToWorld } from "@/utils/mathUtils";
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

			// 使用统一的坐标转换计算新相机位置
			const centerX = canvasSize.width / 2;
			const centerY = canvasSize.height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;
			const newWorldPoint = screenToWorld(
				relativeX,
				relativeY,
				nextZoom,
				0, // 相机位置为 0，因为我们要的是相对偏移
				0,
				current.viewRotation
			);

			zoomTargetRef.current = {
				zoom: nextZoom,
				cameraX: worldPoint.x - newWorldPoint.x,
				cameraY: worldPoint.y - newWorldPoint.y,
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
