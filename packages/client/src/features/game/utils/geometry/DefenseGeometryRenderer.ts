/**
 * 防御系统几何体渲染器
 *
 * 绘制护盾、护甲象限、辐能系统等
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ShieldType } from '@vt/contracts/config';
import type {
  ShieldInstanceState,
  ArmorInstanceState,
  FluxInstanceState,
  ArmorQuadrant,
} from '@vt/contracts/types';
import {
  drawShieldGeometry,
  drawArmorQuadrantGeometry,
  drawStatusBar,
  drawDashedCircle,
  SHIELD_COLORS,
  STATUS_COLORS,
} from './GeometryRenderer';

// ==================== 护盾渲染 ====================

/** 护盾渲染选项 */
export interface ShieldRenderOptions {
  /** 是否显示护盾HP */
  showHP?: boolean;
  /** 是否显示效率指示 */
  showEfficiency?: boolean;
  /** 透明度 */
  alpha?: number;
  /** 是否动画 */
  animated?: boolean;
}

/**
 * 渲染护盾
 */
export function renderShieldGeometry(
  shield: ShieldInstanceState,
  options: ShieldRenderOptions = {}
): Container {
  const container = new Container();
  const { showHP = false, showEfficiency = false, alpha = 1, animated = false } = options;

  if (shield.type === 'NONE') return container;

  // 护盾图形
  const graphics = new Graphics();
  drawShieldGeometry(graphics, {
    type: shield.type,
    radius: shield.radius,
    coverageAngle: shield.coverageAngle,
    active: shield.active,
    efficiency: shield.efficiency,
  });
  graphics.alpha = alpha;
  container.addChild(graphics);

  // 动画效果
  if (animated && shield.active) {
    const animGraphics = renderShieldAnimation(shield);
    container.addChild(animGraphics);
  }

  // HP指示
  if (showHP && shield.active) {
    const hpIndicator = renderShieldHP(shield);
    container.addChild(hpIndicator);
  }

  // 效率指示
  if (showEfficiency) {
    const effIndicator = renderShieldEfficiency(shield);
    container.addChild(effIndicator);
  }

  return container;
}

/**
 * 渲染护盾动画
 */
function renderShieldAnimation(shield: ShieldInstanceState): Graphics {
  const graphics = new Graphics();
  const time = Date.now() / 1000;

  // 脉冲效果
  const pulseAlpha = 0.2 + Math.sin(time * 3) * 0.1;
  const pulseRadius = shield.radius + Math.sin(time * 2) * 3;

  const color = SHIELD_COLORS[shield.type];

  if (shield.type === 'OMNI') {
    graphics.setStrokeStyle({ width: 1, color, alpha: pulseAlpha });
    graphics.circle(0, 0, pulseRadius);
    graphics.stroke();
  } else if (shield.type === 'FRONT') {
    const arcRad = (shield.coverageAngle * Math.PI) / 180;
    const startAngle = -arcRad / 2 - Math.PI / 2;
    const endAngle = arcRad / 2 - Math.PI / 2;

    graphics.setStrokeStyle({ width: 1, color, alpha: pulseAlpha });
    graphics.arc(0, 0, pulseRadius, startAngle, endAngle);
    graphics.stroke();
  }

  return graphics;
}

/**
 * 渲染护盾HP指示
 */
function renderShieldHP(shield: ShieldInstanceState): Container {
  const container = new Container();

  // HP条
  const barWidth = shield.radius * 1.5;
  const barHeight = 3;
  const percent = shield.current / shield.max;

  const bar = new Graphics();
  drawStatusBar(bar, -barWidth / 2, -shield.radius - 10, barWidth, barHeight, percent, SHIELD_COLORS[shield.type]);
  container.addChild(bar);

  return container;
}

/**
 * 渲染护盾效率指示
 */
