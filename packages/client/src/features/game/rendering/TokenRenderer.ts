/**
 * Token 渲染器
 *
 * 统一的 Token 渲染系统，支持：
 * - 舰船、空间站、小行星、残骸、目标
 * - 状态条（船体、护盾、辐能）
 * - 选中特效
 * - 悬停效果
 */

import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import type { TokenState, TokenType } from '@vt/shared/room';
import type { FactionId, Point, ArmorQuadrant } from '@vt/shared/types';
import {
  getFactionColor,
  getTokenTypeColor,
  getHullColor,
  getFluxColor,
  getArmorColor,
  STATUS_COLORS,
  UI_SIZES,
  ANIMATION_CONFIG,
  RENDER_LAYERS,
  colorToHex,
} from './config';

// ==================== 类型定义 ====================

/** Token 渲染选项 */
export interface TokenRenderOptions {
  /** 是否显示状态条 */
  showStatusBars?: boolean;
  /** 是否显示名称 */
  showName?: boolean;
  /** 是否显示坐标 */
  showCoordinates?: boolean;
  /** 是否显示朝向指示器 */
  showHeading?: boolean;
  /** 是否显示装甲象限 */
  showArmorQuadrants?: boolean;
  /** 缩放级别 */
  zoom?: number;
}

/** Token 交互回调 */
export interface TokenInteractionCallbacks {
  onClick?: (token: TokenState, event: FederatedPointerEvent) => void;
  onDoubleClick?: (token: TokenState, event: FederatedPointerEvent) => void;
  onHover?: (token: TokenState) => void;
  onHoverEnd?: (token: TokenState) => void;
  onDragStart?: (token: TokenState) => void;
  onDrag?: (token: TokenState, position: Point) => void;
  onDragEnd?: (token: TokenState, position: Point, cancelled: boolean) => void;
}

/** Token 渲染状态 */
export interface TokenRenderState {
  isSelected: boolean;
  isHovered: boolean;
  isTargeted: boolean;
  isDragging: boolean;
}

// ==================== TokenRenderer 类 ====================

export class TokenRenderer {
  private _container: Container;
  private _token: TokenState;
  private _options: TokenRenderOptions;
  private _callbacks: TokenInteractionCallbacks;
  private _state: TokenRenderState;

  // 子容器
  private _bodyContainer: Container;
  private _statusContainer: Container;
  private _selectionContainer: Container;
  private _labelContainer: Container;

  // 图形元素
  private _bodyGraphics: Graphics;
  private _selectionRing: Graphics;
  private _headingIndicator: Graphics;
  private _statusBars: Map<string, Graphics> = new Map();
  private _nameText: Text | null = null;
  private _coordText: Text | null = null;

  // 动画状态
  private _pulsePhase: number = 0;
  private _animationFrame: number | null = null;

  constructor(
    token: TokenState,
    options: TokenRenderOptions = {},
    callbacks: TokenInteractionCallbacks = {}
  ) {
    this._token = token;
    this._options = {
      showStatusBars: true,
      showName: true,
      showCoordinates: false,
      showHeading: true,
      showArmorQuadrants: false,
      zoom: 1,
      ...options,
    };
    this._callbacks = callbacks;
    this._state = {
      isSelected: false,
      isHovered: false,
      isTargeted: false,
      isDragging: false,
    };

    // 创建容器层级
    this._container = new Container();
    this._container.sortableChildren = true;

    this._selectionContainer = new Container();
    this._selectionContainer.zIndex = RENDER_LAYERS.SELECTION;

    this._bodyContainer = new Container();
    this._bodyContainer.zIndex = RENDER_LAYERS.SHIPS;

    this._statusContainer = new Container();
    this._statusContainer.zIndex = RENDER_LAYERS.UI;

    this._labelContainer = new Container();
    this._labelContainer.zIndex = RENDER_LAYERS.UI;

    this._container.addChild(this._selectionContainer);
    this._container.addChild(this._bodyContainer);
    this._container.addChild(this._statusContainer);
    this._container.addChild(this._labelContainer);

    // 创建图形元素
    this._bodyGraphics = new Graphics();
    this._selectionRing = new Graphics();
    this._headingIndicator = new Graphics();

    this._bodyContainer.addChild(this._bodyGraphics);
    this._selectionContainer.addChild(this._selectionRing);
    this._selectionContainer.addChild(this._headingIndicator);

    // 设置位置和交互
    this._container.x = token.position.x;
    this._container.y = token.position.y;
    this._container.eventMode = 'static';
    this._container.cursor = 'pointer';

    this._setupInteractions();
    this._render();
  }

