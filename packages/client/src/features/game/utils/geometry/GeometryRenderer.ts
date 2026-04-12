/**
 * 几何体绘制工具
 *
 * 提供简洁的示波器风格几何体绘制功能
 * 用于素材缺失时的回退渲染
 */

import { Graphics, Point, Container } from 'pixi.js';
import type { HullSize, DamageType, ShieldType } from '@vt/contracts/config';

// ==================== 颜色配置 ====================

/** 舰船尺寸颜色映射 */
export const HULL_SIZE_COLORS: Record<HullSize, number> = {
  FIGHTER: 0x88ff88,    // 浅绿
  FRIGATE: 0x4a9eff,    // 蓝色
  DESTROYER: 0xffaa4a,  // 橙色
  CRUISER: 0xff4a4a,    // 红色
  CAPITAL: 0xaa4aff,    // 紫色
};

/** 伤害类型颜色映射 */
export const DAMAGE_TYPE_COLORS: Record<DamageType, number> = {
  KINETIC: 0x4a9eff,        // 蓝色
  HIGH_EXPLOSIVE: 0xff4a4a, // 红色
  FRAGMENTATION: 0xaaaaaa,  // 灰色
  ENERGY: 0xffaa4a,         // 橙色
};

/** 护盾类型颜色 */
export const SHIELD_COLORS = {
  FRONT: 0x4affaa,
  OMNI: 0xaa4aff,
  NONE: 0x888888,
};

/** 状态颜色 */
export const STATUS_COLORS = {
  normal: 0x4affaa,
  warning: 0xffaa4a,
  critical: 0xff4a4a,
  disabled: 0x666666,
};

// ==================== 舰船几何体绘制 ====================

/** 舰船几何体配置 */
export interface ShipGeometryConfig {
  size: HullSize;
  collisionRadius: number;
  color?: number;
  alpha?: number;
  lineWidth?: number;
  showDetails?: boolean;
}

/**
 * 绘制舰船几何体
 * 
 * 根据舰船尺寸绘制不同风格的简洁图形：
 * - FIGHTER: 小三角形
 * - FRIGATE: 箭头形
 * - DESTROYER: 菱形
 * - CRUISER: 六边形
 * - CAPITAL: 大型复合形状
 */
export function drawShipGeometry(
  graphics: Graphics,
  config: ShipGeometryConfig
): void {
  const {
    size,
    collisionRadius,
    color = HULL_SIZE_COLORS[size],
    alpha = 0.9,
    lineWidth = 2,
    showDetails = true,
  } = config;

  graphics.clear();

  switch (size) {
    case 'FIGHTER':
      drawFighterShape(graphics, collisionRadius, color, alpha, lineWidth);
      break;
    case 'FRIGATE':
      drawFrigateShape(graphics, collisionRadius, color, alpha, lineWidth);
      break;
    case 'DESTROYER':
      drawDestroyerShape(graphics, collisionRadius, color, alpha, lineWidth);
      break;
    case 'CRUISER':
      drawCruiserShape(graphics, collisionRadius, color, alpha, lineWidth);
      break;
    case 'CAPITAL':
      drawCapitalShape(graphics, collisionRadius, color, alpha, lineWidth);
      break;
    default:
      drawFrigateShape(graphics, collisionRadius, color, alpha, lineWidth);
  }

  // 绘制碰撞半径指示（虚线圆）
  if (showDetails) {
    drawDashedCircle(graphics, 0, 0, collisionRadius, 0xffffff, 0.3);
  }
}

/** 绘制战机形状 - 小三角形 */
function drawFighterShape(
  graphics: Graphics,
  radius: number,
  color: number,
  alpha: number,
  lineWidth: number
): void {
  const r = radius * 0.8;
  const points = [
    new Point(r, 0),
    new Point(-r * 0.6, r * 0.5),
    new Point(-r * 0.3, 0),
    new Point(-r * 0.6, -r * 0.5),
  ];

  graphics.poly(points);
  graphics.fill({ color, alpha });
  graphics.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 0.8 });
  graphics.poly(points);
  graphics.stroke();

  // 中心线
  graphics.moveTo(-r * 0.3, 0);
  graphics.lineTo(r * 0.8, 0);
  graphics.stroke();
}

