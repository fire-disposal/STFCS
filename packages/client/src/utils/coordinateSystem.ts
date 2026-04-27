/**
 * ============================================================================
 * 坐标系统 (CoordinateSystem) - UI/渲染专用
 * ============================================================================
 *
 * 本模块仅包含 UI 和渲染相关的坐标/角度函数。
 *
 * ⚠️ 游戏规则相关函数请从 @vt/rules 导入：
 * - distance()         → @vt/rules 的 distance
 * - angleBetween()     → @vt/rules 的 angleBetween
 * - angleDifference()  → @vt/rules 的 angleDifference（返回绝对值 0~180）
 * - normalizeAngle()   → @vt/rules 的 normalizeAngle
 * - toRadians()        → @vt/rules 的 toRadians
 * - toDegrees()        → @vt/rules 的 toDegrees
 *
 * 本模块保留的函数用途：
 * - 屏幕坐标转换（screenToWorld, worldToScreen 等）
 * - 视图旋转（normalizeRotation, calculateViewRotationForAlignment）
 * - 角度参考系转换（mathToNav, navToMath, mathToScreen, screenToMath）
 * - UI 显示格式化（formatAngle, parseAngleInput, getCompassDirection）
 * - 极坐标转换（polarToCartesian, cartesianToPolar）
 * - 通用数学工具（clampValue, lerp）
 *
 * ============================================================================
 */

// ============================================================================
// 角度参考系转换
// ============================================================================

/**
 * 规范化角度到 0-360 范围（内部使用）
 * 用于参考系转换，游戏规则请使用 @vt/rules 的 normalizeAngle
 */
function normalizeAngleInternal(angle: number): number {
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
 * 计算带符号的角度差（内部使用，用于 lerpAngle）
 * 游戏规则请使用 @vt/rules 的 angleDifference（返回绝对值）
 */
function angleDifferenceSigned(from: number, to: number): number {
  const diff = normalizeAngleInternal(to - from);
  return diff > 180 ? diff - 360 : diff;
}

/**
 * 数学角度 → 航海角度
 *
 * 数学角度：0°东，90°北，逆时针
 * 航海角度：0°北，90°东，顺时针
 */
export function mathToNav(mathAngle: number): number {
  return normalizeAngleInternal(450 - mathAngle);
}

/**
 * 航海角度 → 数学角度
 */
export function navToMath(navAngle: number): number {
  return normalizeAngleInternal(450 - navAngle);
}

/**
 * 数学角度 → 屏幕角度（PixiJS 渲染）
 *
 * 数学角度：0°东，逆时针
 * 屏幕角度：0°东，顺时针
 */
export function mathToScreen(mathAngle: number): number {
  return normalizeAngleInternal(360 - mathAngle);
}

/**
 * 屏幕角度 → 数学角度
 */
export function screenToMath(screenAngle: number): number {
  return normalizeAngleInternal(360 - screenAngle);
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
 * 将角度转换为弧度（内部使用）
 */
function toRadiansInternal(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

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
  const theta = toRadiansInternal(viewRotation);
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

  const theta = toRadiansInternal(-viewRotation);
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
  const theta = toRadiansInternal(viewRotation);
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
  const theta = toRadiansInternal(viewRotation);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  return {
    x: -(worldDx * cos - worldDy * sin) * zoom,
    y: -(worldDx * sin + worldDy * cos) * zoom,
  };
}

// ============================================================================
// 极坐标 ↔ 笛卡尔坐标（渲染用）
// ============================================================================

/**
 * 极坐标 → 笛卡尔坐标（数学角度系统）
 *
 * @param r 距离
 * @param mathAngle 数学角度（0°东，逆时针）
 * @param centerX 中心 X
 * @param centerY 中心 Y
 */
export function polarToCartesian(
  r: number,
  mathAngle: number,
  centerX: number = 0,
  centerY: number = 0
): { x: number; y: number } {
  const rad = toRadiansInternal(mathAngle);
  return {
    x: centerX + r * Math.cos(rad),
    y: centerY + r * Math.sin(rad),
  };
}

/**
 * 笛卡尔坐标 → 极坐标（数学角度系统）
 *
 * @param x X 坐标
 * @param y Y 坐标
 * @param centerX 中心 X
 * @param centerY 中心 Y
 * @returns { r, mathAngle }
 */
export function cartesianToPolar(
  x: number,
  y: number,
  centerX: number = 0,
  centerY: number = 0
): { r: number; mathAngle: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  const r = Math.sqrt(dx * dx + dy * dy);
  const mathAngle = normalizeAngleInternal(Math.atan2(dy, dx) * 180 / Math.PI);

  return { r, mathAngle };
}

// ============================================================================
// 角度与方向计算（渲染用）
// ============================================================================

/**
 * 根据角度和距离计算目标点
 */
export function pointAtAngle(
  fromX: number,
  fromY: number,
  angle: number,
  dist: number
): { x: number; y: number } {
  const rad = toRadiansInternal(angle);
  return {
    x: fromX + Math.cos(rad) * dist,
    y: fromY + Math.sin(rad) * dist,
  };
}

/**
 * 线性插值角度（沿最短路径，用于动画）
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDifferenceSigned(from, to);
  return normalizeAngleInternal(from + diff * t);
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
  showCompassDirection?: boolean;
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
      displayAngle = normalizeAngleInternal(mathAngle);
      break;
    case 'nav':
      displayAngle = mathToNav(mathAngle);
      suffix = '°N';
      break;
    case 'screen':
      displayAngle = mathToScreen(mathAngle);
      suffix = '°S';
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
  const cleanInput = input.replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleanInput);

  if (isNaN(value)) return 0;

  switch (mode) {
    case 'math':
      return normalizeAngleInternal(value);
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
