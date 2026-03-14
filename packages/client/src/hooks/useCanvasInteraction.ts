/**
 * 画布交互 Hook
 * 处理画布的拖拽、缩放等交互逻辑
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface UseCanvasInteractionOptions {
	minZoom: number;
	maxZoom: number;
	onCameraChange?: (camera: { x: number; y: number; zoom: number }) => void;
}

export type { UseCanvasInteractionOptions };

interface CameraState {
	x: number;
	y: number;
	zoom: number;
}

export function useCanvasInteraction(options: UseCanvasInteractionOptions) {
	const { minZoom, maxZoom, onCameraChange } = options;

	const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const lastCameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });

	// 更新相机并触发回调
	const updateCamera = useCallback(
		(updates: Partial<CameraState>) => {
			setCamera((prev) => {
				const newCamera = {
					...prev,
					...updates,
					zoom: Math.max(minZoom, Math.min(maxZoom, updates.zoom ?? prev.zoom)),
				};
				lastCameraRef.current = newCamera;
				onCameraChange?.(newCamera);
				return newCamera;
			});
		},
		[minZoom, maxZoom, onCameraChange]
	);

	// 滚轮缩放
	const handleWheel = useCallback(
		(event: WheelEvent, canvasRect: DOMRect) => {
			event.preventDefault();

			const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
			const newZoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * zoomFactor));

			// 计算鼠标位置的世界坐标
			const mouseX = event.clientX - canvasRect.left;
			const mouseY = event.clientY - canvasRect.top;

			const worldX = (mouseX - camera.x) / camera.zoom;
			const worldY = (mouseY - camera.y) / camera.zoom;

			// 计算新的相机位置以保持鼠标位置不变
			const newCameraX = mouseX - worldX * newZoom;
			const newCameraY = mouseY - worldY * newZoom;

			updateCamera({ x: newCameraX, y: newCameraY, zoom: newZoom });
		},
		[camera, minZoom, maxZoom, updateCamera]
	);

	// 鼠标按下开始拖拽
	const handleMouseDown = useCallback(
		(event: MouseEvent) => {
			// 中键或 Ctrl+ 左键开始拖拽
			if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
				event.preventDefault();
				setIsDragging(true);
				dragStartRef.current = { x: event.clientX, y: event.clientY };
				lastCameraRef.current = { ...camera };
			}
		},
		[camera]
	);

	// 鼠标移动处理拖拽
	const handleMouseMove = useCallback(
		(event: MouseEvent) => {
			if (!isDragging) return;

			const dx = event.clientX - dragStartRef.current.x;
			const dy = event.clientY - dragStartRef.current.y;

			updateCamera({
				x: lastCameraRef.current.x + dx,
				y: lastCameraRef.current.y + dy,
			});
		},
		[isDragging, updateCamera]
	);

	// 鼠标释放停止拖拽
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// 绑定事件到画布
	const bindToCanvas = useCallback(
		(canvas: HTMLCanvasElement) => {
			if (!canvas) return;

			const handleWheelBound = (event: WheelEvent) => {
				const rect = canvas.getBoundingClientRect();
				handleWheel(event, rect);
			};

			canvas.addEventListener("wheel", handleWheelBound, { passive: false });
			canvas.addEventListener("mousedown", handleMouseDown);
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);

			return () => {
				canvas.removeEventListener("wheel", handleWheelBound);
				canvas.removeEventListener("mousedown", handleMouseDown);
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};
		},
		[handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]
	);

	// 缩放控制
	const zoomIn = useCallback(
		(factor = 1.2) => {
			updateCamera({ zoom: camera.zoom * factor });
		},
		[updateCamera, camera.zoom]
	);

	const zoomOut = useCallback(
		(factor = 1.2) => {
			updateCamera({ zoom: camera.zoom / factor });
		},
		[updateCamera, camera.zoom]
	);

	const resetZoom = useCallback(() => {
		updateCamera({ zoom: 1 });
	}, [updateCamera]);

	const centerOn = useCallback(
		(x: number, y: number) => {
			updateCamera({ x, y });
		},
		[updateCamera]
	);

	return {
		// 状态
		camera,
		isDragging,

		// 方法
		bindToCanvas,
		zoomIn,
		zoomOut,
		resetZoom,
		centerOn,
		updateCamera,
	};
}