  // ==================== 公共方法 ====================

  /** 获取容器 */
  get container(): Container {
    return this._container;
  }

  /** 获取 Token 数据 */
  get token(): TokenState {
    return this._token;
  }

  /** 更新 Token 数据 */
  update(token: TokenState): void {
    this._token = token;
    this._container.position.set(token.position.x, token.position.y);
    this._render();
  }

  /** 设置选中状态 */
  setSelected(selected: boolean): void {
    if (this._state.isSelected !== selected) {
      this._state.isSelected = selected;
      this._renderSelection();
      
      if (selected) {
        this._startPulseAnimation();
      } else {
        this._stopPulseAnimation();
      }
    }
  }

  /** 设置悬停状态 */
  setHovered(hovered: boolean): void {
    if (this._state.isHovered !== hovered) {
      this._state.isHovered = hovered;
      this._renderSelection();
    }
  }

  /** 设置目标状态 */
  setTargeted(targeted: boolean): void {
    if (this._state.isTargeted !== targeted) {
      this._state.isTargeted = targeted;
      this._renderSelection();
    }
  }

  /** 更新缩放 */
  setZoom(zoom: number): void {
    this._options.zoom = zoom;
    this._render();
  }

  /** 销毁 */
  destroy(): void {
    this._stopPulseAnimation();
    this._container.destroy({ children: true });
  }

  // ==================== 私有方法 ====================

  private _setupInteractions(): void {
    this._container.on('pointerdown', (event: FederatedPointerEvent) => {
      this._callbacks.onClick?.(this._token, event);
    });

    this._container.on('dblclick', (event: FederatedPointerEvent) => {
      this._callbacks.onDoubleClick?.(this._token, event);
    });

    this._container.on('pointerover', () => {
      this.setHovered(true);
      this._callbacks.onHover?.(this._token);
    });

    this._container.on('pointerout', () => {
      this.setHovered(false);
      this._callbacks.onHoverEnd?.(this._token);
    });
  }

  private _render(): void {
    this._renderBody();
    this._renderSelection();
    this._renderStatusBars();
    this._renderLabels();
  }

  private _renderBody(): void {
    const { type, faction, size, heading, isEnemy } = this._token;
    const factionColor = getFactionColor(faction);
    const typeColor = getTokenTypeColor(type);

    this._bodyGraphics.clear();

    // 根据类型绘制不同形状
    switch (type) {
      case 'ship':
        this._renderShipBody(factionColor, typeColor);
        break;
      case 'station':
        this._renderStationBody(factionColor, typeColor);
        break;
      case 'asteroid':
        this._renderAsteroidBody();
        break;
      case 'debris':
        this._renderDebrisBody();
        break;
      case 'objective':
        this._renderObjectiveBody();
        break;
    }

    // 应用旋转
    this._bodyContainer.rotation = heading * Math.PI / 180;
  }

