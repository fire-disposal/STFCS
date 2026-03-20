/**
 * 游戏地图组件
 *
 * 整合所有渲染层：
 * - PixiJS 画布
 * - Token 渲染
 * - 选中特效
 * - 信息浮动窗
 * - 坐标指示器
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Application, Container, FederatedPointerEvent } from 'pixi.js';
import type { TokenState } from '@vt/shared/room';
import type { Point } from '@vt/shared/types';
import { TokenRenderer, SelectionLayer, TokenInfoTooltip, CoordinateIndicator } from '../rendering';

// ==================== 样式 ====================

const styles = {
  container: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a12',
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
  },
};

// ==================== Props ====================

interface GameMapProps {
  /** Token 列表 */
  tokens: Record<string, TokenState>;
  /** 当前玩家 ID */
  currentPlayerId: string;
  /** 选中的 Token ID */
  selectedTokenId: string | null;
  /** 目标 Token ID 列表 */
  targetTokenIds?: string[];
  /** Token 点击回调 */
  onTokenClick?: (token: TokenState, event: FederatedPointerEvent) => void;
  /** Token 双击回调 */
  onTokenDoubleClick?: (token: TokenState) => void;
  /** Token 拖拽回调 */
  onTokenDrag?: (token: TokenState, position: Point) => void;
  /** 地图点击回调 */
  onMapClick?: (position: Point) => void;
  /** 玩家名称映射 */
  playerNames?: Record<string, string>;
}

// ==================== Component ====================

export const GameMap: React.FC<GameMapProps> = ({
  tokens,
  currentPlayerId,
  selectedTokenId,
  targetTokenIds = [],
  onTokenClick,
  onTokenDoubleClick,
  onTokenDrag,
  onMapClick,
  playerNames = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const tokenRenderersRef = useRef<Map<string, TokenRenderer>>(new Map());
  const selectionLayerRef = useRef<SelectionLayer | null>(null);

  // 状态
  const [hoveredToken, setHoveredToken] = useState<TokenState | null>(null);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [cameraPosition, setCameraPosition] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // 初始化 PixiJS
  useEffect(() => {
    if (!containerRef.current) return;

    const initApp = async () => {
      const app = new Application();
      await app.init({
        background: '#0a0a12',
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // 创建图层
      const worldContainer = new Container();
      worldContainer.sortableChildren = true;
      app.stage.addChild(worldContainer);

      // 创建选中特效层
      const selectionLayer = new SelectionLayer();
      worldContainer.addChild(selectionLayer.container);
      selectionLayerRef.current = selectionLayer;

      // 设置交互
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointermove', handlePointerMove);
      app.stage.on('pointerdown', handleStageClick);
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // 更新 Token 渲染
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const worldContainer = app.stage.children[0] as Container;
    if (!worldContainer) return;

    // 获取当前渲染的 Token IDs
    const currentIds = new Set(tokenRenderersRef.current.keys());
    const newIds = new Set(Object.keys(tokens));

    // 移除不再存在的 Token
    for (const [id, renderer] of tokenRenderersRef.current) {
      if (!newIds.has(id)) {
        renderer.destroy();
        tokenRenderersRef.current.delete(id);
      }
    }

    // 添加或更新 Token
    for (const [id, token] of Object.entries(tokens)) {
      let renderer = tokenRenderersRef.current.get(id);

      if (!renderer) {
        // 创建新渲染器
        renderer = new TokenRenderer(token, {
          showStatusBars: true,
          showName: true,
          showHeading: true,
          zoom,
        }, {
          onClick: (t, e) => {
            onTokenClick?.(t, e);
          },
          onDoubleClick: (t) => {
            onTokenDoubleClick?.(t);
          },
          onHover: (t) => {
            setHoveredToken(t);
          },
          onHoverEnd: () => {
            setHoveredToken(null);
          },
          onDrag: (t, pos) => {
            onTokenDrag?.(t, pos);
          },
        });

        worldContainer.addChild(renderer.container);
        tokenRenderersRef.current.set(id, renderer);
      } else {
        // 更新现有渲染器
        renderer.update(token);
      }

      // 更新选中状态
      renderer.setSelected(selectedTokenId === id);
    }
  }, [tokens, selectedTokenId, zoom]);

  // 更新目标标记
  useEffect(() => {
    const selectionLayer = selectionLayerRef.current;
    if (!selectionLayer) return;

    // 清除旧的目标标记
    selectionLayer.clearAll();

    // 添加选中
    if (selectedTokenId) {
      selectionLayer.addSelection({
        tokenId: selectedTokenId,
        type: 'selected',
      });
    }

    // 添加目标标记
    for (const targetId of targetTokenIds) {
      if (targetId !== selectedTokenId) {
        selectionLayer.addSelection({
          tokenId: targetId,
          type: 'target',
        });
      }
    }
  }, [selectedTokenId, targetTokenIds]);

  // 处理鼠标移动
  const handlePointerMove = useCallback((event: FederatedPointerEvent) => {
    const app = appRef.current;
    if (!app) return;

    const worldContainer = app.stage.children[0] as Container;
    const pos = event.global;

    // 转换为世界坐标
    const worldPos = worldContainer.toLocal(pos);
    setMousePosition({ x: worldPos.x, y: worldPos.y });
  }, []);

  // 处理舞台点击
  const handleStageClick = useCallback((event: FederatedPointerEvent) => {
    const app = appRef.current;
    if (!app) return;

    // 如果点击的是空白区域
    if (event.target === app.stage) {
      const worldContainer = app.stage.children[0] as Container;
      const pos = event.global;
      const worldPos = worldContainer.toLocal(pos);
      onMapClick?.({ x: worldPos.x, y: worldPos.y });
    }
  }, [onMapClick]);

  // 处理滚轮缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.25, Math.min(4, prev * delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 应用缩放
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const worldContainer = app.stage.children[0] as Container;
    if (worldContainer) {
      worldContainer.scale.set(zoom);
    }
  }, [zoom]);

  // 获取选中 Token 的朝向
  const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;
  const selectedHeading = selectedToken?.type === 'ship' ? selectedToken.heading : undefined;

  return (
    <div ref={containerRef} style={styles.container}>
      {/* PixiJS Canvas 在这里渲染 */}

      {/* 覆盖层 */}
      <div style={styles.overlay}>
        {/* 信息浮动窗 */}
        {hoveredToken && (
          <TokenInfoTooltip
            token={hoveredToken}
            position={mousePosition}
            controllerName={hoveredToken.controllingPlayerId ? playerNames[hoveredToken.controllingPlayerId] : undefined}
          />
        )}

        {/* 坐标指示器 */}
        <CoordinateIndicator
          mousePosition={mousePosition}
          cameraPosition={cameraPosition}
          zoom={zoom}
          selectedTokenHeading={selectedHeading}
        />
      </div>
    </div>
  );
};

export default GameMap;