function renderShieldEfficiency(shield: ShieldInstanceState): Container {
  const container = new Container();

  const style = new TextStyle({
    fontSize: 8,
    fill: shield.efficiency >= 1 ? 0x22c55e : 0xf1c40f,
    stroke: { color: 0x000000, width: 1 },
  });

  const text = new Text({
    text: `${(shield.efficiency * 100).toFixed(0)}%`,
    style,
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(0, -shield.radius - 15);

  container.addChild(text);

  return container;
}

/**
 * 渲染护盾受击效果
 */
export function renderShieldHitEffect(
  shield: ShieldInstanceState,
  hitAngle: number
): Graphics {
  const graphics = new Graphics();

  if (shield.type === 'NONE' || !shield.active) return graphics;

  const color = SHIELD_COLORS[shield.type];
  const time = Date.now() / 200;

  // 受击闪光
  const flashAlpha = 0.8 - (time % 1) * 0.6;
  const flashRadius = shield.radius + 5 + (time % 1) * 10;

  graphics.setStrokeStyle({ width: 3, color, alpha: flashAlpha });
  
  // 在受击位置绘制弧形闪光
  const hitRad = (hitAngle * Math.PI) / 180;
  const arcWidth = Math.PI / 4;

  graphics.arc(0, 0, flashRadius, hitRad - arcWidth / 2, hitRad + arcWidth / 2);
  graphics.stroke();

  return graphics;
}

// ==================== 护甲渲染 ====================

/** 护甲渲染选项 */
export interface ArmorRenderOptions {
  /** 是否显示数值 */
  showValues?: boolean;
  /** 是否高亮受损象限 */
  highlightDamaged?: boolean;
  /** 选中的象限 */
  selectedQuadrant?: ArmorQuadrant;
}

/**
 * 渲染护甲象限
 */
export function renderArmorQuadrants(
  armor: ArmorInstanceState,
  options: ArmorRenderOptions = {}
): Container {
  const container = new Container();
  const { showValues = false, highlightDamaged = true, selectedQuadrant } = options;

  // 护甲图形
  const graphics = new Graphics();
  drawArmorQuadrantGeometry(graphics, {
    radius: 50,
    quadrants: armor.quadrants,
    maxArmor: armor.maxPerQuadrant,
    showValues,
  });
  container.addChild(graphics);

  // 高亮选中象限
  if (selectedQuadrant) {
    const highlight = renderQuadrantHighlight(selectedQuadrant, 50);
    container.addChild(highlight);
  }

  // 数值标签
  if (showValues) {
    const labels = renderQuadrantLabels(armor);
    container.addChild(labels);
  }

  return container;
}

/**
 * 渲染象限高亮
 */
function renderQuadrantHighlight(quadrant: ArmorQuadrant, radius: number): Graphics {
  const graphics = new Graphics();

  const quadrantAngles: Record<ArmorQuadrant, { start: number; end: number }> = {
    FRONT_TOP: { start: -60, end: 0 },
    FRONT_BOTTOM: { start: 0, end: 60 },
    RIGHT_TOP: { start: 60, end: 120 },
    RIGHT_BOTTOM: { start: 120, end: 180 },
    LEFT_BOTTOM: { start: 180, end: 240 },
    LEFT_TOP: { start: 240, end: 300 },
  };

  const { start, end } = quadrantAngles[quadrant];
  const startRad = ((start - 90) * Math.PI) / 180;
  const endRad = ((end - 90) * Math.PI) / 180;

  graphics.setStrokeStyle({ width: 3, color: 0xffffff, alpha: 0.8 });
  graphics.arc(0, 0, radius, startRad, endRad);
  graphics.stroke();

  return graphics;
}

/**
 * 渲染象限数值标签
 */
function renderQuadrantLabels(armor: ArmorInstanceState): Container {
  const container = new Container();

  const quadrantPositions: Record<ArmorQuadrant, { x: number; y: number }> = {
    FRONT_TOP: { x: 0, y: -30 },
    FRONT_BOTTOM: { x: 0, y: 30 },
    RIGHT_TOP: { x: 35, y: -15 },
    RIGHT_BOTTOM: { x: 35, y: 15 },
    LEFT_BOTTOM: { x: -35, y: 15 },
    LEFT_TOP: { x: -35, y: -15 },
  };

  const style = new TextStyle({
    fontSize: 8,
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 1 },
  });

  for (const [quadrant, pos] of Object.entries(quadrantPositions)) {
    const value = armor.quadrants[quadrant as ArmorQuadrant];
    const percent = Math.round((value / armor.maxPerQuadrant) * 100);

    const text = new Text({
      text: `${percent}%`,
      style,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(pos.x, pos.y);

    container.addChild(text);
  }

  return container;
}

/**
 * 渲染护甲受击效果
 */
export function renderArmorHitEffect(
  quadrant: ArmorQuadrant,
  damage: number
): Graphics {
  const graphics = new Graphics();

  const quadrantAngles: Record<ArmorQuadrant, number> = {
    FRONT_TOP: -30,
    FRONT_BOTTOM: 30,
    RIGHT_TOP: 90,
    RIGHT_BOTTOM: 150,
    LEFT_BOTTOM: 210,
    LEFT_TOP: 270,
  };

  const angle = (quadrantAngles[quadrant] * Math.PI) / 180;
  const radius = 50;

  // 受击位置
  const hitX = Math.cos(angle - Math.PI / 2) * radius;
  const hitY = Math.sin(angle - Math.PI / 2) * radius;

  // 爆炸效果
  const time = Date.now() / 200;
  const alpha = 1 - (time % 1);
  const effectRadius = 10 + (time % 1) * 20;

  graphics.setStrokeStyle({ width: 2, color: 0xffaa4a, alpha });
  graphics.circle(hitX, hitY, effectRadius);
  graphics.stroke();

  // 伤害数字
  const style = new TextStyle({
    fontSize: 12,
    fill: 0xff4a4a,
    stroke: { color: 0x000000, width: 2 },
    fontWeight: 'bold',
  });

  const damageText = new Text({
    text: `-${Math.round(damage)}`,
    style,
  });
  damageText.anchor.set(0.5, 0.5);
  damageText.position.set(hitX, hitY - 20 - (time % 1) * 10);
  graphics.addChild(damageText);

  return graphics;
}

// ==================== 辐能系统渲染 ====================

/** 辐能渲染选项 */
export interface FluxRenderOptions {
  /** 是否显示详细数值 */
  showDetails?: boolean;
  /** 条宽度 */
  barWidth?: number;
  /** 条高度 */
  barHeight?: number;
}

/**
 * 渲染辐能条
 */
export function renderFluxBar(
  flux: FluxInstanceState,
  options: FluxRenderOptions = {}
): Container {
  const container = new Container();
  const { showDetails = false, barWidth = 100, barHeight = 8 } = options;

  const graphics = new Graphics();

  // 背景
  graphics.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
  graphics.fill({ color: 0x1a1a2e, alpha: 0.8 });

  // 硬辐能
  const hardPercent = flux.hardFlux / flux.capacity;
  if (hardPercent > 0) {
    graphics.rect(-barWidth / 2, -barHeight / 2, barWidth * hardPercent, barHeight);
    graphics.fill({ color: 0xffffff, alpha: 0.9 });
  }

  // 软辐能
  const softPercent = flux.softFlux / flux.capacity;
  if (softPercent > 0) {
    graphics.rect(
      -barWidth / 2 + barWidth * hardPercent,
      -barHeight / 2,
      barWidth * softPercent,
      barHeight
    );
    graphics.fill({ color: 0x3b82f6, alpha: 0.9 });
  }

  // 边框
  graphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
  graphics.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
  graphics.stroke();

  // 过载警告线
  const warningPercent = 0.8;
  const warningX = -barWidth / 2 + barWidth * warningPercent;
  graphics.setStrokeStyle({ width: 1, color: 0xf1c40f, alpha: 0.5 });
  graphics.moveTo(warningX, -barHeight / 2);
  graphics.lineTo(warningX, barHeight / 2);
  graphics.stroke();

  container.addChild(graphics);

  // 详细数值
  if (showDetails) {
    const details = renderFluxDetails(flux, barWidth, barHeight);
    container.addChild(details);
  }

  return container;
}

/**
 * 渲染辐能详情
 */
function renderFluxDetails(
  flux: FluxInstanceState,
  barWidth: number,
  barHeight: number
): Container {
  const container = new Container();

  const style = new TextStyle({
    fontSize: 8,
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 1 },
  });

  const totalFlux = flux.softFlux + flux.hardFlux;
  const text = new Text({
    text: `${Math.round(totalFlux)}/${flux.capacity}`,
    style,
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(0, -barHeight - 5);

  container.addChild(text);

  return container;
}

/**
 * 渲染过载效果
 */
export function renderOverloadEffect(flux: FluxInstanceState): Graphics {
  const graphics = new Graphics();

  if (flux.state !== 'overloaded') return graphics;

  const time = Date.now() / 100;

  // 闪烁警告
  const alpha = 0.5 + Math.sin(time) * 0.3;

  graphics.setStrokeStyle({ width: 3, color: 0xff4a4a, alpha });
  graphics.circle(0, 0, 30);
  graphics.stroke();

  // 电弧效果
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) + time * 0.5;
    const x1 = Math.cos(angle) * 20;
    const y1 = Math.sin(angle) * 20;
    const x2 = Math.cos(angle + 0.3) * 35;
    const y2 = Math.sin(angle + 0.3) * 35;

    graphics.setStrokeStyle({ width: 1, color: 0xffaa4a, alpha: alpha * 0.5 });
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke();
  }

  return graphics;
}

/**
 * 渲染散热效果
 */
export function renderVentingEffect(flux: FluxInstanceState): Graphics {
  const graphics = new Graphics();

  if (flux.state !== 'venting') return graphics;

  const time = Date.now() / 200;

  // 散热波纹
  for (let i = 0; i < 3; i++) {
    const radius = 25 + i * 10 + (time % 1) * 10;
    const alpha = 0.5 - (time % 1) * 0.5;

    graphics.setStrokeStyle({ width: 1, color: 0x4affaa, alpha });
    graphics.circle(0, 0, radius);
    graphics.stroke();
  }

  // 散热粒子
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) + time * 0.2;
    const radius = 20 + (time % 1) * 20;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const alpha = 1 - (time % 1);

    graphics.circle(x, y, 2);
    graphics.fill({ color: 0x4affaa, alpha });
  }

  return graphics;
}

// ==================== 导出 ====================

export { SHIELD_COLORS, STATUS_COLORS };