  private _renderShipBody(
    factionColor: { primary: number; secondary: number },
    typeColor: { fill: number; stroke: number }
  ): void {
    const { size, isEnemy } = this._token;
    const halfSize = size / 2;

    // 敌方使用红色
    const fillColor = isEnemy ? 0xff4444 : factionColor.primary;
    const strokeColor = isEnemy ? 0xff6666 : 0xffffff;

    // 绘制舰船形状（三角形 + 尾部）
    this._bodyGraphics
      // 主体
      .moveTo(halfSize, 0)
      .lineTo(-halfSize * 0.6, -halfSize * 0.5)
      .lineTo(-halfSize * 0.3, 0)
      .lineTo(-halfSize * 0.6, halfSize * 0.5)
      .closePath()
      .fill({ color: fillColor, alpha: 0.8 })
      .stroke({ color: strokeColor, width: 2, alpha: 0.6 });

    // 引擎光效
    if (!this._token.isOverloaded) {
      this._bodyGraphics
        .circle(-halfSize * 0.4, 0, 4)
        .fill({ color: 0x00ffff, alpha: 0.6 });
    }
  }

  private _renderStationBody(
    factionColor: { primary: number; secondary: number },
    typeColor: { fill: number; stroke: number }
  ): void {
    const { size } = this._token;
    const radius = size / 2;

    // 绘制空间站（六边形）
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * Math.PI / 180;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    this._bodyGraphics
      .poly(points)
      .fill({ color: factionColor.primary, alpha: 0.7 })
      .stroke({ color: 0xffffff, width: 2, alpha: 0.5 });

    // 中心圆
    this._bodyGraphics
      .circle(0, 0, radius * 0.3)
      .fill({ color: 0x00ffff, alpha: 0.4 });
  }

  private _renderAsteroidBody(): void {
    const { size } = this._token;
    const radius = size / 2;

    // 不规则多边形模拟小行星
    const points: number[] = [];
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    this._bodyGraphics
      .poly(points)
      .fill({ color: 0x6b6b7a, alpha: 0.8 })
      .stroke({ color: 0x8a8a9a, width: 1, alpha: 0.5 });
  }

  private _renderDebrisBody(): void {
    const { size } = this._token;

    // 绘制残骸（不规则碎片）
    this._bodyGraphics
      .moveTo(0, -size / 3)
      .lineTo(size / 4, -size / 6)
      .lineTo(size / 3, size / 4)
      .lineTo(-size / 6, size / 3)
      .lineTo(-size / 3, 0)
      .closePath()
      .fill({ color: 0x4a4a5a, alpha: 0.6 })
      .stroke({ color: 0x6a6a7a, width: 1, alpha: 0.4 });
  }

  private _renderObjectiveBody(): void {
    const { size } = this._token;
    const radius = size / 2;

    // 绘制目标（菱形 + 圆环）
    this._bodyGraphics
      .moveTo(0, -radius)
      .lineTo(radius, 0)
      .lineTo(0, radius)
      .lineTo(-radius, 0)
      .closePath()
      .fill({ color: 0x44ff44, alpha: 0.3 })
      .stroke({ color: 0x44ff44, width: 2, alpha: 0.8 });

    // 脉冲圆环
    this._bodyGraphics
      .circle(0, 0, radius * 0.5)
      .stroke({ color: 0x44ff44, width: 1, alpha: 0.5 });
  }

  private _renderSelection(): void {
    const { size } = this._token;
    const { isSelected, isHovered, isTargeted } = this._state;

    this._selectionRing.clear();
    this._headingIndicator.clear();

    // 选中环
    if (isSelected || isHovered || isTargeted) {
      const radius = size / 2 + 10;
      let color = 0x00ffff;
      let alpha = 0.8;

      if (isTargeted) {
        color = 0xff4444;
      } else if (isHovered && !isSelected) {
        color = 0xffff00;
        alpha = 0.5;
      }

      // 虚线圆环
      this._selectionRing
        .circle(0, 0, radius)
        .stroke({ color, width: 2, alpha });

      // 四角标记
      const corners = [
        { x: radius, y: 0 },
        { x: -radius, y: 0 },
        { x: 0, y: radius },
        { x: 0, y: -radius },
      ];

      for (const corner of corners) {
        this._selectionRing
          .moveTo(corner.x - 8, corner.y)
          .lineTo(corner.x + 8, corner.y)
          .moveTo(corner.x, corner.y - 8)
          .lineTo(corner.x, corner.y + 8)
          .stroke({ color, width: 2, alpha });
      }
    }

    // 朝向指示器
    if (this._options.showHeading && this._token.type === 'ship') {
      const length = size / 2 + 20;
      this._headingIndicator
        .moveTo(size / 2, 0)
        .lineTo(length, 0)
        .stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });

