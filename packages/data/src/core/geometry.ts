/**
 * 几何计算工具 - 权威航海坐标系实现
 * 
 * 北东坐标系（Navigation/Bearing System）：
 * - 北(North, 0°) = 船头方向 = Y轴正向（屏幕Y减小）
 * - 东(East, 90°) = 右舷方向 = X轴正向（屏幕X增大）
 * - 南(South, 180°) = 船尾方向 = Y轴负向（屏幕Y增大）
 * - 西(West, 270°) = 左舷方向 = X轴负向（屏幕X减小）
 * - 角度顺时针增加（北→东→南→西）
 * 
 * 屏幕坐标系：
 * - 原点左上角
 * - X向右为正（对应航海坐标系东）
 * - Y向下为正（航海坐标系北对应屏幕Y减小）
 * 
 * 偏移坐标系（与航海坐标系一致）：
 * - offsetX 正值 = 右舷（东，屏幕+X）
 * - offsetX 负值 = 左舷（西，屏幕-X）
 * - offsetY 正值 = 船头（北，屏幕-Y）
 * - offsetY 负值 = 船尾（南，屏幕+Y）
 * 
 * 移动命令：
 * - forward 正值 = 前进（北/船头，屏幕Y减小）
 * - forward 负值 = 后退（南/船尾，屏幕Y增大）
 * - strafe 正值 = 右移（东/右舷，屏幕X增大）
 * - strafe 负值 = 左移（西/左舷，屏幕X减小）
 */

import type { Point } from "./GameSchemas.js";

// ==================== 角度基础 ====================

export function normalizeAngle(angle: number): number {
	angle = angle % 360;
	if (angle < 0) angle += 360;
	return angle;
}

export function normalizeAngleSigned(angle: number): number {
	angle = ((angle + 180) % 360) - 180;
	return angle;
}

export function toRadians(degrees: number): number {
	return degrees * Math.PI / 180;
}

export function toDegrees(radians: number): number {
	return radians * 180 / Math.PI;
}

// ==================== 角度计算 ====================

/**
 * 计算两点间的航海角度（北东坐标系）
 * 
 * @param from - 起点
 * @param to - 终点
 * @returns 航海角度（0-360），0°=北/船头方向
 * 
 * 北东坐标系：
 * - 屏幕Y减小 = 北方向
 * - 屏幕X增大 = 东方向
 * - angleBetween 返回从 from 到 to 的方向
 */
export function angleBetween(from: Point, to: Point): number {
	const dx = to.x - from.x;
	const dy = from.y - to.y;  // 反转：屏幕Y向下，航海Y向上
	const angle = toDegrees(Math.atan2(dx, dy));
	return normalizeAngle(angle);
}

/**
 * 航海角度 → 数学角度（用于 PixiJS 绘制）
 * 
 * 航海坐标系：0°=北/Y正，顺时针
 * 数学坐标系：0°=东/X正，逆时针
 * 
 * 转换：mathAngle = 90° - nauticalAngle
 * - 北(0°) → 数学90°
 * - 东(90°) → 数学0°
 * - 南(180°) → 数学-90°
 * - 西(270°) → 数学-180°
 */
export function nauticalToMath(nauticalAngle: number): number {
	return 90 - nauticalAngle;
}

/**
 * 数学角度 → 航海角度
 */
export function mathToNautical(mathAngle: number): number {
	return normalizeAngle(90 - mathAngle);
}

// ==================== 坐标转换 ====================

/**
 * 计算挂载点世界坐标（北东坐标系）
 * 
 * @param shipPos - 舰船屏幕位置
 * @param shipHeading - 舰船朝向（航海角度，0°=北/船头）
 * @param mountOffset - 挂载点偏移（北东坐标系：正X=东/右舷，正Y=北/船头）
 * @returns 挂载点屏幕坐标
 * 
 * 偏移定义：
 * - offsetX 正值 = 右舷位置（heading=0时在屏幕+X）
 * - offsetY 正值 = 船头位置（heading=0时在屏幕-Y）
 * 
 * 公式推导：
 * - heading=0°（船头向上）：mount在(offsetX, -offsetY)
 * - heading=90°（船头向右）：mount在(offsetY, offsetX)
 * 
 * 世界坐标：
 * worldX = shipX + offsetX*cos(heading) - offsetY*sin(heading)
 * worldY = shipY + offsetX*sin(heading) + offsetY*cos(heading)
 * 
 * 注意：屏幕Y向下，所以船头(offsetY正)对应屏幕Y减小
 */
export function getMountWorldPosition(
	shipPos: Point,
	shipHeading: number,
	mountOffset: Point
): Point {
	const rad = toRadians(shipHeading);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	
	return {
		x: shipPos.x + mountOffset.x * cos - mountOffset.y * sin,
		y: shipPos.y + mountOffset.x * sin + mountOffset.y * cos
	};
}

