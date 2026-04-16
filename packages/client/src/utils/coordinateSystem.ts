/**
 * ============================================================================
 * 坐标系统 (CoordinateSystem)
 * ============================================================================
 *
 * 统一的坐标与角度处理模块
 * 
 * 合并自：
 * - angleSystem.ts (角度参考系系统)
 * - angleUtils.ts (角度工具)
 * - mathUtils.ts (数学工具)
 *
 * 核心原则：
 * 1. 内部存储统一使用数学角度（标准笛卡尔坐标系）
 * 2. 所有转换函数必须明确标注参考系
 * 3. 屏幕坐标转换保持与现有行为完全一致
 *
 * ============================================================================
 */

// ============================================================================
// 基础工具函数
// ============================================================================

/**
 * 将角度转换为弧度
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 将弧度转换为角度
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * 度数转弧度 (degToRad 别名)
 */
export const degToRad = toRadians;

/**
 * 弧度转度数 (radToDeg 别名)
 */
export const radToDeg = toDegrees;

// ============================================================================
// 角度规范化
// ============================================================================

/**
 * 规范化角度到 0-360 范围
 */
export function normalizeAngle(angle: number): number {
  // 使用数学公式确保结果总是正数 0-360
  // ((angle % 360) + 360) % 360 处理所有情况包括 -0
  return ((angle % 360) + 360) % 360;
}

/**
 * 规范化角度到 -180 到 180 范围（用于视图旋转）
 */
