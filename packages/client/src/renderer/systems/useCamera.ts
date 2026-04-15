import { screenDeltaToWorldDelta as deltaUtil, screenToWorld } from "@/utils/coordinateSystem";
import { useCallback, useRef } from "react";
import type { CameraState } from "@/sync/types";
import type { CanvasSize } from "../core/useCanvasResize";

export interface UseCameraResult {
	cameraRef: React.MutableRefObject<CameraState>;
	clampZoom: (value: number) => number;
	screenToWorldPoint: (
		screenX: number,
		screenY: number,
		zoomValue: number,
		xValue: number,
		yValue: number,
		rotationValue: number
	) => { x: number; y: number };
	screenDeltaToWorldDelta: (deltaX: number, deltaY: number) => { x: number; y: number };
	queueZoomToTarget: (target: { zoom: number; x: number; y: number }) => void;
	cancelZoomAnimation: () => void;
	tickZoomAnimation: () => void;
}

export function useCamera(
	canvasSize: CanvasSize,
	setZoom: (zoom: number) => void,
	setCameraPosition: (x: number, y: number) => void
): UseCameraResult {
	const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1, viewRotation: 0 });
	const zoomTargetRef = useRef<{ zoom: number; x: number; y: number } | null>(null);
	const isZoomAnimatingRef = useRef(false);

	const clampZoom = useCallback((value: number) => {
		return Math.max(0.5, Math.min(3, value));
	}, []);

	const screenToWorldPoint = useCallback(
		(
			screenX: number,
			screenY: number,
			zoomValue: number,
			xValue: number,
			yValue: number,
			rotationValue: number
		) => {
			const centerX = canvasSize.width / 2;
			const centerY = canvasSize.height / 2;
			const relativeX = screenX - centerX;
			const relativeY = screenY - centerY;
			return screenToWorld(relativeX, relativeY, zoomValue, xValue, yValue, rotationValue);
		},
		[canvasSize.width, canvasSize.height]
	);

	const screenDeltaToWorldDelta = useCallback((deltaX: number, deltaY: number) => {
		const { zoom, viewRotation: currentRotation } = cameraRef.current;
		return deltaUtil(deltaX, deltaY, zoom, currentRotation ?? 0);
	}, []);

	const cancelZoomAnimation = useCallback(() => {
		zoomTargetRef.current = null;
		isZoomAnimatingRef.current = false;
	}, []);

	const queueZoomToTarget = useCallback((target: { zoom: number; x: number; y: number }) => {
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
		const xDiff = target.x - current.x;
		const yDiff = target.y - current.y;

		if (
			Math.abs(zoomDiff) < 0.001 &&
			Math.abs(xDiff) < 0.05 &&
			Math.abs(yDiff) < 0.05
		) {
			setZoom(target.zoom);
			setCameraPosition(target.x, target.y);
			zoomTargetRef.current = null;
			isZoomAnimatingRef.current = false;
			return;
		}

		const speed = 0.18;
		const nextZoom = clampZoom(current.zoom + zoomDiff * speed);
		const nextX = current.x + xDiff * speed;
		const nextY = current.y + yDiff * speed;

		setZoom(nextZoom);
		setCameraPosition(nextX, nextY);
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