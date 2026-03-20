/**
 * 选中特效层
 *
 * 提供选中、悬停、目标标记等视觉效果
 */

import { Container, Graphics, Filter, BlurFilter } from 'pixi.js';
import type { TokenState } from '@vt/shared/room';
import { SELECTION_COLORS, ANIMATION_CONFIG } from './config';

// ==================== 类型定义 ====================

/** 选中类型 */
export type SelectionType = 'selected' | 'hover' | 'target' | 'ally' | 'enemy';

/** 选中状态 */
export interface SelectionState {
  tokenId: string;
  type: SelectionType;
  pulsePhase?: number;
}

// ==================== SelectionLayer 类 ====================

export class SelectionLayer {
  private _container: Container;
  private _selections: Map<string, { graphics: Graphics; state: SelectionState }> = new Map();
  private _animationFrame: number | null = null;
  private _pulseTime: number = 0;

  constructor() {
    this._container = new Container();
    this._container.sortableChildren = true;
    this._startAnimation();
  }

  /** 获取容器 */
  get container(): Container {
    return this._container;
  }

  /** 添加选中 */
  addSelection(state: SelectionState): void {
    // 移除旧的
    this.removeSelection(state.tokenId);

    const graphics = new Graphics();
    this._selections.set(state.tokenId, { graphics, state });
    this._container.addChild(graphics);
    this._renderSelection(state.tokenId);
  }

  /** 移除选中 */
  removeSelection(tokenId: string): void {
    const selection = this._selections.get(tokenId);
    if (selection) {
      selection.graphics.destroy();
      this._selections.delete(tokenId);
    }
  }

  /** 更新选中类型 */
  updateSelectionType(tokenId: string, type: SelectionType): void {
    const selection = this._selections.get(tokenId);
    if (selection) {
      selection.state.type = type;
      this._renderSelection(tokenId);
    }
  }

  /** 清除所有选中 */
  clearAll(): void {
    for (const [tokenId] of this._selections) {
      this.removeSelection(tokenId);
    }
  }

  /** 销毁 */
  destroy(): void {
    this._stopAnimation();
    this.clearAll();
    this._container.destroy();
  }

  // ==================== 私有方法 ====================

  private _startAnimation(): void {
    const animate = () => {
      this._pulseTime += 16;
      this._updatePulse();
      this._animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  private _stopAnimation(): void {
    if (this._animationFrame !== null) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  private _updatePulse(): void {
    for (const [tokenId, { graphics, state }] of this._selections) {
      if (state.type === 'selected') {
        const pulse = Math.sin(this._pulseTime / ANIMATION_CONFIG.selection.pulseDuration * Math.PI * 2);
        graphics.alpha = 0.6 + pulse * 0.3;
      }
    }
  }

  private _renderSelection(tokenId: string): void {
    const selection = this._selections.get(tokenId);
    if (!selection) return;

    const { graphics, state } = selection;
    const color = SELECTION_COLORS[state.type];

    graphics.clear();

    // 绘制选中效果
    switch (state.type) {
      case 'selected':
        this._drawSelectedRing(graphics, color);
        break;
      case 'hover':
        this._drawHoverRing(graphics, color);
        break;
      case 'target':
        this._drawTargetMarker(graphics, color);
        break;
      case 'ally':
        this._drawAllyMarker(graphics, color);
        break;
      case 'enemy':
        this._drawEnemyMarker(graphics, color);
        break;
    }
  }

  private _drawSelectedRing(graphics: Graphics, color: number): void {
    const radius = 30;

    // 外圈
    graphics
      .circle(0, 0, radius)
      .stroke({ color, width: 3, alpha: 0.8 });

    // 虚线内圈
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2;
      const endAngle = ((i + 0.5) / segments) * Math.PI * 2;
      const innerRadius = radius - 8;

      graphics
        .moveTo(Math.cos(startAngle) * innerRadius, Math.sin(startAngle) * innerRadius)
        .arcTo(
          Math.cos((startAngle + endAngle) / 2) * innerRadius,
          Math.sin((startAngle + endAngle) / 2) * innerRadius,
          Math.cos(endAngle) * innerRadius,
          Math.sin(endAngle) * innerRadius,
          innerRadius
        )
        .stroke({ color, width: 1, alpha: 0.4 });
    }

    // 四角标记
    const corners = [
      { x: radius + 5, y: 0 },
      { x: -radius - 5, y: 0 },
      { x: 0, y: radius + 5 },
      { x: 0, y: -radius - 5 },
    ];

    for (const corner of corners) {
      graphics
        .moveTo(corner.x - 6, corner.y)
        .lineTo(corner.x + 6, corner.y)
        .moveTo(corner.x, corner.y - 6)
        .lineTo(corner.x, corner.y + 6)
        .stroke({ color, width: 2, alpha: 0.8 });
    }
  }

  private _drawHoverRing(graphics: Graphics, color: number): void {
    const radius = 28;

    graphics
      .circle(0, 0, radius)
      .stroke({ color, width: 2, alpha: 0.5 });

    // 简单的角标记
    const angle = Math.PI / 4;
    for (let i = 0; i < 4; i++) {
      const a = angle + (i * Math.PI / 2);
      graphics
        .moveTo(Math.cos(a) * (radius - 8), Math.sin(a) * (radius - 8))
        .lineTo(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 4))
        .stroke({ color, width: 2, alpha: 0.6 });
    }
  }

  private _drawTargetMarker(graphics: Graphics, color: number): void {
    const size = 25;

    // X 标记
    graphics
      .moveTo(-size, -size)
      .lineTo(size, size)
      .moveTo(size, -size)
      .lineTo(-size, size)
      .stroke({ color, width: 3, alpha: 0.8 });

    // 外圈
    graphics
      .circle(0, 0, size + 10)
      .stroke({ color, width: 2, alpha: 0.4 });
  }

  private _drawAllyMarker(graphics: Graphics, color: number): void {
    const size = 20;

    // 盾牌形状
    graphics
      .moveTo(0, -size)
      .lineTo(size, -size * 0.5)
      .lineTo(size, size * 0.3)
      .lineTo(0, size)
      .lineTo(-size, size * 0.3)
      .lineTo(-size, -size * 0.5)
      .closePath()
      .fill({ color, alpha: 0.3 })
      .stroke({ color, width: 2, alpha: 0.6 });
  }

  private _drawEnemyMarker(graphics: Graphics, color: number): void {
    const size = 15;

    // 菱形
    graphics
      .moveTo(0, -size)
      .lineTo(size, 0)
      .lineTo(0, size)
      .lineTo(-size, 0)
      .closePath()
      .fill({ color, alpha: 0.3 })
      .stroke({ color, width: 2, alpha: 0.6 });
  }
}

// ==================== 工厂函数 ====================

/** 创建选中特效层 */
export function createSelectionLayer(): SelectionLayer {
  return new SelectionLayer();
}