/**
 * 计算移动向量（北东坐标系）
 * 
 * @param heading - 舰船朝向（航海角度，0°=北/船头）
 * @param forward - 前进距离（正值=北/前进，负值=南/后退）
 * @param strafe - 侧移距离（正值=东/右移，负值=西/左移）
 * @returns 移动向量（屏幕坐标系：X向右正，Y向下正）
 * 
 * 方向向量（heading角度）：
 * - 前进方向（北）：屏幕(-sin, cos) → heading=0时(0,-1)向上
 * - 右舷方向（东）：屏幕(cos, sin) → heading=0时(1,0)向右
 * 
 * 公式：
 * Δx = strafe * cos(θ) - forward * sin(θ)
 * Δy = strafe * sin(θ) + forward * cos(θ)
 * 
 * 验证（heading=0°）：
 * - forward=100 → Δx=0, Δy=100 → 屏幕Y增大100（向下）← 错误！应该是向上
 * 
 * 正确公式（考虑屏幕Y反转）：
 * Δx = strafe * cos(θ) + forward * sin(θ)
 * Δy = strafe * sin(θ) - forward * cos(θ)
 * 
 * 验证（heading=0°，cos=1, sin=0）：
 * - forward=100 → Δx=0, Δy=-100 → 屏幕Y减小100（向上）✓
 * - strafe=100 → Δx=100, Δy=0 → 屏幕X增大100（向右）✓
 */
export function getMovementVector(
	heading: number,
	forward: number,
	strafe: number
): Point {
	const rad = toRadians(heading);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	
	return {
		x: strafe * cos + forward * sin,
		y: strafe * sin - forward * cos
	};
}

/**
 * 应用移动到位置
 */
export function applyMovement(
	position: Point,
	heading: number,
	forward: number,
	strafe: number
): Point {
	const vector = getMovementVector(heading, forward, strafe);
	return {
		x: position.x + vector.x,
		y: position.y + vector.y
	};
}

// ==================== PixiJS 渲染辅助 ====================

/**
 * 航海角度 → PixiJS rotation
 * 
 * PixiJS：正角度逆时针旋转
 * 航海坐标系：顺时针增加（北→东→南→西）
 * 
 * 旋转关系：
 * - 船头朝北(0°)：贴图不旋转，rotation=0
 * - 船头朝东(90°)：贴图顺时针转90°，PixiJS rotation=-90°或270°
 * 
 * 公式：rotation = -heading（弧度）
 * 或者：rotation = heading（弧度）← 取决于贴图设计方向
 * 
 * 约定：贴图船头朝上（未旋转），使用正数rotation
 * 因为 PixiJS逆时针 与 航海顺时针 恰好抵消
 */
export function toPixiRotation(nauticalAngle: number): number {
	return toRadians(nauticalAngle);
}

// ==================== 几何检测 ====================

/**
 * 计算两点距离
 */
export function distanceBetween(from: Point, to: Point): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检查角度是否在弧度范围内
 */
export function isAngleInArc(angle: number, center: number, arc: number): boolean {
	const halfArc = arc / 2;
	const diff = normalizeAngleSigned(angle - center);
	return Math.abs(diff) <= halfArc;
}

/**
 * 计算角度差（0-180度）
 */
export function angleDifference(angle1: number, angle2: number): number {
	let diff = Math.abs(angle1 - angle2) % 360;
	if (diff > 180) diff = 360 - diff;
	return diff;
}

/**
 * 计算最短转向角度（带方向）
 */
export function calculateTurnAngle(startAngle: number, targetAngle: number): number {
	return normalizeAngleSigned(targetAngle - startAngle);
}

/**
 * 角度插值
 */
export function lerpAngle(startAngle: number, targetAngle: number, t: number): number {
	const diff = calculateTurnAngle(startAngle, targetAngle);
	return normalizeAngle(startAngle + diff * t);
}

/**
 * 点是否在圆内
 */
export function isPointInCircle(point: Point, center: Point, radius: number): boolean {
	return distanceBetween(point, center) <= radius;
}

/**
 * 点是否在矩形内
 */
export function isPointInRect(
	point: Point,
	rect: { x: number; y: number; width: number; height: number }
): boolean {
	return (
		point.x >= rect.x &&
		point.x <= rect.x + rect.width &&
		point.y >= rect.y &&
		point.y <= rect.y + rect.height
	);
}

/**
 * 点是否在环形扇形内（用于瞄准判定）
 */
export function isPointInAnnularSector(
	point: Point,
	center: Point,
	centerAngle: number,
	arcWidth: number,
	outerRadius: number,
	innerRadius: number = 0
): boolean {
	const dist = distanceBetween(point, center);
	
	if (dist > outerRadius || dist < innerRadius) {
		return false;
	}
	
	if (arcWidth >= 360) {
		return true;
	}
	
	const angleToPoint = angleBetween(center, point);
	return isAngleInArc(angleToPoint, centerAngle, arcWidth);
}