/** 绘制护卫舰形状 - 箭头形 */
function drawFrigateShape(
  graphics: Graphics,
  radius: number,
  color: number,
  alpha: number,
  lineWidth: number
): void {
  const r = radius;
  const points = [
    new Point(r * 1.2, 0),
    new Point(r * 0.3, r * 0.4),
    new Point(-r * 0.5, r * 0.35),
    new Point(-r * 0.7, 0),
    new Point(-r * 0.5, -r * 0.35),
    new Point(r * 0.3, -r * 0.4),
  ];

  graphics.poly(points);
  graphics.fill({ color, alpha });
  graphics.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 0.8 });
  graphics.poly(points);
  graphics.stroke();

  // 引擎指示
  graphics.moveTo(-r * 0.5, r * 0.2);
  graphics.lineTo(-r * 0.7, 0);
  graphics.lineTo(-r * 0.5, -r * 0.2);
  graphics.stroke();
}

/** 绘制驱逐舰形状 - 菱形 */
function drawDestroyerShape(
  graphics: Graphics,
  radius: number,
  color: number,
  alpha: number,
  lineWidth: number
): void {
  const r = radius;
  
  // 主体
  const mainPoints = [
    new Point(r * 1.1, 0),
    new Point(r * 0.4, r * 0.5),
    new Point(-r * 0.6, r * 0.4),
    new Point(-r * 0.8, 0),
    new Point(-r * 0.6, -r * 0.4),
    new Point(r * 0.4, -r * 0.5),
  ];

  graphics.poly(mainPoints);
  graphics.fill({ color, alpha });
  graphics.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 0.8 });
  graphics.poly(mainPoints);
  graphics.stroke();

  // 舰桥
  const bridgePoints = [
    new Point(r * 0.2, r * 0.15),
    new Point(r * 0.2, -r * 0.15),
    new Point(-r * 0.2, -r * 0.15),
    new Point(-r * 0.2, r * 0.15),
  ];
  graphics.poly(bridgePoints);
  graphics.fill({ color: 0xffffff, alpha: 0.3 });
}

/** 绘制巡洋舰形状 - 六边形 */
function drawCruiserShape(
  graphics: Graphics,
  radius: number,
  color: number,
  alpha: number,
  lineWidth: number
): void {
  const r = radius;
  
  // 主体
  const mainPoints = [
    new Point(r, 0),
    new Point(r * 0.5, r * 0.55),
    new Point(-r * 0.5, r * 0.55),
    new Point(-r * 0.9, 0),
    new Point(-r * 0.5, -r * 0.55),
    new Point(r * 0.5, -r * 0.55),
  ];

  graphics.poly(mainPoints);
  graphics.fill({ color, alpha });
  graphics.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 0.8 });
  graphics.poly(mainPoints);
  graphics.stroke();

  // 前部装甲带
  graphics.moveTo(r * 0.5, r * 0.4);
  graphics.lineTo(r * 0.5, -r * 0.4);
  graphics.stroke();

  // 舰桥
  graphics.rect(-r * 0.1, -r * 0.2, r * 0.4, r * 0.4);
  graphics.fill({ color: 0xffffff, alpha: 0.2 });
}

/** 绘制主力舰形状 - 大型复合形状 */
function drawCapitalShape(
  graphics: Graphics,
  radius: number,
  color: number,
  alpha: number,
  lineWidth: number
): void {
  const r = radius;
  
  // 主体
  const mainPoints = [
    new Point(r * 1.2, 0),
    new Point(r * 0.8, r * 0.4),
    new Point(r * 0.3, r * 0.5),
    new Point(-r * 0.5, r * 0.45),
    new Point(-r * 0.9, r * 0.3),
    new Point(-r, 0),
    new Point(-r * 0.9, -r * 0.3),
    new Point(-r * 0.5, -r * 0.45),
    new Point(r * 0.3, -r * 0.5),
    new Point(r * 0.8, -r * 0.4),
  ];

  graphics.poly(mainPoints);
  graphics.fill({ color, alpha });
  graphics.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 0.8 });
  graphics.poly(mainPoints);
  graphics.stroke();

  // 装甲带
  graphics.moveTo(r * 0.3, r * 0.4);
  graphics.lineTo(r * 0.3, -r * 0.4);
  graphics.stroke();

  graphics.moveTo(-r * 0.3, r * 0.35);
  graphics.lineTo(-r * 0.3, -r * 0.35);
  graphics.stroke();

  // 舰桥
  graphics.rect(-r * 0.2, -r * 0.25, r * 0.5, r * 0.5);
  graphics.fill({ color: 0xffffff, alpha: 0.15 });
  graphics.stroke();
}

// ==================== 武器几何体绘制 ====================

/** 武器几何体配置 */
export interface WeaponGeometryConfig {
  range: number;
  arc: number;
  damageType: DamageType;
  mountType: 'FIXED' | 'TURRET' | 'HYBRID';
  showArc?: boolean;
}

/**
 * 绘制武器射界几何体
 */
