import { useCallback, useEffect, useRef } from "react";
import type { CanvasSize } from "./useCanvasResize";

export interface CameraState {
	cameraX: number;
	cameraY: number;
	zoom: number;
	viewRotation: number;
}

export interface UseCameraResult {
	cameraRef: React.MutableRefObject<CameraState>;
	zoomTargetRef: React.MutableRefObject<{ zoom: number; cameraX: number; cameraY: number } | null>;
	zoomAnimationRef: React.MutableRefObject<number | null>;
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
	animateZoomToTarget: () => void;
}

export function useCamera(
	canvasSize: CanvasSize,
	setZoom: (zoom: number) => void,
	setCameraPosition: (x: number, y: number) => void
): UseCameraResult {
	const cameraRef = useRef<CameraState>({ cameraX: 0, cameraY: 0, zoom: 1, viewRotation: 0 });
	const zoomAnimationRef = useRef<number | null>(null);
	const zoomTargetRef = useRef<{ zoom: number; cameraX: number; cameraY: number } | null>(null);

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
			const theta = (rotationValue * Math.PI) / 180;
			const cos = Math.cos(-theta);
			const sin = Math.sin(-theta);
			const worldDeltaX = (relativeX * cos - relativeY * sin) / zoomValue;
			const worldDeltaY = (relativeX * sin + relativeY * cos) / zoomValue;

			return {
				x: cameraXValue + worldDeltaX,
				y: cameraYValue + worldDeltaY,
			};
		},
		[canvasSize.width, canvasSize.height]
	);

	const screenDeltaToWorldDelta = useCallback((deltaX: number, deltaY: number) => {
		const { zoom: currentZoom, viewRotation: currentRotation } = cameraRef.current;
		const theta = (currentRotation * Math.PI) / 180;
		const cos = Math.cos(-theta);
		const sin = Math.sin(-theta);
		const scaledX = -deltaX / currentZoom;
		const scaledY = -deltaY / currentZoom;

		return {
			x: scaledX * cos - scaledY * sin,
			y: scaledX * sin + scaledY * cos,
		};
	}, []);

	const animateZoomToTarget = useCallback(() => {
		const target = zoomTargetRef.current;
		if (!target) {
			zoomAnimationRef.current = null;
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
			zoomAnimationRef.current = null;
			return;
		}

		const nextZoom = clampZoom(current.zoom + zoomDiff * 0.18);
		const nextCameraX = current.cameraX + cameraXDiff * 0.18;
		const nextCameraY = current.cameraY + cameraYDiff * 0.18;

		setZoom(nextZoom);
		setCameraPosition(nextCameraX, nextCameraY);
		zoomAnimationRef.current = requestAnimationFrame(animateZoomToTarget);
	}, [clampZoom, setCameraPosition, setZoom]);

	useEffect(() => {
		return () => {
			if (zoomAnimationRef.current !== null) {
				cancelAnimationFrame(zoomAnimationRef.current);
			}
		};
	}, []);

	return {
		cameraRef,
		zoomTargetRef,
		zoomAnimationRef,
		clampZoom,
		screenToWorldPoint,
		screenDeltaToWorldDelta,
		animateZoomToTarget,
	};
}
