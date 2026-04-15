/**
 * 相机控制 Hook - Zustand 版本
 */

import { useGameStore } from "@/state/stores";
import type { CameraState } from "@/sync/types";
import { useCallback } from "react";

export interface UseCameraReturn extends CameraState {
	setCamera: (updates: Partial<CameraState>) => void;
	pan: (dx: number, dy: number) => void;
	zoomTo: (zoom: number) => void;
	zoomIn: (factor?: number) => void;
	zoomOut: (factor?: number) => void;
	centerOn: (x: number, y: number) => void;
	resetCamera: () => void;
	screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
	worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;

export function useCamera(): UseCameraReturn {
	const camera = useGameStore((state) => state.camera);
	const setCameraAction = useGameStore((state) => state.setCamera);

	const setCameraCallback = useCallback(
		(updates: Partial<CameraState>) => {
			setCameraAction(updates);
		},
		[setCameraAction]
	);

	const pan = useCallback(
		(dx: number, dy: number) => {
			setCameraAction({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
		},
		[setCameraAction, camera]
	);

	const zoomTo = useCallback(
		(zoom: number) => {
			const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
			setCameraAction({ zoom: clamped });
		},
		[setCameraAction]
	);

	const zoomIn = useCallback(
		(factor = 1.15) => {
			zoomTo(camera.zoom * factor);
		},
		[zoomTo, camera.zoom]
	);

	const zoomOut = useCallback(
		(factor = 1.15) => {
			zoomTo(camera.zoom / factor);
		},
		[zoomTo, camera.zoom]
	);

	const centerOn = useCallback(
		(x: number, y: number) => {
			setCameraAction({ x, y });
		},
		[setCameraAction]
	);

	const resetCamera = useCallback(() => {
		setCameraAction({ x: 0, y: 0, zoom: 1, viewRotation: 0 });
	}, [setCameraAction]);

	const screenToWorld = useCallback(
		(screenX: number, screenY: number) => ({
			x: screenX / camera.zoom + camera.x,
			y: screenY / camera.zoom + camera.y,
		}),
		[camera]
	);

	const worldToScreen = useCallback(
		(worldX: number, worldY: number) => ({
			x: (worldX - camera.x) * camera.zoom,
			y: (worldY - camera.y) * camera.zoom,
		}),
		[camera]
	);

	return {
		...camera,
		setCamera: setCameraCallback,
		pan,
		zoomTo,
		zoomIn,
		zoomOut,
		centerOn,
		resetCamera,
		screenToWorld,
		worldToScreen,
	};
}