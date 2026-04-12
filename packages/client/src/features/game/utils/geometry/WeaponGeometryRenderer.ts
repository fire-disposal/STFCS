/**
 * 武器几何体渲染器
 *
 * 绘制武器射界、弹道预览等
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { DamageType } from '@vt/contracts/config';
import type { WeaponInstanceState, WeaponMountInstance } from '@vt/contracts/types';
import {
  drawWeaponArcGeometry,
  drawWaveform,
  DAMAGE_TYPE_COLORS,
  type WeaponGeometryConfig,
} from './GeometryRenderer';

// ==================== 配置 ====================

/** 武器渲染选项 */
export interface WeaponRenderOptions {
  /** 是否显示射界 */
  showArc?: boolean;
  /** 是否显示射程刻度 */
  showRangeMarkers?: boolean;
  /** 是否显示武器标签 */
  showLabel?: boolean;
  /** 透明度 */
  alpha?: number;
  /** 是否高亮 */
  highlighted?: boolean;
}

/** 默认选项 */
const DEFAULT_WEAPON_OPTIONS: WeaponRenderOptions = {
  showArc: true,
  showRangeMarkers: true,
  showLabel: false,
  alpha: 0.5,
  highlighted: false,
};

// ==================== 主渲染函数 ====================

/**
 * 渲染武器射界
 */
export function renderWeaponArc(
  weapon: WeaponInstanceState,
  mount: WeaponMountInstance,
  options: WeaponRenderOptions = {}
): Container {
  const opts = { ...DEFAULT_WEAPON_OPTIONS, ...options };
  const container = new Container();

  // 设置位置和朝向
  container.position.set(mount.position.x, mount.position.y);
  container.rotation = (weapon.currentFacing * Math.PI) / 180;

  // 绘制射界
  const arcGraphics = new Graphics();
  drawWeaponArcGeometry(arcGraphics, {
    range: weapon.range,
    arc: weapon.arc,
    damageType: weapon.damageType,
    mountType: mount.mountType,
    showArc: opts.showArc,
  });

  // 调整透明度
  arcGraphics.alpha = opts.alpha ?? 0.5;
  if (opts.highlighted) {
    arcGraphics.alpha = 1;
  }

  container.addChild(arcGraphics);

  // 射程刻度
  if (opts.showRangeMarkers) {
    const markersGraphics = renderRangeMarkers(weapon);
    container.addChild(markersGraphics);
  }

  // 武器标签
  if (opts.showLabel) {
    const label = renderWeaponLabel(weapon);
    container.addChild(label);
  }

  return container;
}

/**
 * 渲染所有武器射界
 */
export function renderAllWeaponArcs(
  weapons: Record<string, WeaponInstanceState>,
  mounts: Record<string, WeaponMountInstance>,
  options: WeaponRenderOptions = {}
): Container {
  const container = new Container();
  const opts = { ...DEFAULT_WEAPON_OPTIONS, ...options };

  for (const [mountId, mount] of Object.entries(mounts)) {
    // 找到对应的武器
    const weapon = Object.values(weapons).find(w => w.mountId === mountId);
    if (!weapon) continue;

    const arcContainer = renderWeaponArc(weapon, mount, opts);
    container.addChild(arcContainer);
  }

  return container;
}

// ==================== 子组件渲染 ====================

/**
 * 渲染射程刻度
 */
function renderRangeMarkers(weapon: WeaponInstanceState): Graphics {
  const graphics = new Graphics();
  const color = DAMAGE_TYPE_COLORS[weapon.damageType];

  // 25%, 50%, 75% 刻度
  const markers = [0.25, 0.5, 0.75, 1.0];

  graphics.setStrokeStyle({ width: 1, color, alpha: 0.3 });

  for (const marker of markers) {
    const radius = weapon.range * marker;

    // 短刻度线
    const arcRad = (weapon.arc * Math.PI) / 180;
    const startAngle = -arcRad / 2;
    const endAngle = arcRad / 2;

    graphics.arc(0, 0, radius, startAngle, endAngle);
    graphics.stroke();
  }

  return graphics;
}

/**
 * 渲染武器标签
 */