      // 箭头
      this._headingIndicator
        .moveTo(length, 0)
        .lineTo(length - 8, -4)
        .moveTo(length, 0)
        .lineTo(length - 8, 4)
        .stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });
    }
  }

  private _renderStatusBars(): void {
    if (!this._options.showStatusBars || this._token.type !== 'ship') {
      return;
    }

    const { hull, maxHull, shield, maxShield, flux, maxFlux, isShieldOn, isOverloaded } = this._token;
    const { width, height, gap } = UI_SIZES.statusBar;
    const y = this._token.size / 2 + 15;

    this._statusContainer.removeChildren();

    // 船体条
    this._renderStatusBar('hull', hull / maxHull, getHullColor(hull / maxHull), 0, y);

    // 护盾条
    if (maxShield > 0) {
      const shieldColor = isShieldOn ? STATUS_COLORS.shield.active : STATUS_COLORS.shield.inactive;
      this._renderStatusBar('shield', shield / maxShield, shieldColor, 0, y + height + gap);
    }

    // 辐能条
    this._renderStatusBar('flux', flux / maxFlux, getFluxColor(flux / maxFlux, isOverloaded), 0, y + (height + gap) * 2);
  }

  private _renderStatusBar(id: string, percentage: number, color: number, x: number, y: number): void {
    const { width, height } = UI_SIZES.statusBar;
    const bar = new Graphics();

    // 背景
    bar.rect(x - width / 2, y, width, height)
      .fill({ color: STATUS_COLORS.hull.background, alpha: 0.8 });

    // 填充
    const fillWidth = width * Math.max(0, Math.min(1, percentage));
    bar.rect(x - width / 2, y, fillWidth, height)
      .fill({ color, alpha: 0.9 });

    // 边框
    bar.rect(x - width / 2, y, width, height)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.3 });

    this._statusContainer.addChild(bar);
    this._statusBars.set(id, bar);
  }

  private _renderLabels(): void {
    this._labelContainer.removeChildren();

    // 名称
    if (this._options.showName && this._token.name) {
      const style = new TextStyle({
        fontSize: 11,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 2 },
        align: 'center',
      });

      this._nameText = new Text({ text: this._token.name, style });
      this._nameText.anchor.set(0.5, 0);
      this._nameText.y = -this._token.size / 2 - 20;
      this._labelContainer.addChild(this._nameText);
    }

    // 坐标
    if (this._options.showCoordinates) {
      const coordText = `(${Math.round(this._token.position.x)}, ${Math.round(this._token.position.y)})`;
      const style = new TextStyle({
        fontSize: 9,
        fill: 0x888888,
        align: 'center',
      });

      this._coordText = new Text({ text: coordText, style });
      this._coordText.anchor.set(0.5, 0);
      this._coordText.y = this._token.size / 2 + 45;
      this._labelContainer.addChild(this._coordText);
    }
  }

  private _startPulseAnimation(): void {
    const animate = () => {
      this._pulsePhase += 0.05;
      const scale = 1 + Math.sin(this._pulsePhase) * ANIMATION_CONFIG.selection.pulseScale;
      this._selectionContainer.scale.set(scale);
      this._animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  private _stopPulseAnimation(): void {
    if (this._animationFrame !== null) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    this._selectionContainer.scale.set(1);
  }
}