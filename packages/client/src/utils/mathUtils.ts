/**
 * 数学工具模块
 *
 * 统一规范所有角度和坐标计算
 */

/**
 * 度数转弧度
 */
export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * 弧度转度数
 */
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * 标准化角度到 0-360 范围
 */
export const normalizeAngle = (angle: number): number => {
	let normalized = angle % 360;
	if (normalized < 0) normalized += 360;
	return normalized;
};

/**
 * 标准化角度到 -180~180 范围
 */
export const normalizeAngleSigned = (angle: number): number => {
	let normalized = angle % 360;
	if (normalized > 180) normalized -= 360;
	else if (normalized < -180) normalized += 360;
	return normalized;
};

/**
 * 计算两个角度之间的最短差值（带符号）
 * 返回值范围：-180 ~ 180
 */
export const angleDifference = (from: number, to: number): number => {
	const diff = normalizeAngle(to - from);
	return diff > 180 ? diff - 360 : diff;
};

/**
 * 屏幕坐标转世界坐标（考虑旋转和缩放）
 *
 * @param screenX 屏幕 X（相对于画布中心）
 * @param screenY 屏幕 Y（相对于画布中心）
 * @param zoom 缩放级别
 * @param cameraX 相机 X 位置
 * @param cameraY 相机 Y 位置
 * @param viewRotation 视图旋转角度（度数）
 * @returns 世界坐标
 */
export const screenToWorld = (
	screenX: number,
	screenY: number,
	zoom: number,
	cameraX: number,
	cameraY: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	// 应用旋转变换（将屏幕坐标旋转到世界坐标系）
	const rotatedX = screenX * cos - screenY * sin;
	const rotatedY = screenX * sin + screenY * cos;

	// 应用缩放和相机偏移
	return {
		x: cameraX + rotatedX / zoom,
		y: cameraY + rotatedY / zoom,
	};
};

/**
 * 世界坐标转屏幕坐标（考虑旋转和缩放）
 *
 * @param worldX 世界 X 坐标
 * @param worldY 世界 Y 坐标
 * @param zoom 缩放级别
 * @param cameraX 相机 X 位置
 * @param cameraY 相机 Y 位置
 * @param viewRotation 视图旋转角度（度数）
 * @returns 屏幕坐标（相对于画布中心）
 */
export const worldToScreen = (
	worldX: number,
	worldY: number,
	zoom: number,
	cameraX: number,
	cameraY: number,
	viewRotation: number
): { x: number; y: number } => {
	// 应用相机偏移和缩放
	const relativeX = (worldX - cameraX) * zoom;
	const relativeY = (worldY - cameraY) * zoom;

	// 应用旋转变换（将世界坐标旋转到屏幕坐标系）
	const theta = toRadians(-viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	return {
		x: relativeX * cos - relativeY * sin,
		y: relativeX * sin + relativeY * cos,
	};
};

/**
 * 屏幕向量转世界向量（考虑摄像机视角）
 * 以摄像机视角为基准进行平移操作
 *
 * @param screenDx 屏幕 X 向量（像素）
 * @param screenDy 屏幕 Y 向量（像素）
 * @param zoom 缩放级别
 * @param viewRotation 视图旋转角度（度数，0°指向右方）
 * @returns 世界向量（dx, dy）
 */
export const screenDeltaToWorldDelta = (
	screenDx: number,
	screenDy: number,
	zoom: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	const rotatedX = screenDx * cos - screenDy * sin;
	const rotatedY = screenDx * sin + screenDy * cos;

	return {
		x: rotatedX / zoom,
		y: rotatedY / zoom,
	};
};

/**
 * 世界向量转屏幕向量
 */
export const worldDeltaToScreenDelta = (
	worldDx: number,
	worldDy: number,
	zoom: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	return {
		x: -(worldDx * cos - worldDy * sin) * zoom,
		y: -(worldDx * sin + worldDy * cos) * zoom,
	};
};

/**
 * 计算从点 A 到点 B 的角度（度数）
 * 返回值范围：0-360，0°指向右方（+X 轴），顺时针
 */
export const angleToPoint = (fromX: number, fromY: number, toX: number, toY: number): number => {
	const dx = toX - fromX;
	const dy = toY - fromY;
	return normalizeAngle(toDegrees(Math.atan2(dy, dx)));
};

/**
 * 计算两点之间的距离
 */
export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 根据角度和距离计算目标点
 */
export const pointAtAngle = (
	fromX: number,
	fromY: number,
	angle: number,
	dist: number
): { x: number; y: number } => {
	const rad = toRadians(angle);
	return {
		x: fromX + Math.cos(rad) * dist,
		y: fromY + Math.sin(rad) * dist,
	};
};

/**
 * 线性插值角度（沿最短路径）
 */
export const lerpAngle = (from: number, to: number, t: number): number => {
	const diff = angleDifference(from, to);
	return normalizeAngle(from + diff * t);
};
