import { screenDeltaToWorldDelta as deltaUtil, screenToWorld } from "@/utils/mathUtils";
import { useCallback, useRef } from "react";
import type { CanvasSize } from "./useCanvasResize";

export interface CameraState {
	cameraX: number;
	cameraY: number;
	zoom: number;
	viewRotation: number;
}

export interface UseCameraResult {
	cameraRef: React.MutableRefObject<CameraState>;
	clampZoom: (value: number) => number;
	screenToWorldPoint: (
		screenX: number,
		screenY: number,
		zoomValue: number,
		cameraXValue: number,
		cameraYValue: number,
		rotationValue: number
	) => { x: number; y: number };
	screenDeltaToWorldDelta: (deltaX: number, deltaY: number) => { x: number; y: number };
	queueZoomToTarget: (target: { zoom: number; cameraX: number; cameraY: number }) => void;
	cancelZoomAnimation: () => void;
	tickZoomAnimation: () => void;
}

export function useCamera(
	canvasSize: CanvasSize,
	setZoom: (zoom: number) => void,
	setCameraPosition: (x: number, y: number) => void
): UseCameraResult {
	const cameraRef = useRef<CameraState>({ cameraX: 0, cameraY: 0, zoom: 1, viewRotation: 0 });
	const zoomTargetRef = useRef<{ zoom: number; cameraX: number; cameraY: number } | null>(null);
	const isZoomAnimatingRef = useRef(false);

	const clampZoom = useCallback((value: number) => {
		return Math.max(0.5, Math.min(3, value));
	}, []);

	const screenToWorldPoint = useCallback(
		(
			screenX: number,
			screenY: number,
			zoomValue: number,
			cameraXValue: number,
			cameraYValue: number,
			rotationValue: number
		) => {
			const centerX = canvasSize.width / 2;
			const centerY = canvasSize.height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;
			return screenToWorld(relativeX, relativeY, zoomValue, cameraXValue, cameraYValue, rotationValue);
		},
		[canvasSize.width, canvasSize.height]
	);

	const screenDeltaToWorldDelta = useCallback((deltaX: number, deltaY: number) => {
		const { zoom: currentZoom, viewRotation: currentRotation } = cameraRef.current;
		return deltaUtil(deltaX, deltaY, currentZoom, currentRotation);
	}, []);

	const cancelZoomAnimation = useCallback(() => {
		zoomTargetRef.current = null;
		isZoomAnimatingRef.current = false;
	}, []);

	const queueZoomToTarget = useCallback((target: { zoom: number; cameraX: number; cameraY: number }) => {
		zoomTargetRef.current = target;
		isZoomAnimatingRef.current = true;
	}, []);

	const tickZoomAnimation = useCallback(() => {
		const target = zoomTargetRef.current;
		if (!target) {
			isZoomAnimatingRef.current = false;
			return;
		}

		const current = cameraRef.current;
		const zoomDiff = target.zoom - current.zoom;
		const cameraXDiff = target.cameraX - current.cameraX;
		const cameraYDiff = target.cameraY - current.cameraY;

		if (
			Math.abs(zoomDiff) < 0.001 &&
			Math.abs(cameraXDiff) < 0.05 &&
			Math.abs(cameraYDiff) < 0.05
		) {
			setZoom(target.zoom);
			setCameraPosition(target.cameraX, target.cameraY);
			zoomTargetRef.current = null;
			isZoomAnimatingRef.current = false;
			return;
		}

		const speed = 0.18;
		const nextZoom = clampZoom(current.zoom + zoomDiff * speed);
		const nextCameraX = current.cameraX + cameraXDiff * speed;
		const nextCameraY = current.cameraY + cameraYDiff * speed;

		setZoom(nextZoom);
		setCameraPosition(nextCameraX, nextCameraY);
	}, [clampZoom, setCameraPosition, setZoom]);

	return {
		cameraRef,
		clampZoom,
		screenToWorldPoint,
		screenDeltaToWorldDelta,
		queueZoomToTarget,
		cancelZoomAnimation,
		tickZoomAnimation,
	};
}