function renderWeaponLabel(weapon: WeaponInstanceState): Container {
  const container = new Container();

  const style = new TextStyle({
    fontSize: 8,
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 1 },
  });

  const text = new Text({
    text: `${weapon.name}\n${weapon.range}u`,
    style,
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(weapon.range * 0.6, 0);

  container.addChild(text);

  return container;
}

// ==================== 特殊效果 ====================

/**
 * 渲染武器充能效果
 */
export function renderWeaponCharging(
  weapon: WeaponInstanceState,
  mount: WeaponMountInstance
): Graphics {
  const graphics = new Graphics();

  if (weapon.state !== 'charging') return graphics;

  const progress = weapon.chargeProgress;
  const color = DAMAGE_TYPE_COLORS[weapon.damageType];

  // 充能环
  graphics.setStrokeStyle({ width: 3, color, alpha: 0.8 });
  graphics.arc(0, 0, 10, 0, Math.PI * 2 * progress);
  graphics.stroke();

  // 充能波纹
  const waveAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
  graphics.setStrokeStyle({ width: 1, color, alpha: waveAlpha });
  graphics.circle(0, 0, 15 + progress * 5);
  graphics.stroke();

  return graphics;
}

/**
 * 渲染武器冷却效果
 */
export function renderWeaponCooldown(
  weapon: WeaponInstanceState,
  mount: WeaponMountInstance
): Graphics {
  const graphics = new Graphics();

  if (weapon.state !== 'cooldown') return graphics;

  const progress = 1 - (weapon.cooldownRemaining / weapon.cooldown);
  const color = DAMAGE_TYPE_COLORS[weapon.damageType];

  // 冷却进度环
  graphics.setStrokeStyle({ width: 2, color: 0x666666, alpha: 0.5 });
  graphics.circle(0, 0, 8);
  graphics.stroke();

  graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
  graphics.arc(0, 0, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  graphics.stroke();

  return graphics;
}

/**
 * 渲染弹道预览
 */
export function renderProjectilePreview(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  damageType: DamageType,
  isGuided: boolean = false
): Graphics {
  const graphics = new Graphics();
  const color = DAMAGE_TYPE_COLORS[damageType];

  // 弹道线
  graphics.setStrokeStyle({ width: 2, color, alpha: 0.6 });
  graphics.moveTo(startPos.x, startPos.y);
  graphics.lineTo(endPos.x, endPos.y);
  graphics.stroke();

  // 弹道波形（能量武器）
  if (damageType === 'ENERGY') {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const waveGraphics = new Graphics();
    drawWaveform(waveGraphics, 0, 0, length, 3, 10, 0, color, 0.4);
    waveGraphics.rotation = angle;
    waveGraphics.position.set(startPos.x, startPos.y);

    graphics.addChild(waveGraphics);
  }

  // 制导指示
  if (isGuided) {
    graphics.setStrokeStyle({ width: 1, color, alpha: 0.3 });
    graphics.moveTo(endPos.x, endPos.y);
    graphics.lineTo(endPos.x + 10, endPos.y - 5);
    graphics.stroke();

    graphics.moveTo(endPos.x, endPos.y);
    graphics.lineTo(endPos.x + 10, endPos.y + 5);
    graphics.stroke();
  }

  // 命中点
  graphics.circle(endPos.x, endPos.y, 5);
  graphics.fill({ color, alpha: 0.5 });

  return graphics;
}

/**
 * 渲染武器状态指示器
 */
export function renderWeaponStatusIndicator(
  weapon: WeaponInstanceState
): Graphics {
  const graphics = new Graphics();

  // 状态颜色
  let color: number;
  let alpha: number;

  switch (weapon.state) {
    case 'ready':
      color = 0x22c55e;
      alpha = 0.8;
      break;
    case 'cooldown':
    case 'charging':
    case 'reloading':
      color = 0xf1c40f;
      alpha = 0.6;
      break;
    case 'disabled':
    case 'out_of_ammo':
      color = 0xe74c3c;
      alpha = 0.5;
      break;
    default:
      color = 0x666666;
      alpha = 0.5;
  }

  // 状态点
  graphics.circle(0, 0, 4);
  graphics.fill({ color, alpha });

  // 就绪状态额外指示
  if (weapon.state === 'ready' && !weapon.hasFiredThisTurn) {
    graphics.setStrokeStyle({ width: 1, color, alpha: 0.5 });
    graphics.circle(0, 0, 6);
    graphics.stroke();
  }

  return graphics;
}

// ==================== 导出 ====================

export { DAMAGE_TYPE_COLORS };