export function drawWeaponArcGeometry(
  graphics: Graphics,
  config: WeaponGeometryConfig
): void {
  const { range, arc, damageType, mountType, showArc = true } = config;
  const color = DAMAGE_TYPE_COLORS[damageType];

  graphics.clear();

  if (!showArc) return;

  const arcRad = (arc * Math.PI) / 180;
  const startAngle = -arcRad / 2;
  const endAngle = arcRad / 2;

  // 射界扇形
  graphics.moveTo(0, 0);
  graphics.arc(0, 0, range, startAngle, endAngle);
  graphics.closePath();
  graphics.fill({ color, alpha: 0.1 });

  // 射界边界线
  graphics.setStrokeStyle({ width: 1, color, alpha: 0.5 });
  graphics.arc(0, 0, range, startAngle, endAngle);
  graphics.stroke();

  // 径向线
  graphics.moveTo(0, 0);
  graphics.lineTo(
    Math.cos(startAngle) * range,
    Math.sin(startAngle) * range
  );
  graphics.stroke();

  graphics.moveTo(0, 0);
  graphics.lineTo(
    Math.cos(endAngle) * range,
    Math.sin(endAngle) * range
  );
  graphics.stroke();

  // 炮塔指示
  if (mountType === 'TURRET') {
    graphics.circle(0, 0, 5);
    graphics.fill({ color, alpha: 0.8 });
  }
}

// ==================== 护盾几何体绘制 ====================

/** 护盾几何体配置 */
export interface ShieldGeometryConfig {
  type: ShieldType;
  radius: number;
  coverageAngle: number;
  active: boolean;
  efficiency: number;
}

/**
 * 绘制护盾几何体
 */
export function drawShieldGeometry(
  graphics: Graphics,
  config: ShieldGeometryConfig
): void {
  const { type, radius, coverageAngle, active, efficiency } = config;

  graphics.clear();

  if (type === 'NONE' || !active) return;

  const color = SHIELD_COLORS[type];
  const alpha = active ? 0.3 * efficiency : 0.1;

  if (type === 'FRONT') {
    // 前向护盾
    const arcRad = (coverageAngle * Math.PI) / 180;
    const startAngle = -arcRad / 2 - Math.PI / 2;
    const endAngle = arcRad / 2 - Math.PI / 2;

    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius, startAngle, endAngle);
    graphics.closePath();
    graphics.fill({ color, alpha });

    // 护盾边缘
    graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
    graphics.arc(0, 0, radius, startAngle, endAngle);
    graphics.stroke();
  } else if (type === 'OMNI') {
    // 全向护盾
    graphics.circle(0, 0, radius);
    graphics.fill({ color, alpha });

    graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
    graphics.circle(0, 0, radius);
    graphics.stroke();
  }
}

// ==================== 护甲象限几何体绘制 ====================

/** 护甲象限配置 */
export interface ArmorQuadrantGeometryConfig {
  radius: number;
  quadrants: {
    FRONT_TOP: number;
    FRONT_BOTTOM: number;
    LEFT_TOP: number;
    LEFT_BOTTOM: number;
    RIGHT_TOP: number;
    RIGHT_BOTTOM: number;
  };
  maxArmor: number;
  showValues?: boolean;
}

/**
 * 绘制护甲象限几何体
 */
export function drawArmorQuadrantGeometry(
  graphics: Graphics,
  config: ArmorQuadrantGeometryConfig
): void {
  const { radius, quadrants, maxArmor, showValues = false } = config;

  graphics.clear();

  const quadrantConfigs = [
    { key: 'FRONT_TOP' as const, startAngle: -60, endAngle: 0 },
    { key: 'FRONT_BOTTOM' as const, startAngle: 0, endAngle: 60 },
    { key: 'RIGHT_TOP' as const, startAngle: 60, endAngle: 120 },
    { key: 'RIGHT_BOTTOM' as const, startAngle: 120, endAngle: 180 },
    { key: 'LEFT_BOTTOM' as const, startAngle: 180, endAngle: 240 },
    { key: 'LEFT_TOP' as const, startAngle: 240, endAngle: 300 },
  ];

  for (const { key, startAngle, endAngle } of quadrantConfigs) {
    const value = quadrants[key];
    const percent = value / maxArmor;
    const color = getArmorColor(percent);

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius * 0.9, startRad, endRad);
    graphics.closePath();
    graphics.fill({ color, alpha: 0.3 });

    graphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });
    graphics.arc(0, 0, radius * 0.9, startRad, endRad);
    graphics.stroke();
  }
}

/** 根据护甲百分比获取颜色 */
function getArmorColor(percent: number): number {
  if (percent > 0.75) return 0x22c55e;
  if (percent > 0.5) return 0xf1c40f;
  if (percent > 0.25) return 0xe67e22;
  return 0xe74c3c;
}