export function normalizeRotation(angle: number): number {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

/**
 * 标准化角度到 -180~180 范围 (normalizeAngleSigned 别名)
 */
export const normalizeAngleSigned = normalizeRotation;

// ============================================================================
// 角度差计算
// ============================================================================

/**
 * 计算两个角度之间的最短差值（带符号）
 * 返回值范围：-180 ~ 180
 */
export function angleDifference(from: number, to: number): number {
  const diff = normalizeAngle(to - from);
  return diff > 180 ? diff - 360 : diff;
}

/**
 * 计算两个角度之间的最小差值（绝对值）
 */
export function angleDifferenceAbs(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// ============================================================================
// 角度参考系转换
// ============================================================================

/**
 * 数学角度 → 航海角度
 * 
 * 数学角度：0°东，90°北，逆时针
 * 航海角度：0°北，90°东，顺时针
 */
export function mathToNav(mathAngle: number): number {
  return normalizeAngle(450 - mathAngle);
}

/**
 * 航海角度 → 数学角度
 */
export function navToMath(navAngle: number): number {
  return normalizeAngle(450 - navAngle);
}

/**
 * 数学角度 → 屏幕角度（PixiJS 渲染）
 * 
 * 数学角度：0°东，逆时针
 * 屏幕角度：0°东，顺时针
 */
export function mathToScreen(mathAngle: number): number {
  return normalizeAngle(360 - mathAngle);
}

/**
 * 屏幕角度 → 数学角度
 */
export function screenToMath(screenAngle: number): number {
  return normalizeAngle(360 - screenAngle);
}

/**
 * 计算视图旋转角度（使对象朝上）
 * 
 * 示例：
 * - 舰船朝东 (0°) → viewRotation = 90° (逆时针转 90°)
 * - 舰船朝北 (90°) → viewRotation = 0° (无需旋转)
 * - 舰船朝西 (180°) → viewRotation = -90° (顺时针转 90°)
 */
export function calculateViewRotationForAlignment(mathAngle: number): number {
  return normalizeRotation(90 - mathAngle);
}

// ============================================================================
// 屏幕 ↔ 世界坐标转换
// ============================================================================

/**
 * 屏幕坐标转世界坐标
 *
 * @param screenX 屏幕 X（相对于画布中心）
 * @param screenY 屏幕 Y（相对于画布中心）
 * @param zoom 缩放级别
 * @param cameraX 相机 X 位置（世界坐标）
 * @param cameraY 相机 Y 位置（世界坐标）
 * @param viewRotation 视图旋转角度（度数）
 * @returns 世界坐标
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  zoom: number,
  cameraX: number,
  cameraY: number,
  viewRotation: number
): { x: number; y: number } {
  const theta = toRadians(viewRotation);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const rotatedX = screenX * cos - screenY * sin;
  const rotatedY = screenX * sin + screenY * cos;

  return {
    x: cameraX + rotatedX / zoom,
    y: cameraY + rotatedY / zoom,
  };
}

/**
 * 世界坐标转屏幕坐标
 *
 * @param worldX 世界 X 坐标
 * @param worldY 世界 Y 坐标
 * @param zoom 缩放级别
 * @param cameraX 相机 X 位置（世界坐标）
 * @param cameraY 相机 Y 位置（世界坐标）
 * @param viewRotation 视图旋转角度（度数）
 * @returns 屏幕坐标（相对于画布中心）
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  zoom: number,
  cameraX: number,
  cameraY: number,
  viewRotation: number
): { x: number; y: number } {
  const relativeX = (worldX - cameraX) * zoom;
  const relativeY = (worldY - cameraY) * zoom;

  const theta = toRadians(-viewRotation);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  return {
    x: relativeX * cos - relativeY * sin,
    y: relativeX * sin + relativeY * cos,
  };
}

/**
 * 屏幕向量转世界向量（仅考虑旋转和缩放，不考虑位置）
 *
 * @param screenDx 屏幕 X 向量
 * @param screenDy 屏幕 Y 向量
 * @param zoom 缩放级别
 * @param viewRotation 视图旋转角度（度数）
 * @returns 世界向量
 */
export function screenDeltaToWorldDelta(
  screenDx: number,
  screenDy: number,
  zoom: number,
  viewRotation: number
): { x: number; y: number } {
  const theta = toRadians(viewRotation);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const rotatedX = screenDx * cos - screenDy * sin;
  const rotatedY = screenDx * sin + screenDy * cos;

  return {
    x: rotatedX / zoom,
    y: rotatedY / zoom,
  };
}

/**
 * 世界向量转屏幕向量
 */
export function worldDeltaToScreenDelta(
  worldDx: number,
  worldDy: number,
  zoom: number,
  viewRotation: number
): { x: number; y: number } {
  const theta = toRadians(viewRotation);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  return {
    x: -(worldDx * cos - worldDy * sin) * zoom,
    y: -(worldDx * sin + worldDy * cos) * zoom,
  };
}

// ============================================================================
// 极坐标 ↔ 笛卡尔坐标
// ============================================================================

/**
 * 极坐标 → 笛卡尔坐标（数学角度系统）
 *
 * @param distance 距离
 * @param mathAngle 数学角度（0°东，逆时针）
 * @param centerX 中心 X
 * @param centerY 中心 Y
 */
export function polarToCartesian(
  distance: number,
  mathAngle: number,
  centerX: number = 0,
  centerY: number = 0
): { x: number; y: number } {
  const rad = toRadians(mathAngle);
  return {
    x: centerX + distance * Math.cos(rad),
    y: centerY + distance * Math.sin(rad),
  };
}

/**
 * 笛卡尔坐标 → 极坐标（数学角度系统）
 *
 * @param x X 坐标
 * @param y Y 坐标
 * @param centerX 中心 X
 * @param centerY 中心 Y
 * @returns { distance, mathAngle }
 */
export function cartesianToPolar(
  x: number,
  y: number,
  centerX: number = 0,
  centerY: number = 0
): { distance: number; mathAngle: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const mathAngle = normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI);

  return { distance, mathAngle };
}

// ============================================================================
// 角度与方向计算
// ============================================================================

/**
 * 计算从点 A 到点 B 的方向角（数学角度）
 */
export function angleFromAToB(
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  return normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI);
}

