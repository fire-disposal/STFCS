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
