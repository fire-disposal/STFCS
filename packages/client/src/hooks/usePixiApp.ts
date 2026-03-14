/**
 * Pixi 画布 Hook
 * 管理 PixiJS 应用的生命周期和实例
 */

import { useEffect, useRef, useState } from "react";
import { Application, Container } from "pixi.js";

interface UsePixiAppOptions {
	width: number;
	height: number;
	backgroundColor?: number;
	antialias?: boolean;
	resolution?: number;
}

export type { UsePixiAppOptions };

interface UsePixiAppReturn {
	app: Application | null;
	stage: Container | null;
	canvasRef: React.RefObject<HTMLDivElement>;
	isReady: boolean;
}

export type { UsePixiAppReturn };

/**
 * PixiJS 应用 Hook
 */
export function usePixiApp(options: UsePixiAppOptions): UsePixiAppReturn {
	const {
		width,
		height,
		backgroundColor = 0x0a0a1a,
		antialias = true,
		resolution,
	} = options;

	const canvasRef = useRef<HTMLDivElement>(null);
	const appRef = useRef<Application | null>(null);
	const stageRef = useRef<Container | null>(null);
	const [isReady, setIsReady] = useState(false);

	const resolutionValue = resolution ?? ((typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1);

	useEffect(() => {
		if (!canvasRef.current) return;

		const initPixi = async () => {
			const canvasEl = document.createElement("canvas");
			canvasEl.style.width = "100%";
			canvasEl.style.height = "100%";
			canvasRef.current!.appendChild(canvasEl);

			const app = new Application();
			await app.init({
				canvas: canvasEl,
				width,
				height,
				backgroundColor,
				resolution: resolutionValue,
				autoDensity: true,
				antialias,
			});

			appRef.current = app;

			// 创建根容器
			const stage = new Container();
			stageRef.current = stage;
			app.stage.addChild(stage);

			setIsReady(true);
		};

		initPixi();

		return () => {
			if (appRef.current) {
				appRef.current.destroy(true);
				appRef.current = null;
			}
			setIsReady(false);
		};
	}, [width, height, backgroundColor, antialias, resolution]);

	return {
		app: appRef.current,
		stage: stageRef.current,
		canvasRef,
		isReady,
	};
}
