/**
 * 舰船几何体渲染器
 *
 * 当素材缺失时，使用几何体绘制舰船
 * 采用简洁的示波器风格设计
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { HullSize, DamageType } from '@vt/shared/config';
import type { ShipTokenV2 } from '@vt/shared/types';
import {
  drawShipGeometry,
  drawShieldGeometry,
  drawArmorQuadrantGeometry,
  drawStatusBar,
  drawDashedCircle,
  HULL_SIZE_COLORS,
  DAMAGE_TYPE_COLORS,
  STATUS_COLORS,
  type ShipGeometryConfig,
  type ShieldGeometryConfig,
  type ArmorQuadrantGeometryConfig,
} from './GeometryRenderer';

// ==================== 配置 ====================

/** 渲染选项 */
export interface ShipGeometryRenderOptions {
  /** 是否显示护盾 */
  showShield?: boolean;
  /** 是否显示护甲象限 */
  showArmorQuadrants?: boolean;
  /** 是否显示状态条 */
  showStatusBars?: boolean;
  /** 是否显示名称标签 */
  showLabel?: boolean;
  /** 是否显示朝向指示 */
  showHeading?: boolean;
  /** 是否显示武器挂载点 */
  showWeaponMounts?: boolean;
  /** 是否选中 */
  isSelected?: boolean;
  /** 缩放比例 */
  scale?: number;
  /** 自定义颜色 */
  customColor?: number;
}

/** 默认渲染选项 */
const DEFAULT_OPTIONS: ShipGeometryRenderOptions = {
  showShield: true,
  showArmorQuadrants: false,
  showStatusBars: true,
  showLabel: true,
  showHeading: true,
  showWeaponMounts: false,
  isSelected: false,
  scale: 1,
};

// ==================== 主渲染函数 ====================

/**
 * 渲染舰船几何体
 */
export function renderShipGeometry(
  token: ShipTokenV2,
  options: ShipGeometryRenderOptions = {}
): Container {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const container = new Container();

  // 旋转容器（包含舰船主体）
  const rotationContainer = new Container();
  rotationContainer.rotation = (token.heading * Math.PI) / 180;
  container.addChild(rotationContainer);

  // 绘制舰船主体
  const shipGraphics = new Graphics();
  drawShipGeometry(shipGraphics, {
    size: token.hullSize,
    collisionRadius: token.visual.collisionRadius,
    color: opts.customColor ?? HULL_SIZE_COLORS[token.hullSize],
    alpha: 0.9,
    lineWidth: 2,
    showDetails: true,
  });
  rotationContainer.addChild(shipGraphics);

  // 绘制护盾
  if (opts.showShield && token.shield.type !== 'NONE') {
    const shieldGraphics = new Graphics();
    drawShieldGeometry(shieldGraphics, {
      type: token.shield.type,
      radius: token.shield.radius,
      coverageAngle: token.shield.coverageAngle,
      active: token.shield.active,
      efficiency: token.shield.efficiency,
    });
    rotationContainer.addChild(shieldGraphics);
  }

  // 绘制护甲象限
  if (opts.showArmorQuadrants) {
    const armorGraphics = new Graphics();
    drawArmorQuadrantGeometry(armorGraphics, {
      radius: token.visual.collisionRadius,
      quadrants: token.armor.quadrants,
      maxArmor: token.armor.maxPerQuadrant,
    });
    rotationContainer.addChild(armorGraphics);
  }

  // 绘制武器挂载点
  if (opts.showWeaponMounts) {
    const mountsGraphics = renderWeaponMounts(token);
    rotationContainer.addChild(mountsGraphics);
  }

  // 绘制状态条（不旋转）
  if (opts.showStatusBars) {
    const statusBars = renderStatusBars(token);
    container.addChild(statusBars);
  }

  // 绘制朝向指示器
  if (opts.showHeading) {
    const headingIndicator = renderHeadingIndicator(token);
    rotationContainer.addChild(headingIndicator);
  }

  // 绘制名称标签
  if (opts.showLabel) {
    const label = renderNameLabel(token);
    container.addChild(label);
  }

  // 选中高亮
  if (opts.isSelected) {
    const selectionGraphics = new Graphics();
    drawDashedCircle(
      selectionGraphics,
      0, 0,
      token.visual.collisionRadius + 10,
      0x00ff88,
      0.8
    );
    container.addChild(selectionGraphics);
  }

  // 应用缩放
  if (opts.scale !== 1) {
    container.scale.set(opts.scale);
  }

  return container;
}

