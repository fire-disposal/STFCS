/**
 * 扇形区域计算模块
 */

import type { Point } from "../../types/common.js";
import { distance } from "./distance.js";
import { angleBetween, isAngleInArc } from "./angle.js";

/** 扇形区域定义 */
export interface Sector {
  center: Point;
  centerAngle: number;
  arcWidth: number; // 角度宽度
  radius: number;
  innerRadius?: number; // 最小射程（内半径），默认为0
}

/** 检查点是否在扇形区域内 */
export function isPointInSector(point: Point, sector: Sector): boolean {
  const dist = distance(point, sector.center);
  const innerRadius = sector.innerRadius ?? 0;
  
  // 检查距离范围
  if (dist > sector.radius || dist < innerRadius) {
    return false;
  }

  // 检查角度
  const angleToPoint = angleBetween(sector.center, point);
  return isAngleInArc(angleToPoint, sector.centerAngle, sector.arcWidth);
}

/** 计算扇形区域的边界点（用于可视化） */
export function calculateSectorBoundaryPoints(
  sector: Sector,
  segments: number = 16
): Point[] {
  const points: Point[] = [];
  const startAngle = sector.centerAngle - sector.arcWidth / 2;
  const angleStep = sector.arcWidth / segments;
  const innerRadius = sector.innerRadius ?? 0;

  // 如果有内半径，添加内弧边界点
  if (innerRadius > 0) {
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + i * angleStep;
      const rad = (angle * Math.PI) / 180;
      const x = sector.center.x + Math.cos(rad) * innerRadius;
      const y = sector.center.y + Math.sin(rad) * innerRadius;
      points.push({ x, y });
    }
  } else {
    // 没有内半径时添加中心点
    points.push(sector.center);
  }

  // 添加外弧边界点
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + i * angleStep;
    const rad = (angle * Math.PI) / 180;
    const x = sector.center.x + Math.cos(rad) * sector.radius;
    const y = sector.center.y + Math.sin(rad) * sector.radius;
    points.push({ x, y });
  }

  return points;
}

/** 计算两个扇形是否相交 */
export function doSectorsIntersect(sector1: Sector, sector2: Sector): boolean {
  // 首先检查中心距离
  const centerDist = distance(sector1.center, sector2.center);
  if (centerDist > sector1.radius + sector2.radius) {
    return false; // 距离太远，不可能相交
  }

  // 检查sector1的边界点是否在sector2内
  const boundaryPoints1 = calculateSectorBoundaryPoints(sector1, 8);
  for (const point of boundaryPoints1) {
    if (isPointInSector(point, sector2)) {
      return true;
    }
  }

  // 检查sector2的边界点是否在sector1内
  const boundaryPoints2 = calculateSectorBoundaryPoints(sector2, 8);
  for (const point of boundaryPoints2) {
    if (isPointInSector(point, sector1)) {
      return true;
    }
  }

  return false;
}

/** 计算扇形与点的最近距离 */
export function distanceToSector(point: Point, sector: Sector): number {
  if (isPointInSector(point, sector)) {
    return 0;
  }

  const distToCenter = distance(point, sector.center);
  const innerRadius = sector.innerRadius ?? 0;
  
  // 计算点到扇形中心的角度
  const angleToPoint = angleBetween(sector.center, point);
  const startAngle = sector.centerAngle - sector.arcWidth / 2;
  const endAngle = sector.centerAngle + sector.arcWidth / 2;

  // 检查角度是否在扇形角度范围内
  const normalizedAngle = ((angleToPoint - startAngle) % 360 + 360) % 360;
  const arcSpan = ((endAngle - startAngle) % 360 + 360) % 360;
  const isInAngleRange = normalizedAngle <= arcSpan;

  if (isInAngleRange) {
    // 点在扇形角度范围内
    if (distToCenter > sector.radius) {
      // 超出外半径
      return distToCenter - sector.radius;
    } else if (distToCenter < innerRadius) {
      // 在内半径内
      return innerRadius - distToCenter;
    }
    // 点在角度范围内但距离在有效范围内（不应该发生，因为isPointInSector已检查）
  }

  // 点在扇形角度范围外，计算到最近边界线的距离
  const boundaryPoints = calculateSectorBoundaryPoints(sector, 32);
  let minDist = Infinity;
  
  for (const boundaryPoint of boundaryPoints) {
    const dist = distance(point, boundaryPoint);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  
  return minDist;
}

/** 创建扇环（带内半径的扇形） */
export function createAnnularSector(
  center: Point,
  centerAngle: number,
  arcWidth: number,
  innerRadius: number,
  outerRadius: number
): Sector {
  if (innerRadius < 0) throw new Error("innerRadius must be non-negative");
  if (outerRadius <= innerRadius) throw new Error("outerRadius must be greater than innerRadius");
  
  return {
    center,
    centerAngle,
    arcWidth,
    radius: outerRadius,
    innerRadius,
  };
}

/** 检查扇环是否有效（内半径小于外半径） */
export function isValidAnnularSector(sector: Sector): boolean {
  const innerRadius = sector.innerRadius ?? 0;
  return innerRadius >= 0 && innerRadius < sector.radius;
}

/** 计算扇环的面积 */
export function calculateAnnularSectorArea(sector: Sector): number {
  const innerRadius = sector.innerRadius ?? 0;
  const outerRadius = sector.radius;
  const arcFraction = sector.arcWidth / 360;
  
  return Math.PI * arcFraction * (outerRadius * outerRadius - innerRadius * innerRadius);
}

/** 获取扇环的有效区域（排除内半径部分） */
export function getAnnularSectorValidZone(sector: Sector): {
  minDistance: number;
  maxDistance: number;
  centerAngle: number;
  arcWidth: number;
} {
  const innerRadius = sector.innerRadius ?? 0;
  return {
    minDistance: innerRadius,
    maxDistance: sector.radius,
    centerAngle: sector.centerAngle,
    arcWidth: sector.arcWidth,
  };
}