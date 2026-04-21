/**
 * Canvas 尺寸监听 Hook
 *
 * 职责：
 * 1. 监听容器尺寸变化
 * 2. 使用 ResizeObserver 实现响应式
 * 3. 返回当前画布尺寸 { width, height }
 *
 * 使用方式：
 * const hostRef = useRef<HTMLDivElement>(null);
 * const canvasSize = useCanvasResize(hostRef);
 *
 * 返回值：
 * - width: 容器宽度（像素）
 * - height: 容器高度（像素）
 * - 默认值: { width: 980, height: 620 }
 */

import { useEffect, useState } from "react";

export interface CanvasSize {
	width: number;
	height: number;
}

export function useCanvasResize(containerRef: React.RefObject<HTMLDivElement | null>): CanvasSize {
	const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 980, height: 620 });

	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;

		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				const { width, height } = entry.contentRect;
				setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
			}
		});

		resizeObserver.observe(node);

		const { width, height } = node.getBoundingClientRect();
		setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });

		return () => {
			resizeObserver.disconnect();
		};
	}, [containerRef]);

	return canvasSize;
}