/**
 * 计算两点之间的角度（度数）
 * 返回值范围：0-360，0°指向右方（+X 轴），顺时针
 */
export function angleToPoint(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  return normalizeAngle(toDegrees(Math.atan2(dy, dx)));
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
 * 根据角度和距离计算目标点
 */
export function pointAtAngle(
  fromX: number,
  fromY: number,
  angle: number,
  dist: number
): { x: number; y: number } {
  const rad = toRadians(angle);
  return {
    x: fromX + Math.cos(rad) * dist,
    y: fromY + Math.sin(rad) * dist,
  };
}

/**
 * 线性插值角度（沿最短路径）
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDifference(from, to);
  return normalizeAngle(from + diff * t);
}

// ============================================================================
// 通用数学工具
// ============================================================================

/**
 * 限制值在指定范围内
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// 角度格式化与解析（UI 显示）
// ============================================================================

export type AngleDisplayMode = 'math' | 'nav' | 'screen';

export interface AngleDisplayOptions {
  mode: AngleDisplayMode;
  showDecimal: boolean;
  showCompassDirection?: boolean; // 是否显示方位（N/NE/E 等）
}

/**
 * 格式化角度显示
 */
export function formatAngle(
  mathAngle: number,
  options: AngleDisplayOptions = { mode: 'math', showDecimal: false }
): string {
  let displayAngle: number;
  let suffix = '°';

  switch (options.mode) {
    case 'math':
      displayAngle = normalizeAngle(mathAngle);
      break;
    case 'nav':
      displayAngle = mathToNav(mathAngle);
      suffix = '°N'; // 航海角度标记
      break;
    case 'screen':
      displayAngle = mathToScreen(mathAngle);
      suffix = '°S'; // 屏幕角度标记
      break;
  }

  const formatted = options.showDecimal
    ? displayAngle.toFixed(1)
    : Math.round(displayAngle).toString();

  return formatted + suffix;
}

/**
 * 解析用户输入的角度（根据当前模式）
 */
export function parseAngleInput(
  input: string,
  mode: AngleDisplayMode = 'math'
): number {
  // 移除度符号和其他非数字字符
  const cleanInput = input.replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleanInput);

  if (isNaN(value)) return 0;

  switch (mode) {
    case 'math':
      return normalizeAngle(value);
    case 'nav':
      return navToMath(value);
    case 'screen':
      return screenToMath(value);
  }
}

/**
 * 获取方位名称（用于辅助显示）
 */
export function getCompassDirection(mathAngle: number): string {
  const navAngle = mathToNav(mathAngle);

  if (navAngle >= 348.75 || navAngle < 11.25) return 'N';
  if (navAngle >= 11.25 && navAngle < 56.25) return 'NE';
  if (navAngle >= 56.25 && navAngle < 101.25) return 'E';
  if (navAngle >= 101.25 && navAngle < 146.25) return 'SE';
  if (navAngle >= 146.25 && navAngle < 191.25) return 'S';
  if (navAngle >= 191.25 && navAngle < 236.25) return 'SW';
  if (navAngle >= 236.25 && navAngle < 281.25) return 'W';
  if (navAngle >= 281.25 && navAngle < 326.25) return 'NW';
  return 'N';
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1：对齐视图到舰船朝向
 */
export function alignViewToShip(shipMathAngle: number): number {
  const viewRotation = calculateViewRotationForAlignment(shipMathAngle);
  return viewRotation;
}

/**
 * 示例 2：显示角度到 UI
 */
export function displayShipHeading(shipMathAngle: number): string {
  return formatAngle(shipMathAngle, {
    mode: 'nav',
    showDecimal: true,
    showCompassDirection: true,
  });
  // 输出示例："45.0°N (NE)"
}

/**
 * 示例 3：解析用户输入的目标角度
 */
export function setTargetHeading(userInput: string, mode: AngleDisplayMode): number {
  const mathAngle = parseAngleInput(userInput, mode);
  return mathAngle;
}