// ==================== 子组件渲染 ====================

/**
 * 渲染武器挂载点
 */
function renderWeaponMounts(token: ShipTokenV2): Graphics {
  const graphics = new Graphics();
  const mounts = Object.values(token.weapons.mounts);

  for (const mount of mounts) {
    const { position, facing, arc } = mount;

    // 挂载点位置
    graphics.circle(position.x, position.y, 4);
    graphics.fill({ color: 0xffffff, alpha: 0.5 });

    // 射界指示（简化）
    if (arc > 0) {
      const arcRad = (arc * Math.PI) / 180;
      const facingRad = (facing * Math.PI) / 180;
      const range = 30; // 简化的射界指示长度

      graphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });
      graphics.moveTo(position.x, position.y);
      graphics.lineTo(
        position.x + Math.cos(facingRad - arcRad / 2) * range,
        position.y + Math.sin(facingRad - arcRad / 2) * range
      );
      graphics.stroke();

      graphics.moveTo(position.x, position.y);
      graphics.lineTo(
        position.x + Math.cos(facingRad + arcRad / 2) * range,
        position.y + Math.sin(facingRad + arcRad / 2) * range
      );
      graphics.stroke();
    }
  }

  return graphics;
}

/**
 * 渲染状态条
 */
function renderStatusBars(token: ShipTokenV2): Container {
  const container = new Container();
  const barWidth = token.visual.collisionRadius * 2;
  const barHeight = 4;
  const gap = 6;

  // 船体HP条
  const hullPercent = token.hull.current / token.hull.max;
  const hullColor = hullPercent > 0.5 ? STATUS_COLORS.normal :
    hullPercent > 0.25 ? STATUS_COLORS.warning : STATUS_COLORS.critical;

  const hullBar = new Graphics();
  drawStatusBar(
    hullBar,
    -barWidth / 2,
    -(token.visual.collisionRadius + gap + barHeight),
    barWidth,
    barHeight,
    hullPercent,
    hullColor
  );
  container.addChild(hullBar);

  // 辐能条
  const fluxPercent = token.flux.current / token.flux.capacity;
  const softPercent = token.flux.softFlux / token.flux.capacity;
  const hardPercent = token.flux.hardFlux / token.flux.capacity;

  const fluxBar = new Graphics();
  
  // 背景
  fluxBar.rect(-barWidth / 2, -(token.visual.collisionRadius + gap * 2 + barHeight * 2), barWidth, barHeight);
  fluxBar.fill({ color: 0x1a1a2e, alpha: 0.8 });

  // 硬辐能
  if (hardPercent > 0) {
    fluxBar.rect(-barWidth / 2, -(token.visual.collisionRadius + gap * 2 + barHeight * 2), barWidth * hardPercent, barHeight);
    fluxBar.fill({ color: 0xffffff, alpha: 0.9 });
  }

  // 软辐能
  if (softPercent > 0) {
    fluxBar.rect(
      -barWidth / 2 + barWidth * hardPercent,
      -(token.visual.collisionRadius + gap * 2 + barHeight * 2),
      barWidth * softPercent,
      barHeight
    );
    fluxBar.fill({ color: 0x3b82f6, alpha: 0.9 });
  }

  // 边框
  fluxBar.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
  fluxBar.rect(-barWidth / 2, -(token.visual.collisionRadius + gap * 2 + barHeight * 2), barWidth, barHeight);
  fluxBar.stroke();

  container.addChild(fluxBar);

  return container;
}

/**
 * 渲染朝向指示器
 */
