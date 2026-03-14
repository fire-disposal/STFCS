import { useAppDispatch, useAppSelector } from "@/store";
import { selectToken, updateToken } from "@/store/slices/mapSlice";
import { updateCamera } from "@/store/slices/cameraSlice";
import type { CameraState } from "@vt/shared/types";
import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
	Text,
	TextStyle,
} from "pixi.js";
import React, { useEffect, useRef, useState } from "react";
import { websocketService } from "@/services/websocket";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import {
	createLayers,
	setupLayerOrder,
	renderBackground,
	renderGrid,
	renderAllTokens,
	updateWeaponRanges,
	clearWeaponRanges,
	type LayerRegistry,
	type TokenRendererConfig,
} from "@/features/game/layers";
import { updateTextGroup } from "@/features/game/utils/TextRenderer";
import { updateParallax } from "@/features/game/layers/BackgroundRenderer";

interface GameCanvasProps {
	width?: number;
	height?: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
	width = 800,
	height = 600,
}) => {
	const dispatch = useAppDispatch();
	const {
		config: mapConfig,
		tokens,
		selectedTokenId,
		otherPlayersCameras,
	} = useAppSelector((state) => state.map);
	const camera = useAppSelector((state) => state.camera.local);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);

	// 相机 ref - 直接镜像 Redux 状态，用于高性能更新
	const cameraRef = useRef<CameraState>({ ...camera });

	// 同步 Redux 状态到 ref
	useEffect(() => {
		cameraRef.current = { ...camera };
	}, [camera]);

	// 动画 ref
	const zoomAnimationRef = useRef<{
		targetZoom: number;
		targetCenterX: number;
		targetCenterY: number;
		startZoom: number;
		startCenterX: number;
		startCenterY: number;
		startTime: number;
		duration: number;
	} | null>(null);

	// 交互状态 ref（避免闭包问题）
	const interactionRef = useRef({
		isDragging: false,
		dragStart: { x: 0, y: 0 },
		lastCameraPos: { x: 0, y: 0 },
	});

	const canvasRef = useRef<HTMLDivElement>(null);
	const appRef = useRef<Application | null>(null);
	const stageRef = useRef<Container | null>(null);
	const layersRef = useRef<LayerRegistry | null>(null);
	const mapConfigRef = useRef(mapConfig);
	const tokensRef = useRef(tokens);
	const selectedTokenIdRef = useRef(selectedTokenId);

	// 更新 refs
	useEffect(() => {
		mapConfigRef.current = mapConfig;
	}, [mapConfig]);

	useEffect(() => {
		tokensRef.current = tokens;
	}, [tokens]);

	useEffect(() => {
		selectedTokenIdRef.current = selectedTokenId;
	}, [selectedTokenId]);

	// 更新舞台变换
	const updateStageTransform = () => {
		if (!stageRef.current) return;
		const { centerX, centerY, zoom, rotation } = cameraRef.current;
		const { width, height } = appRef.current!.canvas;
		stageRef.current.position.set(width / 2 - centerX * zoom, height / 2 - centerY * zoom);
		stageRef.current.scale.set(zoom);
		stageRef.current.rotation = (rotation * Math.PI) / 180;
	};

	// 渲染所有图层
	const renderAllLayers = (forceRenderBackground = false) => {
		if (!layersRef.current) return;

		const layers = layersRef.current;
		const cfg = mapConfigRef.current;
		const cam = cameraRef.current;

		if (forceRenderBackground) {
			renderBackground(layers.background, {
				width: cfg.width,
				height: cfg.height,
				backgroundColor: cfg.backgroundColor,
			}, { centerX: cam.centerX, centerY: cam.centerY, zoom: cam.zoom });
		} else {
			updateParallax(layers.background, { centerX: cam.centerX, centerY: cam.centerY, zoom: cam.zoom }, {
				width: cfg.width,
				height: cfg.height,
				backgroundColor: cfg.backgroundColor,
			});
		}

		renderGrid(layers.grid, {
			width: cfg.width,
			height: cfg.height,
			showGrid: cfg.showGrid,
		}, cam.zoom);

		const tokenConfig: TokenRendererConfig = {
			selectedTokenId: selectedTokenIdRef.current,
			zoom: cam.zoom,
			onTokenClick: (token: any, event: FederatedPointerEvent) => {
				event.stopPropagation();
				dispatch(selectToken(token.id));
			},
			onTokenDrag: (token: any, dx: number, dy: number) => {
				dispatch(updateToken({
					id: token.id,
					updates: { position: { x: token.position.x + dx, y: token.position.y + dy } },
				}));
			},
		};

		renderAllTokens(layers.tokens, tokensRef.current, tokenConfig);

		if (selectedTokenIdRef.current && tokensRef.current[selectedTokenIdRef.current]) {
			const token = tokensRef.current[selectedTokenIdRef.current];
			const weapons = (token.metadata?.weapons || []) as any[];
			if (weapons.length > 0) {
				updateWeaponRanges(layers.weapons, {
					position: token.position,
					heading: token.heading,
					weapons,
					showRanges: true,
				});
			} else {
				clearWeaponRanges(layers.weapons);
			}
		}
	};

	// 发送相机更新到 Redux 和 WebSocket
	const syncCamera = () => {
		const cam = cameraRef.current;
		dispatch(updateCamera({ centerX: cam.centerX, centerY: cam.centerY, zoom: cam.zoom }));

		if (websocketService.isConnected() && currentPlayerId) {
			websocketService.send({
				type: WS_MESSAGE_TYPES.CAMERA_UPDATED,
				payload: {
					playerId: currentPlayerId,
					playerName: "Player",
					centerX: cam.centerX,
					centerY: cam.centerY,
					zoom: cam.zoom,
					rotation: cam.rotation,
					minZoom: cam.minZoom,
					maxZoom: cam.maxZoom,
					timestamp: Date.now(),
				},
			});
		}
	};

	// 初始化 PixiJS
	useEffect(() => {
		if (!canvasRef.current) return;

		const initPixi = async () => {
			const container = canvasRef.current!;
			container.innerHTML = '';

			const canvasEl = document.createElement("canvas");
			canvasEl.style.width = "100%";
			canvasEl.style.height = "100%";
			canvasEl.style.display = "block";
			container.appendChild(canvasEl);

			const app = new Application();
			await app.init({
				canvas: canvasEl,
				width: container.clientWidth,
				height: container.clientHeight,
				backgroundColor: 0x0a0a1a,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true,
				antialias: true,
				resizeTo: container, // 自动调整尺寸
			});

			appRef.current = app;

			const layers = createLayers();
			layersRef.current = layers;
			setupLayerOrder(layers);

			const stage = new Container();
			stageRef.current = stage;
			Object.values(layers).forEach((layer) => stage.addChild(layer));
			app.stage.addChild(stage);

			// 监听 resize 事件
			const resizeObserver = new ResizeObserver(() => {
				// PixiJS 会自动调整 canvas 尺寸（因为设置了 resizeTo）
				// 但需要手动更新舞台变换
				updateStageTransform();
			});
			resizeObserver.observe(container);

			// Ticker - 处理动画
			let lastZoom = cameraRef.current.zoom;

			app.ticker.add(() => {
				const cam = cameraRef.current;

				// 缩放动画
				if (zoomAnimationRef.current) {
					const anim = zoomAnimationRef.current;
					const elapsed = performance.now() - anim.startTime;
					const progress = Math.min(1, elapsed / anim.duration);
					const eased = 1 - Math.pow(1 - progress, 3);

					cam.zoom = anim.startZoom + (anim.targetZoom - anim.startZoom) * eased;
					cam.centerX = anim.startCenterX + (anim.targetCenterX - anim.startCenterX) * eased;
					cam.centerY = anim.startCenterY + (anim.targetCenterY - anim.startCenterY) * eased;

					updateStageTransform();
					updateParallax(layers.background, cam, {
						width: mapConfigRef.current.width,
						height: mapConfigRef.current.height,
						backgroundColor: mapConfigRef.current.backgroundColor,
					});

					if (progress >= 1) {
						zoomAnimationRef.current = null;
						syncCamera();
					}
					return;
				}

				// 文本更新
				if (Math.abs(cam.zoom - lastZoom) > 0.01) {
					lastZoom = cam.zoom;
					if (layersRef.current) {
						const updateTexts = (container: Container) => {
							container.children.forEach((child: any) => {
								if (child.updateForZoom) child.updateForZoom(cam.zoom);
								else if (child instanceof Container) updateTexts(child);
							});
						};
						updateTexts(layersRef.current.tokens);
					}
				}
			});

			updateStageTransform();
			renderAllLayers(true);

			// 交互事件
			const canvas = app.canvas;

			const handleWheel = (e: WheelEvent) => {
				e.preventDefault();
				const cam = cameraRef.current;
				const factor = e.deltaY > 0 ? 0.9 : 1.1;
				const targetZoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoom * factor));

				const rect = canvas.getBoundingClientRect();
				const mx = (e.clientX - rect.left) / rect.width;
				const my = (e.clientY - rect.top) / rect.height;

				const vw = rect.width / cam.zoom;
				const vh = rect.height / cam.zoom;
				const left = cam.centerX - vw / 2;
				const top = cam.centerY - vh / 2;
				const worldX = left + mx * vw;
				const worldY = top + my * vh;

				const newVw = rect.width / targetZoom;
				const newVh = rect.height / targetZoom;
				const newCenterX = worldX - mx * newVw + newVw / 2;
				const newCenterY = worldY - my * newVh + newVh / 2;

				zoomAnimationRef.current = {
					targetZoom,
					targetCenterX: newCenterX,
					targetCenterY: newCenterY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 250,
				};
			};

			const handleMouseDown = (e: MouseEvent) => {
				if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
					e.preventDefault();
					const cam = cameraRef.current;
					interactionRef.current.isDragging = true;
					interactionRef.current.dragStart = { x: e.clientX, y: e.clientY };
					interactionRef.current.lastCameraPos = { x: cam.centerX, y: cam.centerY };
				}
			};

			const handleMouseMove = (e: MouseEvent) => {
				if (interactionRef.current.isDragging) {
					const cam = cameraRef.current;
					const rect = canvas.getBoundingClientRect();
					const dx = e.clientX - interactionRef.current.dragStart.x;
					const dy = e.clientY - interactionRef.current.dragStart.y;
					const zoom = cameraRef.current.zoom;
					cam.centerX = interactionRef.current.lastCameraPos.x - dx / zoom;
					cam.centerY = interactionRef.current.lastCameraPos.y - dy / zoom;
					updateStageTransform();
					updateParallax(layers.background, cam, {
						width: mapConfigRef.current.width,
						height: mapConfigRef.current.height,
						backgroundColor: mapConfigRef.current.backgroundColor,
					});
				}
			};

			const handleMouseUp = () => {
				if (interactionRef.current.isDragging) {
					interactionRef.current.isDragging = false;
					syncCamera();
				}
			};

			canvas.addEventListener("wheel", handleWheel, { passive: false });
			canvas.addEventListener("mousedown", handleMouseDown);
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);

			return () => {
				resizeObserver.disconnect();
				app.destroy(true);
				appRef.current = null;
			};
		};

		initPixi();
	}, []);

	// 背景重绘
	useEffect(() => {
		renderAllLayers(true);
	}, [mapConfig.width, mapConfig.height, mapConfig.showGrid, mapConfig.backgroundColor]);

	// Token 更新
	useEffect(() => {
		renderAllLayers(false);
	}, [tokens, selectedTokenId]);

	// 缩放按钮处理 - 通过自定义事件触发
	useEffect(() => {
		const handleZoomEvent = (e: Event) => {
			const detail = (e as CustomEvent).detail as { action: "in" | "out" | "reset" };
			const cam = cameraRef.current;

			if (detail.action === "in") {
				zoomAnimationRef.current = {
					targetZoom: Math.min(cam.maxZoom, cam.zoom * 1.2),
					targetCenterX: cam.centerX,
					targetCenterY: cam.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 250,
				};
			} else if (detail.action === "out") {
				zoomAnimationRef.current = {
					targetZoom: Math.max(cam.minZoom, cam.zoom / 1.2),
					targetCenterX: cam.centerX,
					targetCenterY: cam.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 250,
				};
			} else if (detail.action === "reset") {
				zoomAnimationRef.current = {
					targetZoom: 1,
					targetCenterX: cam.centerX,
					targetCenterY: cam.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 250,
				};
			}
		};

		window.addEventListener("game-zoom", handleZoomEvent as EventListener);
		return () => {
			window.removeEventListener("game-zoom", handleZoomEvent as EventListener);
		};
	}, []);

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			<div ref={canvasRef} style={{ width: "100%", height: "100%" }} />
		</div>
	);
};

export default GameCanvas;
