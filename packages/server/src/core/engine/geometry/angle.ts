/**
 * 角度计算模块
 * 
 * 所有角度使用航海坐标系：
 * - 0° = 船头（Y轴正向，屏幕上方）
 * - 90° = 右舷（X轴正向，屏幕右侧）
 * - 180° = 船尾（Y轴负向，屏幕下方）
 * - 270° = 左舷（X轴负向，屏幕左侧）
 * - 顺时针增加
 */

import type { Point } from "../../types/common.js";

/** 角度转弧度 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 弧度转角度 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * 计算两点之间的航海角度（0-360度）
 * 
 * 航海角度定义（屏幕坐标系 Y 向下）：
 * - dy 反转：p1.y - p2.y（使得屏幕上方 = 航海 Y 正向）
 * - atan2(dx, dy) 给出相对于 Y 轴的角度
 * - dx > 0 → 右舷方向 → 角度在 90°
 * - dy > 0 → 船头方向（屏幕上方）→ 角度在 0°
 */
export function angleBetween(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p1.y - p2.y;  // 反转 dy：屏幕Y向下，航海Y向上
  let angle = toDegrees(Math.atan2(dx, dy));
  if (angle < 0) angle += 360;
  return angle;
}

/** 计算两个角度之间的最小差值（0-180度） */
export function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** 规范化角度到 0-360 范围 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/** 计算角度是否在扇形区域内 */
export function isAngleInArc(
  testAngle: number,
  centerAngle: number,
  arcWidth: number
): boolean {
  const halfArc = arcWidth / 2;
  return angleDifference(testAngle, centerAngle) <= halfArc;
}

/** 计算从起始角度到目标角度所需的最短转向角度（带方向） */
export function calculateTurnAngle(
  startAngle: number,
  targetAngle: number
): number {
  const diff = (targetAngle - startAngle + 540) % 360 - 180;
  return diff;
}

/** 插值角度（考虑360度环绕） */
export function lerpAngle(
  startAngle: number,
  targetAngle: number,
  t: number
): number {
  const diff = calculateTurnAngle(startAngle, targetAngle);
  return normalizeAngle(startAngle + diff * t);
}