function renderHeadingIndicator(token: ShipTokenV2): Graphics {
  const graphics = new Graphics();
  const length = token.visual.collisionRadius * 1.3;

  // 朝向线
  graphics.setStrokeStyle({ width: 2, color: 0x00ffff, alpha: 0.8 });
  graphics.moveTo(0, 0);
  graphics.lineTo(length, 0);
  graphics.stroke();

  // 箭头
  const arrowSize = 8;
  graphics.moveTo(length, 0);
  graphics.lineTo(length - arrowSize, -arrowSize / 2);
  graphics.stroke();

  graphics.moveTo(length, 0);
  graphics.lineTo(length - arrowSize, arrowSize / 2);
  graphics.stroke();

  return graphics;
}

/**
 * 渲染名称标签
 */
function renderNameLabel(token: ShipTokenV2): Container {
  const container = new Container();

  const style = new TextStyle({
    fontSize: 10,
    fill: 0xaaccff,
    stroke: { color: 0x000000, width: 2 },
    fontWeight: 'bold',
  });

  const name = token.shipName ?? `Ship ${token.id.slice(0, 6)}`;
  const text = new Text({ text: name, style });
  text.anchor.set(0.5, 0);
  text.position.set(0, token.visual.collisionRadius + 15);

  container.addChild(text);

  return container;
}

// ==================== 特殊状态渲染 ====================

/**
 * 渲染过载状态指示
 */
export function renderOverloadIndicator(token: ShipTokenV2): Graphics {
  const graphics = new Graphics();

  if (token.flux.state !== 'overloaded') return graphics;

  // 闪烁效果
  const alpha = 0.5 + Math.sin(Date.now() / 200) * 0.3;

  graphics.setStrokeStyle({ width: 3, color: 0xff4a4a, alpha });
  graphics.circle(0, 0, token.visual.collisionRadius + 5);
  graphics.stroke();

  // 警告符号
  graphics.setStrokeStyle({ width: 2, color: 0xff4a4a, alpha: 1 });
  graphics.moveTo(-8, -5);
  graphics.lineTo(0, -15);
  graphics.lineTo(8, -5);
  graphics.stroke();

  return graphics;
}

/**
 * 渲染散热状态指示
 */
export function renderVentingIndicator(token: ShipTokenV2): Graphics {
  const graphics = new Graphics();

  if (token.flux.state !== 'venting') return graphics;

  // 散热波纹
  const time = Date.now() / 500;
  for (let i = 0; i < 3; i++) {
    const radius = token.visual.collisionRadius + 10 + i * 8 + (time % 1) * 8;
    const alpha = 1 - (time % 1);

    graphics.setStrokeStyle({ width: 1, color: 0x4affaa, alpha });
    graphics.circle(0, 0, radius);
    graphics.stroke();
  }

  return graphics;
}

/**
 * 渲染移动路径预览
 */
export function renderMovementPreview(
  token: ShipTokenV2,
  targetPosition: { x: number; y: number },
  targetHeading: number
): Graphics {
  const graphics = new Graphics();

  // 路径线
  graphics.setStrokeStyle({ width: 2, color: 0x4affaa, alpha: 0.5 });
  graphics.moveTo(0, 0);
  graphics.lineTo(targetPosition.x - token.position.x, targetPosition.y - token.position.y);
  graphics.stroke();

  // 目标位置预览
  const previewGraphics = new Graphics();
  drawShipGeometry(previewGraphics, {
    size: token.hullSize,
    collisionRadius: token.visual.collisionRadius,
    color: 0x4affaa,
    alpha: 0.3,
    lineWidth: 1,
    showDetails: false,
  });
  previewGraphics.position.set(
    targetPosition.x - token.position.x,
    targetPosition.y - token.position.y
  );
  previewGraphics.rotation = ((targetHeading - token.heading) * Math.PI) / 180;

  graphics.addChild(previewGraphics);

  return graphics;
}

// ==================== 导出 ====================

export {
  HULL_SIZE_COLORS,
  DAMAGE_TYPE_COLORS,
  STATUS_COLORS,
};