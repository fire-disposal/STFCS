/**
 * 角度计算模块
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

/** 计算两点之间的角度（0-360度） */
export function angleBetween(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let angle = toDegrees(Math.atan2(dy, dx));
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