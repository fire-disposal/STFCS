/**
 * 几何计算工具 - 航海坐标系统一实现
 * 
 * 航海坐标系约定：
 * - 0° = 船头（屏幕上方/Y负方向）
 * - 90° = 右舷（屏幕右侧/X正方向）
 * - 180° = 船尾（屏幕下方/Y正方向）
 * - 270° = 左舷（屏幕左侧/X负方向）
 * - 顺时针增加
 * 
 * 屏幕坐标系：
 * - Y 向下（左上角为原点）
 * - 航海角度需要 dy 反转处理
 * 
 * 挂载点偏移坐标系：
 * - offsetX：左舷为正（heading=0时指向-X）
 * - offsetY：船头为正（heading=0时指向-Y）
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
 * 计算两点间的航海角度
 * 
 * @param from - 起点
 * @param to - 终点
 * @returns 航海角度（0-360），0°指向屏幕上方
 * 
 * 实现：dy 反转 + atan2(dx, dy) 参数顺序
 * - dy = from.y - to.y（反转：屏幕Y向下，航海Y向上）
 * - atan2(dx, dy) 以 Y 轴为基准，dx 正值 → 90°（右舷）
 */
export function angleBetween(from: Point, to: Point): number {
	const dx = to.x - from.x;
	const dy = from.y - to.y;
	const angle = toDegrees(Math.atan2(dx, dy));
	return normalizeAngle(angle);
}

/**
 * 航海角度 → 数学角度（用于 PixiJS 绘制）
 * 
 * 航海 0°（上）→ 数学 -90°
 * 航海 90°（右）→ 数学 0°
 */
export function nauticalToMath(nauticalAngle: number): number {
	return nauticalAngle - 90;
}

/**
 * 数学角度 → 航海角度
 */
export function mathToNautical(mathAngle: number): number {
	return normalizeAngle(mathAngle + 90);
}

// ==================== 坐标转换 ====================

/**
 * 计算挂载点世界坐标
 * 
 * @param shipPos - 舰船位置
 * @param shipHeading - 舰船朝向（航海角度）
 * @param mountOffset - 挂载点偏移（左舷/船头为正）
 * @returns 挂载点世界坐标
 * 
 * 标准公式：
 * worldX = shipX - offsetX*cos(heading) + offsetY*sin(heading)
 * worldY = shipY - offsetX*sin(heading) - offsetY*cos(heading)
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
		x: shipPos.x - mountOffset.x * cos + mountOffset.y * sin,
		y: shipPos.y - mountOffset.x * sin - mountOffset.y * cos
	};
}

/**
 * 计算移动向量（前进 + 侧移）
 * 
 * @param heading - 舰船朝向（航海角度）
 * @param forward - 前进距离（正=前，负=后）
 * @param strafe - 侧移距离（正=左，负=右）
 * @returns 移动向量（屏幕坐标系）
 * 
 * 前进方向向量：(sin(θ), -cos(θ))
 * 侧移方向向量：(cos(θ), sin(θ))
 */
export function getMovementVector(
	heading: number,
	forward: number,
	strafe: number
): Point {
	const rad = toRadians(heading);
	const sin = Math.sin(rad);
	const cos = Math.cos(rad);
	
	return {
		x: forward * sin + strafe * cos,
		y: -forward * cos + strafe * sin
	};
}

/**
 * 应用移动向量到位置
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
 * PixiJS 正角度逆时针旋转
 * 航海角度顺时针增加
 * 使用正数：rotation = heading * PI/180
 * 
 * 注意：假设贴图设计船头朝上（未旋转）
 */
export function toPixiRotation(nauticalAngle: number): number {
	return toRadians(nauticalAngle);
}

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
 * 
 * @param angle - 目标角度（航海角度）
 * @param center - 弧中心角度（航海角度）
 * @param arc - 弧宽度（度）
 */
export function isAngleInArc(angle: number, center: number, arc: number): boolean {
	const halfArc = arc / 2;
	const diff = normalizeAngleSigned(angle - center);
	return Math.abs(diff) <= halfArc;
}

// ==================== 扩展几何函数 ====================

/**
 * 计算角度差（0-180度）
 */
export function angleDifference(angle1: number, angle2: number): number {
	let diff = Math.abs(angle1 - angle2) % 360;
	if (diff > 180) diff = 360 - diff;
	return diff;
}

/**
 * 计算从起始角度到目标角度的最短转向角度（带方向）
 */
export function calculateTurnAngle(startAngle: number, targetAngle: number): number {
	return normalizeAngleSigned(targetAngle - startAngle);
}

/**
 * 角度插值（考虑360度环绕）
 */
export function lerpAngle(startAngle: number, targetAngle: number, t: number): number {
	const diff = calculateTurnAngle(startAngle, targetAngle);
	return normalizeAngle(startAngle + diff * t);
}

/**
 * 检查点是否在圆形区域内
 */
export function isPointInCircle(point: Point, center: Point, radius: number): boolean {
	return distanceBetween(point, center) <= radius;
}

/**
 * 检查点是否在矩形区域内
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
 * 检查点是否在环形扇形区域内（用于瞄准判定）
 * 
 * @param point - 待检测点
 * @param center - 扇形中心
 * @param centerAngle - 扇形中心角度（航海角度）
 * @param arcWidth - 扇形角度宽度（度）
 * @param outerRadius - 外半径
 * @param innerRadius - 内半径（最小射程，默认0）
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