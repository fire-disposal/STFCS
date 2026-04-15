/**
 * 摄像机平滑动画 Hook
 *
 * 提供摄像机位置的平滑过渡动画
 */

import { useCallback, useEffect, useRef } from "react";

interface CameraAnimationOptions {
	duration?: number;
	easing?: "linear" | "easeInOut" | "easeOut" | "easeIn";
}

interface UseCameraAnimationProps {
	onCameraChange: (x: number, y: number) => void;
	onViewRotationChange?: (rotation: number) => void;
	onZoomChange?: (zoom: number) => void;
	currentX: number;
	currentY: number;
	currentRotation: number;
	currentZoom: number;
}

export interface UseCameraAnimationResult {
	animateToPosition: (x: number, y: number, options?: CameraAnimationOptions) => void;
	animateToRotation: (rotation: number, options?: CameraAnimationOptions) => void;
	animateToZoom: (zoom: number, options?: CameraAnimationOptions) => void;
	animateToCoords: (
		x: number,
		y: number,
		rotation?: number | null,
		zoom?: number | null,
		options?: CameraAnimationOptions
	) => void;
	cancelAnimation: () => void;
	isAnimating: boolean;
}

// 缓动函数
const easingFunctions = {
	linear: (t: number) => t,
	easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
	easeOut: (t: number) => t * (2 - t),
	easeIn: (t: number) => t * t,
};

export function useCameraAnimation({
	onCameraChange,
	onViewRotationChange,
	onZoomChange,
	currentX,
	currentY,
	currentRotation,
	currentZoom,
}: UseCameraAnimationProps): UseCameraAnimationResult {
	const animationRef = useRef<number | null>(null);
	const startTimeRef = useRef<number | null>(null);
	const startValuesRef = useRef({ x: 0, y: 0, rotation: 0, zoom: 1 });
	const targetValuesRef = useRef({ x: 0, y: 0, rotation: 0, zoom: 1 });
	const isAnimatingRef = useRef(false);
	const optionsRef = useRef<CameraAnimationOptions>({ duration: 300, easing: "easeInOut" });

	// 动画循环
	const animate = useCallback(
		(timestamp: number) => {
			if (!startTimeRef.current) {
				startTimeRef.current = timestamp;
			}

			const elapsed = timestamp - startTimeRef.current;
			const duration = optionsRef.current.duration || 300;
			const easing = easingFunctions[optionsRef.current.easing || "easeInOut"];

			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = easing(progress);

			// 插值计算新值
			const newX =
				startValuesRef.current.x +
				(targetValuesRef.current.x - startValuesRef.current.x) * easedProgress;
			const newY =
				startValuesRef.current.y +
				(targetValuesRef.current.y - startValuesRef.current.y) * easedProgress;
			const newRotation =
				startValuesRef.current.rotation +
				(targetValuesRef.current.rotation - startValuesRef.current.rotation) * easedProgress;
			const newZoom =
				startValuesRef.current.zoom +
				(targetValuesRef.current.zoom - startValuesRef.current.zoom) * easedProgress;

			// 应用新值
			onCameraChange(newX, newY);
			if (onViewRotationChange) {
				onViewRotationChange(newRotation);
			}
			if (onZoomChange) {
				onZoomChange(newZoom);
			}

			// 继续动画或结束
			if (progress < 1) {
				animationRef.current = requestAnimationFrame(animate);
			} else {
				// 确保最终值精确
				onCameraChange(targetValuesRef.current.x, targetValuesRef.current.y);
				if (onViewRotationChange) {
					onViewRotationChange(targetValuesRef.current.rotation);
				}
				if (onZoomChange) {
					onZoomChange(targetValuesRef.current.zoom);
				}
				isAnimatingRef.current = false;
				animationRef.current = null;
				startTimeRef.current = null;
			}
		},
		[onCameraChange, onViewRotationChange, onZoomChange]
	);

	// 开始动画
	const startAnimation = useCallback(
		(
			targetX: number,
			targetY: number,
			targetRotation?: number | null,
			targetZoom?: number | null,
			options?: CameraAnimationOptions
		) => {
			// 取消现有动画
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
				animationRef.current = null;
			}

			// 保存起始值和目标值
			startValuesRef.current = {
				x: currentX,
				y: currentY,
				rotation: currentRotation,
				zoom: currentZoom,
			};

			targetValuesRef.current = {
				x: targetX,
				y: targetY,
				// rotation 和 zoom 为空时继承当前值
				rotation: targetRotation ?? currentRotation,
				zoom: targetZoom ?? currentZoom,
			};

			optionsRef.current = options || { duration: 300, easing: "easeInOut" };
			isAnimatingRef.current = true;
			startTimeRef.current = null;

			// 启动动画
			animationRef.current = requestAnimationFrame(animate);
		},
		[currentX, currentY, currentRotation, currentZoom, animate]
	);

	// 取消动画
	const cancelAnimation = useCallback(() => {
		if (animationRef.current) {
			cancelAnimationFrame(animationRef.current);
			animationRef.current = null;
			isAnimatingRef.current = false;
			startTimeRef.current = null;
		}
	}, []);

	// 清理
	useEffect(() => {
		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, []);

	return {
		animateToPosition: (x, y, options) => startAnimation(x, y, undefined, undefined, options),
		animateToRotation: (rotation, options) =>
			startAnimation(currentX, currentY, rotation, undefined, options),
		animateToZoom: (zoom, options) => startAnimation(currentX, currentY, undefined, zoom, options),
		animateToCoords: (x, y, rotation, zoom, options) =>
			startAnimation(x, y, rotation ?? undefined, zoom ?? undefined, options),
		cancelAnimation,
		isAnimating: isAnimatingRef.current,
	};
}

export default useCameraAnimation;
