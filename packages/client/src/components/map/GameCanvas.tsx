import { useAppDispatch, useAppSelector } from "@/store";
import { updateToken } from "@/store/slices/mapSlice";
import { selectToken as selectTokenAction } from "@/store/slices/selectionSlice";
import { updateCamera } from "@/store/slices/cameraSlice";
import type { CameraState } from "@vt/shared/types";
import type { DragState } from "@/store/slices/interactionSlice";
import { LayerId } from "@/features/game/layers/types";
import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
} from "pixi.js";
import React, { useEffect, useRef } from "react";
import { useRoomOperations } from "@/room";
import type { RoomClient, OperationMap } from "@/room";
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
import {
	calculateZoomFactor,
	calculateZoomTowardsMouse,
	updateCameraWithConstraints,
} from "@/utils/cameraBounds";

interface GameCanvasProps {
	width?: number;
	height?: number;
	// 房间客户端
	client: RoomClient<OperationMap> | null;
	// GameView 传递的 props
	tokens?: unknown[];
	selectedTokenId?: string | null;
	selectedTool?: "select" | "draw" | "measure" | "pan";
	onToolSelect?: (tool: string) => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onResetZoom?: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ client }) => {
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
	const { cursor } = useAppSelector((state) => state.interaction);

	// 获取房间操作调用器
	const ops = useRoomOperations(client);

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
	// 缩放方向：true = 正常（向上滚动放大），false = 翻转（向下滚动放大）
	const zoomDirectionRef = useRef<boolean>((() => {
		const saved = localStorage.getItem("zoomDirection");
		return saved !== "inverted";
	})());

	// 交互方法 ref - 用于事件处理器中访问最新的方法
	const interactionRef = useRef<{
		startCanvasPan: (dragState: Omit<DragState, "type">) => void;
		updateDragPosition: (screenX: number, screenY: number) => void;
		endCurrentDrag: () => void;
		drag: DragState | null;
	} | null>(null);

	// 本地画布拖动状态（本地优先，不经过 Redux）
	const canvasDragRef = useRef<{
		isDragging: boolean;
		startScreen: { x: number; y: number };
		startCamera: { centerX: number; centerY: number; zoom: number };
	} | null>(null);

	// 相机同步节流定时器
	const syncThrottleRef = useRef<NodeJS.Timeout | null>(null);
	const lastSyncTimeRef = useRef<number>(0);

	// 使用交互 Hook
	const interaction = useInteraction(camera, { width: mapConfig.width, height: mapConfig.height }, {
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

			// 通过房间框架发送拖拽开始事件
			if (currentPlayerId && currentPlayerName) {
				client?.emit('token.drag.start', {
					tokenId,
					playerId: currentPlayerId,
					playerName: currentPlayerName,
					position: token.position,
					heading: token.heading || 0,
				});
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

			// 通过房间框架发送拖拽中事件（限流：每 100ms 一次）
			if (currentPlayerId && currentPlayerName && draggingTokenRef.current?.isDragging) {
				const now = Date.now();
				if (!draggingTokenRef.current.lastDragTime || now - draggingTokenRef.current.lastDragTime > 100) {
					draggingTokenRef.current.lastDragTime = now;
					client?.emit('token.drag.move', {
						tokenId,
						playerId: currentPlayerId,
						playerName: currentPlayerName,
						position: newPosition,
						heading: token.heading || 0,
					});
				}
			}
		},
		onTokenDragEnd: async (tokenId, finalPosition, cancelled) => {
			if (!draggingTokenRef.current) return;

			const token = tokensRef.current[tokenId];
			if (!token) return;

			const committed = !cancelled && draggingTokenRef.current.isDragging;

			// 如果确认移动，通过房间操作调用 moveShip
			if (committed && currentPlayerId) {
				try {
					await ops?.moveShip(tokenId, finalPosition, token.heading);
				} catch (error) {
					console.error('Failed to move ship:', error);
					// 移动失败，恢复原始位置
					dispatch(updateToken({
						id: tokenId,
						updates: { position: draggingTokenRef.current.originalPosition },
					}));
				}
			} else if (cancelled) {
				// 如果取消拖拽，恢复原始位置
				dispatch(updateToken({
					id: tokenId,
					updates: { position: draggingTokenRef.current.originalPosition },
				}));
			}

			// 发送拖拽结束事件
			client?.emit('token.drag.end', {
				tokenId,
				playerId: currentPlayerId,
				position: finalPosition,
				heading: token.heading || 0,
				committed,
			});

			draggingTokenRef.current = null;
		},
	});

	// 同步交互方法到 ref（用于事件处理器）
	useEffect(() => {
		interactionRef.current = {
			startCanvasPan: interaction.startCanvasPan,
			updateDragPosition: interaction.updateDragPosition,
			endCurrentDrag: interaction.endCurrentDrag,
			drag: interaction.drag,
		};
	}, [interaction]);

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

	// 更新舞台变换（优化版）
	const updateStageTransform = () => {
		if (!stageRef.current || !appRef.current) return;
		const { centerX, centerY, zoom, rotation } = cameraRef.current;
		const { width, height } = appRef.current.canvas;
		
		// 优化：使用 pivot 而不是 position 计算，减少浮点误差
		stageRef.current.pivot.set(centerX, centerY);
		stageRef.current.position.set(width / 2, height / 2);
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

	// 发送相机更新到 Redux 和房间（节流，不阻塞本地操作）
	const syncCamera = (immediate = false) => {
		const now = Date.now();
		const timeSinceLastSync = now - lastSyncTimeRef.current;
		const minSyncInterval = 100; // 最小同步间隔 100ms

		// 清除待定的同步定时器
		if (syncThrottleRef.current) {
			clearTimeout(syncThrottleRef.current);
			syncThrottleRef.current = null;
		}

		const doSync = () => {
			const cam = cameraRef.current;
			lastSyncTimeRef.current = Date.now();

			// 异步更新 Redux，不阻塞本地渲染
			requestAnimationFrame(() => {
				dispatch(updateCamera({ centerX: cam.centerX, centerY: cam.centerY, zoom: cam.zoom }));
			});

			// 异步发送到房间
			if (client && currentPlayerId) {
				requestAnimationFrame(() => {
					client.emit('camera.updated', {
						playerId: currentPlayerId,
						playerName: currentPlayerName,
						centerX: cam.centerX,
						centerY: cam.centerY,
						zoom: cam.zoom,
						rotation: cam.rotation,
						minZoom: cam.minZoom,
						maxZoom: cam.maxZoom,
						timestamp: Date.now(),
					});
				});
			}
		};

		if (immediate || timeSinceLastSync >= minSyncInterval) {
			doSync();
		} else {
			// 延迟同步，避免频繁更新
			syncThrottleRef.current = setTimeout(doSync, minSyncInterval - timeSinceLastSync);
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

			// 滚轮缩放 - 优化缩放比率和边界约束（支持方向翻转）
			const handleWheel = (e: WheelEvent) => {
				e.preventDefault();
				const cam = cameraRef.current;
				const rect = canvas.getBoundingClientRect();
				const viewportWidth = rect.width;
				const viewportHeight = rect.height;

				// 计算缩放因子（优化比率 1.15x）
				const baseZoomFactor = calculateZoomFactor(e.deltaY, 1.15);
				// 根据用户设置翻转缩放方向
				const zoomFactor = zoomDirectionRef.current ? baseZoomFactor : 1 / baseZoomFactor;
				const targetZoom = cam.zoom * zoomFactor;

				// 使用 RTS 风格的鼠标位置缩放
				const mouseScreenX = e.clientX - rect.left;
				const mouseScreenY = e.clientY - rect.top;

				const zoomResult = calculateZoomTowardsMouse(
					mouseScreenX,
					mouseScreenY,
					cam.zoom,
					targetZoom,
					cam.centerX,
					cam.centerY,
					viewportWidth,
					viewportHeight
				);

				// 应用边界约束
				const mapConfigCurrent = mapConfigRef.current;
				const updated = updateCameraWithConstraints(
					{
						zoom: targetZoom,
						centerX: zoomResult.centerX,
						centerY: zoomResult.centerY,
					},
					cam,
					{
						mapWidth: mapConfigCurrent.width,
						mapHeight: mapConfigCurrent.height,
						minZoom: cam.minZoom ?? 0.3,
						maxZoom: cam.maxZoom ?? 6,
						outOfBoundsMargin: 0.15, // 允许 15% 出界查看
						softBoundaryFactor: 0.25, // 25% 软边界阻力
					},
					viewportWidth,
					viewportHeight,
					{ enableSoftBoundary: true }
				);

				// 启动平滑动画
				zoomAnimationRef.current = {
					targetZoom: updated.zoom,
					targetCenterX: updated.centerX,
					targetCenterY: updated.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 200, // 稍微缩短动画时间，响应更快
				};
			};

			// 鼠标按下 - 仅中键拖拽画布（本地优先，直接更新）
			const handleMouseDown = (e: MouseEvent) => {
				// 仅中键拖拽画布
				if (e.button === 1) {
					e.preventDefault();
					const cam = cameraRef.current;

					// 本地记录拖动起始状态，不经过 Redux
					canvasDragRef.current = {
						isDragging: true,
						startScreen: { x: e.clientX, y: e.clientY },
						startCamera: {
							centerX: cam.centerX,
							centerY: cam.centerY,
							zoom: cam.zoom,
						},
					};

					// 同时更新到 useInteraction 以保持兼容性
					const rect = canvas.getBoundingClientRect();
					interactionRef.current?.startCanvasPan({
						startScreen: { x: e.clientX, y: e.clientY },
						startWorld: {
							x: (e.clientX - rect.left) / cam.zoom + cam.centerX,
							y: (e.clientY - rect.top) / cam.zoom + cam.centerY,
						},
						startCamera: {
							centerX: cam.centerX,
							centerY: cam.centerY,
							zoom: cam.zoom,
						},
					});
				}
			};

			// 鼠标移动 - 处理拖动（本地优先，实时更新）
			const handleMouseMove = (e: MouseEvent) => {
				// 本地画布拖动处理（中键）
				if (canvasDragRef.current?.isDragging) {
					const drag = canvasDragRef.current;
					const dx = (e.clientX - drag.startScreen.x) / drag.startCamera.zoom;
					const dy = (e.clientY - drag.startScreen.y) / drag.startCamera.zoom;

					// 直接更新 cameraRef，不经过 Redux，零延迟
					cameraRef.current = {
						...cameraRef.current,
						centerX: drag.startCamera.centerX - dx,
						centerY: drag.startCamera.centerY - dy,
					};

					// 立即更新渲染
					updateStageTransform();

					// 更新背景视差
					if (layersRef.current) {
						updateParallax(layersRef.current.background, cameraRef.current, {
							width: mapConfigRef.current.width,
							height: mapConfigRef.current.height,
							backgroundColor: mapConfigRef.current.backgroundColor,
						});
					}

					// 节流同步到 Redux 和服务器（不阻塞本地渲染）
					syncCamera();
					return;
				}

				// Token 拖动处理（保持原有逻辑）
				if (interactionRef.current?.drag) {
					interactionRef.current.updateDragPosition(e.clientX, e.clientY);
				}
			};

			// 鼠标释放 - 结束拖动
			const handleMouseUp = () => {
				// 结束本地画布拖动
				if (canvasDragRef.current?.isDragging) {
					canvasDragRef.current = null;
					// 立即同步最终状态
					syncCamera(true);
				}

				// 结束 Token 拖动
				if (interactionRef.current?.drag) {
					interactionRef.current.endCurrentDrag();
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
			const minZoom = cam.minZoom ?? 0.3;
			const maxZoom = cam.maxZoom ?? 6;
			const zoomFactor = 1.15; // 优化的缩放比率

			// 根据用户设置翻转缩放方向
			const effectiveZoomFactor = zoomDirectionRef.current ? zoomFactor : 1 / zoomFactor;

			if (detail.action === "in") {
				zoomAnimationRef.current = {
					targetZoom: Math.min(maxZoom, cam.zoom * effectiveZoomFactor),
					targetCenterX: cam.centerX,
					targetCenterY: cam.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 200,
				};
			} else if (detail.action === "out") {
				zoomAnimationRef.current = {
					targetZoom: Math.max(minZoom, cam.zoom / effectiveZoomFactor),
					targetCenterX: cam.centerX,
					targetCenterY: cam.centerY,
					startZoom: cam.zoom,
					startCenterX: cam.centerX,
					startCenterY: cam.centerY,
					startTime: performance.now(),
					duration: 200,
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
					duration: 300,
				};
			}
		};

		// 监听缩放方向翻转事件
		const handleZoomDirectionEvent = (e: Event) => {
			const detail = (e as CustomEvent).detail as { inverted: boolean };
			zoomDirectionRef.current = detail.inverted;
		};

		window.addEventListener("game-zoom", handleZoomEvent as EventListener);
		window.addEventListener("game-zoom-direction", handleZoomDirectionEvent as EventListener);
		return () => {
			window.removeEventListener("game-zoom", handleZoomEvent as EventListener);
			window.removeEventListener("game-zoom-direction", handleZoomDirectionEvent as EventListener);

			// 清理相机同步定时器
			if (syncThrottleRef.current) {
				clearTimeout(syncThrottleRef.current);
				syncThrottleRef.current = null;
			}
		};
	}, []);

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			<div ref={canvasRef} style={{ width: "100%", height: "100%" }} />
		</div>
	);
};

export default GameCanvas;
