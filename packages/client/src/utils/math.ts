/**
 * 游戏规则数学工具（客户端版本）
 *
 * 从 server/utils/math.ts 精简而来
 * 仅包含客户端渲染需要的函数
 */

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/** 计算两点之间的距离 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return Math.sqrt(dx * dx + dy * dy);
}

/** 计算两点之间的角度 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	if (angle < 0) angle += 360;
	return angle;
}

/** 计算两个角度之间的最小差值 */
export function angleDifference(angle1: number, angle2: number): number {
	let diff = Math.abs(angle1 - angle2) % 360;
	if (diff > 180) diff = 360 - diff;
	return diff;
}

/** 计算挂载点的世界坐标 */
export function getMountWorldPosition(
	shipX: number,
	shipY: number,
	shipHeading: number,
	mountOffsetX: number,
	mountOffsetY: number
): { x: number; y: number } {
	const headingRad = toRadians(shipHeading);
	const worldX = shipX + mountOffsetX * Math.cos(headingRad) - mountOffsetY * Math.sin(headingRad);
	const worldY = shipY + mountOffsetX * Math.sin(headingRad) + mountOffsetY * Math.cos(headingRad);
	return { x: worldX, y: worldY };
}
