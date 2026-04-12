import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Application } from "@pixi/react";
import { Container, Graphics, Text, TextStyle, Rectangle } from "pixi.js";
import type { ShipState } from "@vt/contracts";
import { StarfieldGenerator } from "@/features/game/rendering/StarfieldBackground";
import { useSelectionStore } from "@/store/selectionStore";
import { useUIStore } from "@/store/uiStore";

interface GameCanvasProps {
  ships: ShipState[];
  width?: number;
  height?: number;
  zoom: number;
  cameraX: number;
  cameraY: number;
  showGrid: boolean;
  selectedShipId?: string | null;
  onSelectShip?: (shipId: string) => void;
  onPanDelta?: (deltaX: number, deltaY: number) => void;
  onRotateDelta?: (delta: number) => void;
  showWeaponArcs?: boolean;
  showMovementRange?: boolean;
  showBackground?: boolean;
  onClick?: (x: number, y: number) => void;
  viewRotation?: number; // 视图旋转角度
}

type LayerRegistry = {
  world: Container;
  background: Container;
  starfieldDeep: Container;      // 深层星空
  starfieldMid: Container;       // 中层星空
  starfieldNear: Container;      // 浅层星空
  starfieldNebula: Container;    // 银河星云
  grid: Container;
  ships: Container;
  labels: Container;
  effects: Container;
  weaponArcs: Container;
};

const labelStyle = new TextStyle({
  fill: 0xcfe8ff,
  fontSize: 11,
  fontFamily: "Arial",
  stroke: { color: 0x10263e, width: 2 },
});

