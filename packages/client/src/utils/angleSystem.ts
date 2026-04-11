/**
 * ============================================================================
 * STFCS 角度参考系系统
 * ============================================================================
 * 
 * 本文档定义了系统中使用的所有角度参考系，确保角度计算清晰、一致。
 * 
 * 核心原则：
 * 1. 内部存储统一使用数学角度（标准笛卡尔坐标系）
 * 2. 显示和输入可以根据用户偏好转换
 * 3. 所有转换函数必须明确标注参考系
 * 
 * ============================================================================
 */

// ============================================================================
// 角度参考系定义
// ============================================================================

/**
 * 1. 数学角度 (Math Angle) - 系统内部标准
 * -----------------------------------------------------------------------------
 * - 0°: 正东方向 (+X 轴)
 * - 90°: 正北方向 (+Y 轴)
 * - 180°: 正西方向 (-X 轴)
 * - 270°: 正南方向 (-Y 轴)
 * - 增长方向：逆时针
 * 
 * 用途：
 * - 所有内部计算
 * - 数据存储
 * - 物理引擎
 * 
 * 坐标系可视化：
 *        90° (北)
 *          ↑
 *          |
 * 270° ←--+→ 0° (东)
 * (南)    |
 *          ↓
 *        270° (实际是 -90°，规范化后)
 * 
 * 正确版本：
 *        90°
 *          ↑
 *          |
 * 180° ←--+→ 0°
 *          |
 *          ↓
 *        270° (或 -90°)
 */

/**
 * 2. 航海角度 (Navigation Angle) - 可选显示模式
 * -----------------------------------------------------------------------------
 * - 0°: 正北方向
 * - 90°: 正东方向
 * - 180°: 正南方向
 * - 270°: 正西方向
 * - 增长方向：顺时针
 * 
 * 用途：
 * - 航海导航显示
 * - 传统海图作业
 * - 部分用户偏好
 */

/**
 * 3. 屏幕角度 (Screen Angle) - 渲染用
 * -----------------------------------------------------------------------------
 * - 0°: 屏幕上方（12 点钟方向）
 * - 90°: 屏幕右方（3 点钟方向）
 * - 180°: 屏幕下方（6 点钟方向）
 * - 270°: 屏幕左方（9 点钟方向）
 * - 增长方向：顺时针
 * 
 * 用途：
 * - PixiJS 渲染旋转
 * - UI 元素方向
 * 
 * 注意：PixiJS 的旋转是顺时针的，0 度朝右
 */

/**
 * 4. 视图旋转角度 (View Rotation) - 相机旋转
 * -----------------------------------------------------------------------------
 * - 0°: 标准朝向（北上）
 * - 正值：逆时针旋转视图
 * - 负值：顺时针旋转视图
 * - 范围：-180° 到 180°
 * 
 * 用途：
 * - 相机旋转
 * - 对齐到舰船朝向
 */

// ============================================================================
// 角度转换函数
// ============================================================================

/**
 * 规范化角度到 0-360 范围
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
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
 * 数学角度 → 航海角度
 * 
 * 转换规则：
 * 数学 0° (东)   → 航海 90° (东)
 * 数学 90° (北)  → 航海 0° (北)
 * 数学 180° (西) → 航海 270° (西)
 * 数学 270° (南) → 航海 180° (南)
 * 
 * 公式：nav = (450 - math) % 360
 */
export function mathToNav(mathAngle: number): number {
  return normalizeAngle(450 - mathAngle);
}

/**
 * 航海角度 → 数学角度
 * 
 * 转换规则：逆向应用上述公式
 * 公式：math = (450 - nav) % 360
 */
export function navToMath(navAngle: number): number {
  return normalizeAngle(450 - navAngle);
}

/**
 * 数学角度 → 屏幕角度（PixiJS 渲染）
 * 
 * PixiJS 使用：0°朝右，顺时针增长
 * 数学角度：0°朝东（右），逆时针增长
 * 
 * 所以：screen = -math = 360 - math
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
 * 需求：将舰船的朝向旋转到屏幕上方
 * 
 * 步骤：
 * 1. 获取舰船的数学角度
 * 2. 计算需要旋转的角度使舰船朝上（90°）
 * 3. viewRotation = 90 - mathAngle
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
// 坐标计算（明确标注参考系）
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
  const rad = mathAngle * Math.PI / 180;
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
 * 计算两个角度之间的最小差值（返回 -180 到 180）
 * 
 * 正值：target 在 current 的逆时针方向
 * 负值：target 在 current 的顺时针方向
 */
export function angleDifference(current: number, target: number): number {
  let diff = (target - current + 180) % 360;
  if (diff < 0) diff -= 360;
  return diff > 180 ? diff - 360 : diff;
}

// ============================================================================
// 角度格式化（用于 UI 显示）
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
 * 
 * 场景：用户希望舰船的朝向在屏幕上垂直向上
 */
export function alignViewToShip(shipMathAngle: number): number {
  // 计算视图旋转角度
  const viewRotation = calculateViewRotationForAlignment(shipMathAngle);
  return viewRotation;
  // 结果：应用此旋转到相机，舰船将朝上
}

/**
 * 示例 2：显示角度到 UI
 * 
 * 场景：在 UI 上显示舰船朝向，用户选择航海模式
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
 * 
 * 场景：用户输入目标航向，系统需要转换为内部数学角度
 */
export function setTargetHeading(userInput: string, mode: AngleDisplayMode): number {
  const mathAngle = parseAngleInput(userInput, mode);
  return mathAngle;
  // 后续所有计算使用 mathAngle（数学角度）
}
