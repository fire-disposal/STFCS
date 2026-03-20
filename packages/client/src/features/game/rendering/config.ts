/**
 * Token 渲染系统配置
 *
 * 统一的视觉风格和渲染配置
 */

import type { FactionId } from '@vt/shared/types';
import type { TokenType } from '@vt/shared/room';

// ==================== 颜色系统 ====================

/** 阵营颜色 */
export const FACTION_COLORS: Record<FactionId, { primary: number; secondary: number; glow: number }> = {
  hegemony: { primary: 0x4a90d9, secondary: 0x2d5a8a, glow: 0x4a90d9 },
  sindrian: { primary: 0xd4af37, secondary: 0x8a7423, glow: 0xd4af37 },
  persean: { primary: 0x2ecc71, secondary: 0x1e8449, glow: 0x2ecc71 },
  tri_tachyon: { primary: 0x9b59b6, secondary: 0x6c3483, glow: 0x9b59b6 },
  pirate: { primary: 0xe74c3c, secondary: 0x922b21, glow: 0xe74c3c },
  independent: { primary: 0x95a5a6, secondary: 0x5d6d7e, glow: 0x95a5a6 },
};

/** Token 类型颜色 */
export const TOKEN_TYPE_COLORS: Record<TokenType, { fill: number; stroke: number; glow: number }> = {
  ship: { fill: 0x4a9eff, stroke: 0xffffff, glow: 0x00ffff },
  station: { fill: 0xffaa4a, stroke: 0xffffff, glow: 0xff8800 },
  asteroid: { fill: 0x8a8aa8, stroke: 0xaaaaaa, glow: 0x666666 },
  debris: { fill: 0x555566, stroke: 0x777788, glow: 0x444455 },
  objective: { fill: 0x44ff44, stroke: 0xffffff, glow: 0x00ff00 },
};

/** 状态颜色 */
export const STATUS_COLORS = {
  hull: {
    high: 0x22c55e,    // > 70%
    medium: 0xf59e0b,  // 30-70%
    low: 0xef4444,     // < 30%
    background: 0x1a1a2e,
  },
  shield: {
    active: 0x3b82f6,
    inactive: 0x6b7280,
    background: 0x1a1a2e,
  },
  flux: {
    normal: 0x3b82f6,
    high: 0xf59e0b,
    overloaded: 0xef4444,
    background: 0x1a1a2e,
  },
  armor: {
    intact: 0x6b7280,
    damaged: 0xf59e0b,
    destroyed: 0xef4444,
  },
} as const;

/** 选中状态颜色 */
export const SELECTION_COLORS = {
  selected: 0x00ffff,
  hover: 0xffff00,
  target: 0xff4444,
  ally: 0x44ff44,
  enemy: 0xff4444,
  neutral: 0xaaaaaa,
} as const;

// ==================== 尺寸系统 ====================

/** Token 尺寸配置 */
export const TOKEN_SIZES = {
  ship: {
    small: { base: 30, label: '小型' },
    medium: { base: 50, label: '中型' },
    large: { base: 70, label: '大型' },
    huge: { base: 100, label: '巨型' },
  },
  station: {
    small: { base: 80, label: '小型' },
    medium: { base: 120, label: '中型' },
    large: { base: 160, label: '大型' },
  },
  asteroid: {
    small: { base: 20, label: '小型' },
    medium: { base: 40, label: '中型' },
    large: { base: 80, label: '大型' },
  },
  debris: {
    small: { base: 30, label: '小型' },
    medium: { base: 60, label: '中型' },
  },
  objective: {
    small: { base: 25, label: '小型' },
    medium: { base: 50, label: '中型' },
    large: { base: 100, label: '大型' },
  },
} as const;

/** UI 元素尺寸 */
export const UI_SIZES = {
  selectionRing: {
    width: 3,
    dashLength: 8,
    gapLength: 4,
  },
  headingIndicator: {
    length: 40,
    width: 2,
    arrowSize: 8,
  },
  statusBar: {
    width: 60,
    height: 6,
    gap: 2,
  },
  coordinateDisplay: {
    fontSize: 10,
    padding: 4,
  },
  infoPanel: {
    minWidth: 200,
    maxWidth: 300,
    padding: 12,
  },
} as const;

// ==================== 动画配置 ====================

/** 动画配置 */
export const ANIMATION_CONFIG = {
  selection: {
    pulseDuration: 1500,
    pulseScale: 0.05,
    rotationSpeed: 0.001,
  },
  hover: {
    scale: 1.05,
    duration: 150,
  },
  damage: {
    flashDuration: 200,
    flashColor: 0xff0000,
  },
  shield: {
    rippleDuration: 1000,
    rippleScale: 1.5,
  },
  explosion: {
    duration: 500,
    maxScale: 2,
  },
} as const;

// ==================== 图层配置 ====================

/** 渲染图层顺序 */
export const RENDER_LAYERS = {
  BACKGROUND: 0,
  GRID: 10,
  ASTEROIDS: 20,
  DEBRIS: 25,
  SHIPS: 30,
  STATIONS: 35,
  SHIELDS: 40,
  WEAPON_RANGES: 50,
  SELECTION: 60,
  EFFECTS: 70,
  UI: 80,
  TOOLTIP: 90,
} as const;

// ==================== 辅助函数 ====================

/** 获取阵营颜色 */
export function getFactionColor(faction: FactionId | null): { primary: number; secondary: number; glow: number } {
  if (!faction) return { primary: 0x888888, secondary: 0x666666, glow: 0x888888 };
  return FACTION_COLORS[faction] || { primary: 0x888888, secondary: 0x666666, glow: 0x888888 };
}

/** 获取 Token 类型颜色 */
export function getTokenTypeColor(type: TokenType): { fill: number; stroke: number; glow: number } {
  return TOKEN_TYPE_COLORS[type] || TOKEN_TYPE_COLORS.ship;
}

/** 获取船体状态颜色 */
export function getHullColor(percentage: number): number {
  if (percentage > 0.7) return STATUS_COLORS.hull.high;
  if (percentage > 0.3) return STATUS_COLORS.hull.medium;
  return STATUS_COLORS.hull.low;
}

/** 获取辐能状态颜色 */
export function getFluxColor(percentage: number, isOverloaded: boolean): number {
  if (isOverloaded) return STATUS_COLORS.flux.overloaded;
  if (percentage > 0.7) return STATUS_COLORS.flux.high;
  return STATUS_COLORS.flux.normal;
}

/** 获取装甲象限颜色 */
export function getArmorColor(percentage: number): number {
  if (percentage > 0.7) return STATUS_COLORS.armor.intact;
  if (percentage > 0.3) return STATUS_COLORS.armor.damaged;
  return STATUS_COLORS.armor.destroyed;
}

/** 根据 size 获取尺寸分类 */
export function getSizeCategory(type: TokenType, size: number): 'small' | 'medium' | 'large' | 'huge' {
  const sizes = TOKEN_SIZES[type];
  if (!sizes) return 'medium';
  
  const categories = Object.keys(sizes) as Array<keyof typeof sizes>;
  
  for (const category of categories) {
    if (size <= sizes[category].base * 1.2) {
      return category;
    }
  }
  
  return categories[categories.length - 1];
}

/** 颜色转换为 CSS 字符串 */
export function colorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** 颜色转换为 RGBA */
export function colorToRgba(color: number, alpha: number = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}