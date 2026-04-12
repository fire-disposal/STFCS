/**
 * 相机控制 Hook
 * 统一的相机操作接口
 * 
 * 优化内容：
 * - 改进缩放比率 (1.15x 每档)
 * - 支持边界约束
 * - RTS 风格的平移控制
 */

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	setCamera,
	updateCamera,
	panCamera,
	resetCamera as resetCameraAction,
} from "@/store/slices/cameraSlice";
import type { CameraState } from "@vt/contracts/types";
import { clampZoom } from "@/utils/cameraBounds";

export interface UseCameraReturn extends CameraState {
	// 设置相机（完全替换）
	setCamera: (updates: Partial<CameraState>) => void;
	// 更新相机（增量更新）
	updateCamera: (updates: Partial<CameraState>) => void;
	// 相对移动
	pan: (dx: number, dy: number) => void;
	// 缩放
	zoomTo: (zoom: number) => void;
	zoomIn: (factor?: number) => void;
	zoomOut: (factor?: number) => void;
	// 居中
	centerOn: (x: number, y: number) => void;
	// 重置
	resetCamera: () => void;
	// 工具方法
	screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
	worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
}

export function useCamera(): UseCameraReturn {
	const dispatch = useAppDispatch();
	const camera = useAppSelector((state) => state.camera.local);

	// 设置相机
	const setCameraCallback = useCallback(
		(updates: Partial<CameraState>) => {
			dispatch(setCamera(updates));
		},
		[dispatch]
	);

	// 更新相机
	const updateCameraCallback = useCallback(
		(updates: Partial<CameraState>) => {
			dispatch(updateCamera(updates));
		},
		[dispatch]
	);

	// 相对移动
	const pan = useCallback(
		(dx: number, dy: number) => {
			dispatch(panCamera({ dx, dy }));
		},
		[dispatch]
	);

	// 缩放
	const zoomTo = useCallback(
		(zoom: number) => {
			const minZoom = camera.minZoom ?? 0.3;
			const maxZoom = camera.maxZoom ?? 6;
			const clamped = clampZoom(zoom, minZoom, maxZoom);
			dispatch(updateCamera({ zoom: clamped }));
		},
		[dispatch, camera.minZoom, camera.maxZoom]
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

	// 居中到点
	const centerOn = useCallback(
		(x: number, y: number) => {
			dispatch(setCamera({ centerX: x, centerY: y }));
		},
		[dispatch]
	);

	// 重置相机
	const resetCamera = useCallback(() => {
		dispatch(resetCameraAction());
	}, [dispatch]);

	// 屏幕坐标转世界坐标
	const screenToWorld = useCallback(
		(screenX: number, screenY: number) => ({
			x: screenX / camera.zoom + camera.centerX,
			y: screenY / camera.zoom + camera.centerY,
		}),
		[camera.zoom, camera.centerX, camera.centerY]
	);

	// 世界坐标转屏幕坐标
	const worldToScreen = useCallback(
		(worldX: number, worldY: number) => ({
			x: (worldX - camera.centerX) * camera.zoom,
			y: (worldY - camera.centerY) * camera.zoom,
		}),
		[camera.zoom, camera.centerX, camera.centerY]
	);

	return {
		// 状态
		...camera,

		// 方法
		setCamera: setCameraCallback,
		updateCamera: updateCameraCallback,
		pan,
		zoomTo,
		zoomIn,
		zoomOut,
		centerOn,
		resetCamera,

		// 工具方法
		screenToWorld,
		worldToScreen,
	};
}
