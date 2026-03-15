import { useAppDispatch, useAppSelector } from "@/store";
import { updateToken } from "@/store/slices/mapSlice";
import { selectToken as selectTokenAction } from "@/store/slices/selectionSlice";
import { updateCamera } from "@/store/slices/cameraSlice";
import type { CameraState } from "@vt/shared/types";
import { LayerId } from "@/features/game/layers/types";
import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
} from "pixi.js";
import React, { useEffect, useRef } from "react";
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
	renderAllOtherPlayersCameras,
	renderSelectionLayer,
	type LayerRegistry,
	type TokenRendererConfig,
} from "@/features/game/layers";
import { updateParallax } from "@/features/game/layers/BackgroundRenderer";
import { useInteraction } from "@/hooks/useInteraction";

interface GameCanvasProps {
	width?: number;
	height?: number;
}

const GameCanvas: React.FC<GameCanvasProps> = () => {
	const dispatch = useAppDispatch();
	const {
		config: mapConfig,
		tokens,
		otherPlayersCameras,
	} = useAppSelector((state) => state.map);
	const { selectedTokenId, selections } = useAppSelector((state) => state.selection);
	const camera = useAppSelector((state) => state.camera.local);
	const layerVisibility = useAppSelector((state) => state.layers.visibility);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const currentPlayerName = useAppSelector((state) => state.ui.connection.playerName);
	const { cursor, keyboard } = useAppSelector((state) => state.interaction);

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

	// Token 拖拽状态（本地管理，避免 Redux 频繁更新）
	const draggingTokenRef = useRef<{
		tokenId: string;
		originalPosition: { x: number; y: number };
		isDragging: boolean;
		lastDragTime?: number;
		startScreenPos?: { x: number; y: number };
	} | null>(null);

	const canvasRef = useRef<HTMLDivElement>(null);
	const appRef = useRef<Application | null>(null);
	const stageRef = useRef<Container | null>(null);
	const layersRef = useRef<LayerRegistry | null>(null);
	const mapConfigRef = useRef(mapConfig);
	const tokensRef = useRef(tokens);
	const selectedTokenIdRef = useRef(selectedTokenId);

	// 使用交互 Hook
	const interaction = useInteraction(camera, {
		onCanvasPan: () => {
			// 画布拖动时更新背景视差
			if (layersRef.current) {
				updateParallax(layersRef.current.background, cameraRef.current, {
					width: mapConfigRef.current.width,
					height: mapConfigRef.current.height,
					backgroundColor: mapConfigRef.current.backgroundColor,
				});
			}
		},
		onTokenDragStart: (tokenId) => {
			const token = tokensRef.current[tokenId];
			if (!token) return;

			draggingTokenRef.current = {
				tokenId,
				originalPosition: { ...token.position },
				isDragging: true,
			};

			// 发送拖拽开始消息
			if (currentPlayerId && currentPlayerName) {
				websocketService.sendTokenDragStart(
					tokenId,
					currentPlayerId,
					currentPlayerName,
					token.position,
					token.heading || 0
				);
			}
		},
		onTokenDrag: (tokenId, newPosition) => {
			const token = tokensRef.current[tokenId];
			if (!token) return;

			// 更新本地 token 位置（视觉反馈）
			dispatch(updateToken({
				id: tokenId,
				updates: { position: newPosition },
			}));

			// 发送拖拽中消息（限流：每 100ms 一次）
			if (currentPlayerId && currentPlayerName && draggingTokenRef.current?.isDragging) {
				const now = Date.now();
				if (!draggingTokenRef.current.lastDragTime || now - draggingTokenRef.current.lastDragTime > 100) {
					draggingTokenRef.current.lastDragTime = now;
					websocketService.sendTokenDragging(
						tokenId,
						currentPlayerId,
						currentPlayerName,
						newPosition,
						token.heading || 0
					);
				}
			}
		},
		onTokenDragEnd: (tokenId, finalPosition, cancelled) => {
			if (!draggingTokenRef.current) return;

			const token = tokensRef.current[tokenId];
			if (!token) return;

			const committed = !cancelled && draggingTokenRef.current.isDragging;

			// 发送拖拽结束消息
			if (currentPlayerId) {
				websocketService.sendTokenDragEnd(
					tokenId,
					currentPlayerId,
					finalPosition,
					token.heading || 0,
					committed
				);
			}

			// 如果取消拖拽，恢复原始位置
			if (cancelled) {
				dispatch(updateToken({
					id: tokenId,
					updates: { position: draggingTokenRef.current.originalPosition },
				}));
			}

			draggingTokenRef.current = null;
		},
	});

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

		// 背景层
		const showStars = layerVisibility[LayerId.BACKGROUND_STARS] ?? true;
		const showNebula = layerVisibility[LayerId.BACKGROUND_NEBULA] ?? true;
		const showGrid = layerVisibility[LayerId.BACKGROUND_GRID] ?? true;

		if (forceRenderBackground || showStars !== (layers.background as any)._starsVisible) {
			(layers.background as any)._starsVisible = showStars;
			if (showStars) {
				renderBackground(layers.background, {
					width: cfg.width,
					height: cfg.height,
					backgroundColor: cfg.backgroundColor,
					starCount: 900,
					nebulaCount: showNebula ? 5 : 0,
				}, { centerX: cam.centerX, centerY: cam.centerY, zoom: cam.zoom });
			} else {
				layers.background.removeChildren();
				// 只绘制背景色
				const bg = new Graphics();
				bg.rect(0, 0, cfg.width, cfg.height);
				bg.fill({ color: cfg.backgroundColor, alpha: 1 });
				layers.background.addChild(bg);
			}
		}

		// 网格层
		if (showGrid) {
			renderGrid(layers.grid, {
				width: cfg.width,
				height: cfg.height,
				showGrid: true,
			}, cam.zoom);
			layers.grid.visible = true;
		} else {
			layers.grid.visible = false;
		}

		const tokenConfig: TokenRendererConfig = {
			selectedTokenId: selectedTokenIdRef.current,
			zoom: cam.zoom,
			onTokenClick: (token: any, event: FederatedPointerEvent) => {
				event.stopPropagation();
				dispatch(selectTokenAction(token.id));
			},
			onTokenDragStart: () => {
				// 由 useInteraction hook 处理
			},
			onTokenDrag: () => {
				// 由 useInteraction hook 处理
			},
			onTokenDragEnd: () => {
				// 由 useInteraction hook 处理
			},
		};

		renderAllTokens(layers.tokens, tokensRef.current, tokenConfig);

		// 渲染其他玩家相机指示器
		const showOtherPlayers = layerVisibility[LayerId.OTHER_PLAYERS_CAMERAS] ?? true;
		if (showOtherPlayers && Object.keys(otherPlayersCameras).length > 0) {
			const canvasEl = appRef.current?.canvas;
			if (canvasEl) {
				renderAllOtherPlayersCameras(
					layers.otherPlayersCameras,
					otherPlayersCameras,
					{ width: canvasEl.clientWidth, height: canvasEl.clientHeight },
					currentPlayerId
				);
				layers.otherPlayersCameras.visible = true;
			}
		} else {
			layers.otherPlayersCameras.visible = false;
			layers.otherPlayersCameras.removeChildren();
		}

		// 渲染选中状态图层
		const showSelections = layerVisibility[LayerId.SELECTIONS] ?? true;
		if (showSelections) {
			renderSelectionLayer(layers.selections, {
				currentPlayerId,
				selections,
				selectedTokenId: selectedTokenIdRef.current,
				tokens: tokensRef.current,
				zoom: cam.zoom,
			});
			layers.selections.visible = true;
		} else {
			layers.selections.visible = false;
			layers.selections.removeChildren();
		}

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
					playerName: currentPlayerName,
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
				resizeTo: container,
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

			// 滚轮缩放
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

			// 鼠标按下 - 开始拖动画布或 Token
			const handleMouseDown = (e: MouseEvent) => {
				// 中键或空格 + 左键：拖动画布
				if (e.button === 1 || (e.button === 0 && keyboard.isSpacePressed)) {
					e.preventDefault();
					const cam = cameraRef.current;
					interaction.startCanvasPan({
						startScreen: { x: e.clientX, y: e.clientY },
						startWorld: {
							x: (e.clientX - canvas.getBoundingClientRect().left) / cam.zoom + cam.centerX,
							y: (e.clientY - canvas.getBoundingClientRect().top) / cam.zoom + cam.centerY,
						},
						startCamera: {
							centerX: cam.centerX,
							centerY: cam.centerY,
							zoom: cam.zoom,
						},
					});
				}
			};

			// 鼠标移动 - 处理拖动
			const handleMouseMove = (e: MouseEvent) => {
				if (interaction.drag) {
					interaction.updateDragPosition(e.clientX, e.clientY);
				}
			};

			// 鼠标释放 - 结束拖动
			const handleMouseUp = () => {
				if (interaction.drag) {
					interaction.endCurrentDrag();
				}
			};

			// 绑定全局事件
			canvas.addEventListener("wheel", handleWheel, { passive: false });
			canvas.addEventListener("mousedown", handleMouseDown);
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);

			// 应用光标样式
			const canvasContainer = canvasRef.current;
			if (canvasContainer) {
				canvasContainer.style.cursor = cursor === "grab" ? "grab" :
					cursor === "grabbing" ? "grabbing" :
					cursor === "pointer" ? "pointer" :
					cursor === "move" ? "move" :
					cursor === "crosshair" ? "crosshair" : "default";
			}

			return () => {
				resizeObserver.disconnect();
				app.destroy(true);
				appRef.current = null;
				canvas.removeEventListener("wheel", handleWheel);
				canvas.removeEventListener("mousedown", handleMouseDown);
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};
		};

		initPixi();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// 光标变化时更新
	useEffect(() => {
		const canvasContainer = canvasRef.current;
		if (canvasContainer) {
			canvasContainer.style.cursor = cursor === "grab" ? "grab" :
				cursor === "grabbing" ? "grabbing" :
				cursor === "pointer" ? "pointer" :
				cursor === "move" ? "move" :
				cursor === "crosshair" ? "crosshair" : "default";
		}
	}, [cursor]);

	// 背景重绘
	useEffect(() => {
		renderAllLayers(true);
	}, [mapConfig.width, mapConfig.height, mapConfig.showGrid, mapConfig.backgroundColor]);

	// Token 更新
	useEffect(() => {
		renderAllLayers(false);
	}, [tokens, selectedTokenId]);

	// 图层可见性变化时更新
	useEffect(() => {
		renderAllLayers(false);
	}, [
		layerVisibility[LayerId.BACKGROUND_STARS],
		layerVisibility[LayerId.BACKGROUND_NEBULA],
		layerVisibility[LayerId.BACKGROUND_GRID],
		layerVisibility[LayerId.OTHER_PLAYERS_CAMERAS],
		layerVisibility[LayerId.SELECTIONS]
	]);

	// 其他玩家相机更新时重绘
	useEffect(() => {
		renderAllLayers(false);
	}, [otherPlayersCameras]);

	// 选中状态更新时重绘
	useEffect(() => {
		renderAllLayers(false);
	}, [selections]);

	// 缩放按钮处理
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