// 星空背景生成器（使用 useMemo 缓存）
const useStarfield = () => {
  return useMemo(() => new StarfieldGenerator({
    deepStars: 1000,
    midStars: 300,
    nearStars: 80,
    range: 10000,
    parallaxStrength: 0.6,
    enableNebula: true,
    nebulaCount: 4,
    nebulaOpacity: 0.12,
  }), []);
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  ships,
  width = 980,
  height = 620,
  zoom,
  cameraX,
  cameraY,
  showGrid,
  selectedShipId,
  onSelectShip,
  onPanDelta,
  onRotateDelta,
  showWeaponArcs = false,
  showMovementRange = false,
  showBackground = true,
  onClick,
  viewRotation = 0,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<LayerRegistry | null>(null);
  const starfield = useStarfield();
  const { 
    selectShip: storeSelectShip, 
    setMouseWorldPosition,
    handleClick,
  } = useSelectionStore();
  const { setZoom, setCameraPosition } = useUIStore();
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const cameraRef = useRef({ cameraX, cameraY, zoom, viewRotation });
  const onClickRef = useRef(onClick);
  const onPanDeltaRef = useRef(onPanDelta);
  const onRotateDeltaRef = useRef(onRotateDelta);
  const spacePressedRef = useRef(false);
  const zoomAnimationRef = useRef<number | null>(null);
  const zoomTargetRef = useRef<{ zoom: number; cameraX: number; cameraY: number } | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    mode: 'pan' | 'rotate' | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    pendingDx: number;
    pendingDy: number;
    pendingRotate: number;
    rafId: number | null;
  }>({
    active: false,
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    pendingDx: 0,
    pendingDy: 0,
    pendingRotate: 0,
    rafId: null,
  });

  const clampZoom = useCallback((value: number) => {
    return Math.max(0.5, Math.min(3, value));
  }, []);

  const screenDeltaToWorldDelta = useCallback((deltaX: number, deltaY: number) => {
    const { zoom: currentZoom, viewRotation: currentRotation } = cameraRef.current;
    const theta = (currentRotation * Math.PI) / 180;
    const cos = Math.cos(-theta);
    const sin = Math.sin(-theta);
    const scaledX = -deltaX / currentZoom;
    const scaledY = -deltaY / currentZoom;

    return {
      x: scaledX * cos - scaledY * sin,
      y: scaledX * sin + scaledY * cos,
    };
  }, []);
  const canvasWidth = width;
  const canvasHeight = height;

  const screenToWorldPoint = useCallback((screenX: number, screenY: number, zoomValue: number, cameraXValue: number, cameraYValue: number, rotationValue: number) => {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const relativeX = screenX - centerX;
    const relativeY = screenY - centerY;
    const theta = (rotationValue * Math.PI) / 180;
    const cos = Math.cos(-theta);
    const sin = Math.sin(-theta);
    const worldDeltaX = (relativeX * cos - relativeY * sin) / zoomValue;
    const worldDeltaY = (relativeX * sin + relativeY * cos) / zoomValue;

    return {
      x: cameraXValue + worldDeltaX,
      y: cameraYValue + worldDeltaY,
    };
  }, [canvasWidth, canvasHeight]);

  const animateZoomToTarget = useCallback(() => {
    const target = zoomTargetRef.current;
    if (!target) {
      zoomAnimationRef.current = null;
      return;
    }

    const current = cameraRef.current;
    const zoomDiff = target.zoom - current.zoom;
    const cameraXDiff = target.cameraX - current.cameraX;
    const cameraYDiff = target.cameraY - current.cameraY;

    if (Math.abs(zoomDiff) < 0.001 && Math.abs(cameraXDiff) < 0.05 && Math.abs(cameraYDiff) < 0.05) {
      setZoom(target.zoom);
      setCameraPosition(target.cameraX, target.cameraY);
      zoomTargetRef.current = null;
      zoomAnimationRef.current = null;
      return;
    }

    const nextZoom = clampZoom(current.zoom + zoomDiff * 0.18);
    const nextCameraX = current.cameraX + cameraXDiff * 0.18;
    const nextCameraY = current.cameraY + cameraYDiff * 0.18;

    setZoom(nextZoom);
    setCameraPosition(nextCameraX, nextCameraY);
    zoomAnimationRef.current = requestAnimationFrame(animateZoomToTarget);
  }, [clampZoom, setCameraPosition, setZoom]);

  const queueZoom = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const wheelStrength = event.deltaMode === 1 ? 0.09 : event.deltaMode === 2 ? 0.18 : 0.0016;
    const zoomFactor = Math.exp(-event.deltaY * wheelStrength);
    const current = cameraRef.current;
    const nextZoom = clampZoom(current.zoom * zoomFactor);
    const worldPoint = screenToWorldPoint(screenX, screenY, current.zoom, current.cameraX, current.cameraY, current.viewRotation);

    const centerX = width / 2;
    const centerY = height / 2;
    const relativeX = screenX - centerX;
    const relativeY = screenY - centerY;
    const theta = (current.viewRotation * Math.PI) / 180;
    const cos = Math.cos(-theta);
    const sin = Math.sin(-theta);
    const newWorldDeltaX = (relativeX * cos - relativeY * sin) / nextZoom;
    const newWorldDeltaY = (relativeX * sin + relativeY * cos) / nextZoom;

    zoomTargetRef.current = {
      zoom: nextZoom,
      cameraX: worldPoint.x - newWorldDeltaX,
      cameraY: worldPoint.y - newWorldDeltaY,
    };

    if (zoomAnimationRef.current !== null) {
      cancelAnimationFrame(zoomAnimationRef.current);
    }
    zoomAnimationRef.current = requestAnimationFrame(animateZoomToTarget);
  }, [animateZoomToTarget, clampZoom, screenToWorldPoint]);

  const flushDragDelta = useCallback(() => {
    const dragState = dragStateRef.current;
    if (dragState.rafId !== null) {
      cancelAnimationFrame(dragState.rafId);
      dragState.rafId = null;
    }

    if (dragState.pendingDx === 0 && dragState.pendingDy === 0) {
      if (dragState.pendingRotate === 0) {
        return;
      }
    }

    const delta = screenDeltaToWorldDelta(dragState.pendingDx, dragState.pendingDy);
    const rotateDelta = dragState.pendingRotate;
    dragState.pendingDx = 0;
    dragState.pendingDy = 0;
    dragState.pendingRotate = 0;
    if (delta.x !== 0 || delta.y !== 0) {
      onPanDeltaRef.current?.(delta.x, delta.y);
    }
    if (rotateDelta !== 0) {
      onRotateDeltaRef.current?.(rotateDelta);
    }
  }, [screenDeltaToWorldDelta]);

  useEffect(() => {
    cameraRef.current = { cameraX, cameraY, zoom, viewRotation };
  }, [cameraX, cameraY, zoom, viewRotation]);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    onPanDeltaRef.current = onPanDelta;
  }, [onPanDelta]);

  useEffect(() => {
    onRotateDeltaRef.current = onRotateDelta;
  }, [onRotateDelta]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    node.addEventListener('wheel', queueZoom, { passive: false });

    return () => {
      node.removeEventListener('wheel', queueZoom);
    };
  }, [queueZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = true;
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = false;
      }
    };

    const handleBlur = () => {
      spacePressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const scheduleDragFlush = useCallback(() => {
    const dragState = dragStateRef.current;
    if (dragState.rafId !== null) {
      return;
    }

    dragState.rafId = requestAnimationFrame(() => {
      dragState.rafId = null;
      flushDragDelta();
    });
  }, [flushDragDelta]);

  // 动画循环 - 更新星空闪烁
  useEffect(() => {
    if (!layers || !starfield) return;

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // 限制最大 deltaTime 避免跳跃
      const safeDelta = Math.min(deltaTime, 0.1);
      
      starfield.update(safeDelta);

      // 重新绘制星空（只更新闪烁，不重新计算位置）
      if (layers.starfieldDeep.children[0]) {
        const graphics = layers.starfieldDeep.children[0] as Graphics;
        graphics.clear();
        starfield.drawDeepStars(graphics, 0, 0);
      }
      if (layers.starfieldMid.children[0]) {
        const graphics = layers.starfieldMid.children[0] as Graphics;
        graphics.clear();
        starfield.drawMidStars(graphics, 0, 0);
      }
      if (layers.starfieldNear.children[0]) {
        const graphics = layers.starfieldNear.children[0] as Graphics;
        graphics.clear();
        starfield.drawNearStars(graphics, 0, 0);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [layers, starfield]);

  useEffect(() => {
    if (!layers) return;

    layers.world.scale.set(zoom);
    layers.world.position.set(
      canvasWidth * 0.5 - cameraX * zoom,
      canvasHeight * 0.5 - cameraY * zoom,
    );
          
    // 应用视图旋转
    layers.world.rotation = (viewRotation * Math.PI / 180);
    layers.background.visible = showBackground;
    layers.starfieldNebula.visible = showBackground;
    layers.starfieldDeep.visible = showBackground;
    layers.starfieldMid.visible = showBackground;
    layers.starfieldNear.visible = showBackground;

    // 更新星空背景的视差效果（不受 zoom 影响）
    const parallaxFactor = 0.5;
    layers.starfieldDeep.position.set(
      -cameraX * parallaxFactor * 0.3,
      -cameraY * parallaxFactor * 0.3,
    );
    layers.starfieldMid.position.set(
      -cameraX * parallaxFactor * 0.5,
      -cameraY * parallaxFactor * 0.5,
    );
    layers.starfieldNear.position.set(
      -cameraX * parallaxFactor * 0.8,
      -cameraY * parallaxFactor * 0.8,
    );
    layers.starfieldNebula.position.set(
      -cameraX * parallaxFactor * 0.2,
      -cameraY * parallaxFactor * 0.2,
    );
  }, [layers, zoom, cameraX, cameraY, canvasWidth, canvasHeight, viewRotation, showBackground]);

  // 初始渲染星空背景（位置在上面的动画循环中更新）
  useEffect(() => {
    if (!layers || !starfield) return;

    // 绘制银河星云（静态，不闪烁）
    layers.starfieldNebula.removeChildren();
    const nebulaGraphics = new Graphics();
    starfield.drawNebula(nebulaGraphics, 0, 0);
    layers.starfieldNebula.addChild(nebulaGraphics);

    // 绘制深层星空
    layers.starfieldDeep.removeChildren();
    const deepGraphics = new Graphics();
    starfield.drawDeepStars(deepGraphics, 0, 0);
    layers.starfieldDeep.addChild(deepGraphics);

    // 绘制中层星空
    layers.starfieldMid.removeChildren();
    const midGraphics = new Graphics();
    starfield.drawMidStars(midGraphics, 0, 0);
    layers.starfieldMid.addChild(midGraphics);

    // 绘制浅层星空
    layers.starfieldNear.removeChildren();
    const nearGraphics = new Graphics();
    starfield.drawNearStars(nearGraphics, 0, 0);
    layers.starfieldNear.addChild(nearGraphics);
  }, [layers, starfield]);

  useEffect(() => {
    if (!layers) return;

    layers.grid.removeChildren();
    if (!showGrid) return;

    const grid = new Graphics();
    const gridSize = 100;
    const half = 3000;

    for (let x = -half; x <= half; x += gridSize) {
      const isAxis = x === 0;
      grid
        .moveTo(x, -half)
        .lineTo(x, half)
        .stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
    }

    for (let y = -half; y <= half; y += gridSize) {
      const isAxis = y === 0;
      grid
        .moveTo(-half, y)
        .lineTo(half, y)
        .stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
    }

    layers.grid.addChild(grid);
  }, [layers, showGrid]);

  useEffect(() => {
    return () => {
      const dragState = dragStateRef.current;
      if (dragState.rafId !== null) {
        cancelAnimationFrame(dragState.rafId);
      }
      if (zoomAnimationRef.current !== null) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!layers) return;

    layers.ships.removeChildren();
    layers.labels.removeChildren();

    for (const ship of ships) {
      const token = new Graphics();
      const isSelected = ship.id === selectedShipId;
      const color = ship.faction === "player" ? 0x43c1ff : 0xff6f8f;
      const radius = 20;

      token
        .poly([
          0,
          -radius,
          radius * 0.7,
          radius,
          0,
          radius * 0.45,
          -radius * 0.7,
          radius,
        ])
        .fill({ color, alpha: 0.88 })
        .stroke({
          color: isSelected ? 0xffffff : 0x10263e,
          alpha: isSelected ? 0.95 : 0.7,
          width: isSelected ? 3 : 2,
        });

      token.position.set(ship.transform.x, ship.transform.y);
      token.rotation = (ship.transform.heading * Math.PI) / 180;
      token.eventMode = "static";
      token.cursor = "pointer";
      
      // 点击选择处理
      token.on("pointertap", (e) => {
        const isDoubleClick = handleClick(e.data.global.x, e.data.global.y);
        if (isDoubleClick) {
          // 双击：强制选择
          storeSelectShip(ship.id);
          onSelectShip?.(ship.id);
        } else {
          // 单击：切换选择
          if (isSelected) {
            // 取消选择时不传递 null，而是传递空字符串或不处理
            // 这里我们保持选中状态，让用户通过其他方式取消
          } else {
            storeSelectShip(ship.id);
            onSelectShip?.(ship.id);
          }
        }
      });
      
      // 鼠标移动时更新世界坐标
      token.on("pointermove", (e) => {
        const worldX = (e.data.global.x - canvasWidth / 2) / zoom + cameraX;
        const worldY = (e.data.global.y - canvasHeight / 2) / zoom + cameraY;
        setMouseWorldPosition(worldX, worldY);
      });

      const hpPercent = Math.max(0, Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0));
      const hpBg = new Graphics();
      hpBg
        .rect(-24, radius + 8, 48, 5)
        .fill({ color: 0x000000, alpha: 0.45 })
        .rect(-24, radius + 8, 48 * hpPercent, 5)
        .fill({ color: 0x3ddb6f, alpha: 0.95 });
      token.addChild(hpBg);

      const label = new Text({
        text: `${ship.id.slice(-6)}  F:${Math.round(ship.fluxHard + ship.fluxSoft)}/${Math.round(ship.fluxMax)}`,
        style: labelStyle,
      });
      label.anchor.set(0.5, 1);
      label.position.set(ship.transform.x, ship.transform.y - radius - 8);

      layers.ships.addChild(token);
      layers.labels.addChild(label);
    }
  }, [layers, ships, selectedShipId, onSelectShip]);

  // 绘制武器射界
  useEffect(() => {
    if (!layers || !showWeaponArcs || !selectedShipId) {
      layers?.weaponArcs?.removeChildren();
      return;
    }

    layers.weaponArcs.removeChildren();

    const selectedShip = ships.find(s => s.id === selectedShipId);
    if (!selectedShip) return;

    // 绘制选中舰船的武器射界
    selectedShip.weapons.forEach((weaponSlot, weaponId) => {
      // 从预设获取武器数据
      const weaponArc = 90; // 默认射界
      const weaponRange = weaponSlot.range || 300;
      
      const arcGraphics = new Graphics();
      const arcRad = (weaponArc * Math.PI) / 180;
      const baseAngle = ((selectedShip.transform.heading - 90) * Math.PI) / 180;
      const startAngle = baseAngle - arcRad / 2;
      const endAngle = baseAngle + arcRad / 2;

      // 扇形填充
      arcGraphics.moveTo(0, 0);
      for (let angle = startAngle; angle <= endAngle; angle += 0.05) {
        const x = Math.cos(angle) * weaponRange;
        const y = Math.sin(angle) * weaponRange;
        arcGraphics.lineTo(x, y);
      }
      arcGraphics.lineTo(0, 0);
      arcGraphics.fill({ color: 0xff6b35, alpha: 0.15 });

      // 扇形边框
      arcGraphics.stroke({ color: 0xff6b35, alpha: 0.6, width: 1 });

      // 射程标记圈
      arcGraphics.circle(0, 0, weaponRange);
      arcGraphics.stroke({ color: 0xffa500, alpha: 0.3, width: 1 });

      arcGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
      layers.weaponArcs.addChild(arcGraphics);
    });

    // 绘制机动范围（如果启用）
    if (showMovementRange) {
      const moveGraphics = new Graphics();
      const maxSpeed = selectedShip.maxSpeed || 100;
      const maxMoveDistance = maxSpeed * 4; // 两阶段各最大 2X

      moveGraphics.circle(0, 0, maxMoveDistance);
      moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.4, width: 2 });
      moveGraphics.fill({ color: 0x4a9eff, alpha: 0.05 });
      moveGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
      layers.weaponArcs.addChild(moveGraphics);
    }
  }, [layers, ships, selectedShipId, showWeaponArcs, showMovementRange]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: canvasHeight,
        border: '2px solid rgba(74, 158, 255, 0.3)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(6, 16, 26, 0.85)',
        boxShadow: '0 0 28px rgba(74, 158, 255, 0.12)',
      }}
    >
      <Application
        resizeTo={hostRef}
        autoDensity
        antialias
        background={0x06101a}
        eventMode="static"
        onInit={(app) => {
          const world = new Container();
          world.sortableChildren = true;

          // 背景层（星空）
          const background = new Container();
          background.zIndex = 0;

          // 星空各层（按深度排序，最远的先绘制）
          const starfieldNebula = new Container();     // 银河星云（最远）
          starfieldNebula.zIndex = 0;
          
          const starfieldDeep = new Container();       // 深层星空
          starfieldDeep.zIndex = 1;
          
          const starfieldMid = new Container();        // 中层星空
          starfieldMid.zIndex = 2;
          
          const starfieldNear = new Container();       // 浅层星空（最近）
          starfieldNear.zIndex = 3;

          // 网格层
          const grid = new Container();
          grid.zIndex = 4;

          // 舰船层
          const shipsLayer = new Container();
          shipsLayer.zIndex = 5;

          // 标签层
          const labels = new Container();
          labels.zIndex = 6;

          // 效果层
          const effects = new Container();
          effects.zIndex = 7;

          // 武器射界层（在舰船之上）
          const weaponArcsLayer = new Container();
          weaponArcsLayer.zIndex = 8;

          // 添加到世界容器
          world.addChild(
            background,
            starfieldNebula,
            starfieldDeep,
            starfieldMid,
            starfieldNear,
            grid,
            shipsLayer,
            labels,
            effects,
            weaponArcsLayer
          );
          app.stage.addChild(world);

          setLayers({ 
            world, 
            background, 
            starfieldNebula,
            starfieldDeep, 
            starfieldMid, 
            starfieldNear,
            grid, 
            ships: shipsLayer, 
            labels, 
            effects, 
            weaponArcs: weaponArcsLayer 
          });

          app.stage.eventMode = 'static';
          app.stage.hitArea = new Rectangle(0, 0, canvasWidth, canvasHeight);
          app.stage.cursor = 'grab';

          const getWorldPoint = (event: any) => {
            const { cameraX: currentCameraX, cameraY: currentCameraY, zoom: currentZoom, viewRotation: currentRotation } = cameraRef.current;
            const screenX = typeof event.global?.x === 'number' ? event.global.x : event.clientX;
            const screenY = typeof event.global?.y === 'number' ? event.global.y : event.clientY;
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const relativeX = screenX - centerX;
            const relativeY = screenY - centerY;
            const theta = (currentRotation * Math.PI) / 180;
            const cos = Math.cos(-theta);
            const sin = Math.sin(-theta);
            const worldDeltaX = (relativeX * cos - relativeY * sin) / currentZoom;
            const worldDeltaY = (relativeX * sin + relativeY * cos) / currentZoom;
            return {
              x: currentCameraX + worldDeltaX,
              y: currentCameraY + worldDeltaY,
            };
          };

          app.stage.on('pointerdown', (event: any) => {
            const target = event.target;
            const button = event.button ?? event.data?.button ?? 0;
            const dragState = dragStateRef.current;

            if (button === 2) {
              return;
            }

            if (button === 1) {
              dragState.active = true;
              dragState.mode = 'rotate';
              dragState.startX = event.global?.x ?? event.clientX ?? 0;
              dragState.startY = event.global?.y ?? event.clientY ?? 0;
              dragState.lastX = dragState.startX;
              dragState.lastY = dragState.startY;
              dragState.moved = false;
              app.stage.cursor = 'grabbing';
              return;
            }

            if (!spacePressedRef.current && target !== app.stage) {
              return;
            }

            dragState.active = true;
            dragState.mode = 'pan';
            dragState.startX = event.global?.x ?? event.clientX ?? 0;
            dragState.startY = event.global?.y ?? event.clientY ?? 0;
            dragState.lastX = dragState.startX;
            dragState.lastY = dragState.startY;
            dragState.moved = false;
            app.stage.cursor = 'grabbing';
          });

          app.stage.on('pointermove', (event: any) => {
            const worldPoint = getWorldPoint(event);
            setMouseWorldPosition(worldPoint.x, worldPoint.y);

            app.stage.cursor = spacePressedRef.current ? 'grab' : 'default';

            const dragState = dragStateRef.current;
            if (!dragState.active) {
              return;
            }

            const currentX = event.global?.x ?? event.clientX ?? dragState.lastX;
            const currentY = event.global?.y ?? event.clientY ?? dragState.lastY;
            const dx = currentX - dragState.lastX;
            const dy = currentY - dragState.lastY;

            if (Math.abs(currentX - dragState.startX) > 3 || Math.abs(currentY - dragState.startY) > 3) {
              dragState.moved = true;
            }

            dragState.lastX = currentX;
            dragState.lastY = currentY;
            if (dragState.mode === 'rotate') {
              dragState.pendingRotate += dx * 0.25;
            } else {
              dragState.pendingDx += dx;
              dragState.pendingDy += dy;
            }
            scheduleDragFlush();
          });

          const finishDrag = (event: any) => {
            const dragState = dragStateRef.current;

            if (dragState.active && dragState.mode === 'pan' && !dragState.moved) {
              const worldPoint = getWorldPoint(event);
              onClickRef.current?.(Math.round(worldPoint.x), Math.round(worldPoint.y));
            }

            dragState.active = false;
            dragState.mode = null;
            dragState.moved = false;
            dragState.pendingDx = 0;
            dragState.pendingDy = 0;
            dragState.pendingRotate = 0;
            flushDragDelta();
            app.stage.cursor = spacePressedRef.current ? 'grab' : 'default';
          };

          app.stage.on('pointerup', finishDrag);
          app.stage.on('pointerupoutside', finishDrag);
        }}
      />
    </div>
  );
};

  export default GameCanvas;