// ==================== 辅助绘制函数 ====================

/**
 * 绘制虚线圆
 */
export function drawDashedCircle(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
  segments: number = 16
): void {
  const dashAngle = (2 * Math.PI) / segments;
  const dashLength = dashAngle * 0.6;

  graphics.setStrokeStyle({ width: 1, color, alpha });

  for (let i = 0; i < segments; i++) {
    const startAngle = i * dashAngle;
    const endAngle = startAngle + dashLength;

    graphics.arc(x, y, radius, startAngle, endAngle);
    graphics.stroke();
  }
}

/**
 * 绘制指示箭头
 */
export function drawIndicatorArrow(
  graphics: Graphics,
  x: number,
  y: number,
  length: number,
  angle: number,
  color: number,
  alpha: number = 1
): void {
  const rad = (angle * Math.PI) / 180;
  const endX = x + Math.cos(rad) * length;
  const endY = y + Math.sin(rad) * length;

  graphics.setStrokeStyle({ width: 2, color, alpha });
  graphics.moveTo(x, y);
  graphics.lineTo(endX, endY);
  graphics.stroke();

  // 箭头头部
  const arrowSize = 8;
  const arrowAngle = 0.5;

  graphics.moveTo(endX, endY);
  graphics.lineTo(
    endX - Math.cos(rad - arrowAngle) * arrowSize,
    endY - Math.sin(rad - arrowAngle) * arrowSize
  );
  graphics.stroke();

  graphics.moveTo(endX, endY);
  graphics.lineTo(
    endX - Math.cos(rad + arrowAngle) * arrowSize,
    endY - Math.sin(rad + arrowAngle) * arrowSize
  );
  graphics.stroke();
}

/**
 * 绘制状态条
 */
export function drawStatusBar(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  percent: number,
  color: number,
  backgroundColor: number = 0x1a1a2e
): void {
  // 背景
  graphics.rect(x, y, width, height);
  graphics.fill({ color: backgroundColor, alpha: 0.8 });

  // 填充
  if (percent > 0) {
    graphics.rect(x, y, width * Math.min(1, Math.max(0, percent)), height);
    graphics.fill({ color, alpha: 0.9 });
  }

  // 边框
  graphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
  graphics.rect(x, y, width, height);
  graphics.stroke();
}

/**
 * 绘制六边形
 */
export function drawHexagon(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number = 1
): void {
  const points: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    points.push(new Point(
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius
    ));
  }

  graphics.poly(points);
  graphics.fill({ color, alpha });
}

/**
 * 绘制网格背景
 */
export function drawGridBackground(
  graphics: Graphics,
  width: number,
  height: number,
  cellSize: number,
  color: number = 0x333333,
  alpha: number = 0.3
): void {
  graphics.setStrokeStyle({ width: 1, color, alpha });

  // 垂直线
  for (let x = 0; x <= width; x += cellSize) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
    graphics.stroke();
  }

  // 水平线
  for (let y = 0; y <= height; y += cellSize) {
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
    graphics.stroke();
  }
}

/**
 * 绘制扫描线效果（示波器风格）
 */
export function drawScanLine(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  color: number = 0x4affaa,
  alpha: number = 0.5
): void {
  const scanX = x + width * progress;

  // 扫描线
  graphics.setStrokeStyle({ width: 2, color, alpha });
  graphics.moveTo(scanX, y);
  graphics.lineTo(scanX, y + height);
  graphics.stroke();

  // 扫描尾迹
  const trailWidth = width * 0.1;
  for (let i = 0; i < 5; i++) {
    const trailX = scanX - i * (trailWidth / 5);
    if (trailX >= x) {
      graphics.setStrokeStyle({ width: 1, color, alpha: alpha * (1 - i / 5) });
      graphics.moveTo(trailX, y);
      graphics.lineTo(trailX, y + height);
      graphics.stroke();
    }
  }
}

/**
 * 绘制波形线（示波器风格）
 */
export function drawWaveform(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  amplitude: number,
  frequency: number,
  phase: number,
  color: number = 0x4affaa,
  alpha: number = 1
): void {
  graphics.setStrokeStyle({ width: 2, color, alpha });

  const steps = 50;
  const stepWidth = width / steps;

  for (let i = 0; i < steps; i++) {
    const px = x + i * stepWidth;
    const py = y + Math.sin((i / steps) * frequency * Math.PI * 2 + phase) * amplitude;

    if (i === 0) {
      graphics.moveTo(px, py);
    } else {
      graphics.lineTo(px, py);
    }
  }

  graphics.stroke();
}

/**
 * 创建几何体容器
 */
export function createGeometryContainer(): Container {
  const container = new Container();
  return container;
}