/**
 * 太空导航工具 - 坐标系统
 * 
 * 提供坐标精度控制、坐标转换、网格吸附等功能
 * 
 * 注意：角度计算请使用 angleSystem.ts（有清晰的参考系定义）
 * 本文件仅处理坐标相关的实用函数
 */

import type { CoordinatePrecision } from '@/store/uiStore';

/**
 * 坐标精度配置
 */
const PRECISION_CONFIG: Record<CoordinatePrecision, number> = {
  exact: 1,        // 精确到 1 单位
  rounded10: 10,   // 精确到 10 单位（推荐用于太空）
  rounded100: 100, // 精确到 100 单位（大尺度）
};

/**
 * 根据精度设置舍入坐标
 */
export function roundCoordinate(
  value: number,
  precision: CoordinatePrecision = 'rounded10'
): number {
  const factor = PRECISION_CONFIG[precision];
  return Math.round(value / factor) * factor;
}

/**
 * 舍入坐标对
 */
export function roundPosition(
  x: number,
  y: number,
  precision: CoordinatePrecision = 'rounded10'
): { x: number; y: number } {
  return {
    x: roundCoordinate(x, precision),
    y: roundCoordinate(y, precision),
  };
}

/**
 * 网格吸附
 */
export function snapToGrid(
  x: number,
  y: number,
  gridSize: number = 100
): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * 格式化坐标显示
 */
export function formatCoordinate(
  value: number,
  precision: CoordinatePrecision = 'rounded10'
): string {
  const factor = PRECISION_CONFIG[precision];
  const rounded = Math.round(value / factor) * factor;
  return rounded.toString();
}

/**
 * 格式化位置显示
 */
export function formatPosition(
  x: number,
  y: number,
  precision: CoordinatePrecision = 'rounded10'
): string {
  return `(${formatCoordinate(x, precision)}, ${formatCoordinate(y, precision)})`;
}

/**
 * 计算两点之间的距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 将坐标应用于带精度和网格吸附的位置计算
 */
export function applyPositionSettings(
  x: number,
  y: number,
  options: {
    precision?: CoordinatePrecision;
    gridSnap?: boolean;
    gridSize?: number;
  } = {}
): { x: number; y: number } {
  const {
    precision = 'rounded10',
    gridSnap = false,
    gridSize = 100,
  } = options;

  // 首先应用精度舍入
  let result = roundPosition(x, y, precision);

  // 如果启用网格吸附，再吸附到网格
  if (gridSnap) {
    result = snapToGrid(result.x, result.y, gridSize);
  }

  return result;
}

// ============================================================================
// 导出 angleSystem.ts 中的角度函数，方便统一导入
// ============================================================================
export {
  normalizeAngle,
  normalizeRotation,
  mathToNav,
  navToMath,
  mathToScreen,
  screenToMath,
  calculateViewRotationForAlignment,
  polarToCartesian,
  cartesianToPolar,
  angleFromAToB,
  angleDifference,
  formatAngle,
  parseAngleInput,
  getCompassDirection,
  type AngleDisplayMode,
  type AngleDisplayOptions,
} from './angleSystem';
