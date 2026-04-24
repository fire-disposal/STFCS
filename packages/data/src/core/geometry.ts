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
 * 航海坐标系：0°=北/Y负（屏幕上方），顺时针增加
 * PixiJS：0°=东/X正（屏幕右侧），逆时针增加
 * 
 * PixiJS rotation 规则：
 * - 0° 指向右（东）
 * - 90°（逆时针）指向上（北）
 * - 180° 指向左（西）
 * - -90°（顺时针）指向下（南）
 * 
 * 转换公式：pixiAngle = 90° - nauticalAngle
 * - 航海 0°（北）→ PixiJS 90°
 * - 航海 90°（东）→ PixiJS 0°
 * - 航海 180°（南）→ PixiJS -90°
 * - 航海 270°（西）→ PixiJS -180°
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
 * 航海角度 → PixiJS rotation（舰船贴图用）
 *
 * 贴图设计约定：船头朝上（未旋转状态）
 * PixiJS 正角度逆时针旋转，航海角度顺时针增加
 * 两者恰好抵消，因此 rotation = heading（弧度）
 *
 * 适用场景：舰船 Container.rotation、需要船头朝上的 Sprite.rotation
 *
 * @example
 * shipContainer.rotation = toPixiRotation(shipHeading);
 */
export function toPixiRotation(nauticalAngle: number): number {
	return toRadians(nauticalAngle);
}

/**
 * 航海角度 → PixiJS rotation（扇形/标记绘制用，0°朝右）
 *
 * 在 PixiJS 中绘制扇形时，扇形默认朝右（0°=东/右舷方向）
 * 通过 Container.rotation 旋转到目标方向
 *
 * 转换公式：(nauticalAngle - 90) * PI/180
 * - 航海 0°（北）→ -90°（PixiJS 顺时针90°=向上）✓
 * - 航海 90°（东）→ 0°（PixiJS 0°=向右）✓
 * - 航海 180°（南）→ 90°（PixiJS 逆时针90°=向下）✓
 *
 * 等价于：-nauticalToMath(nauticalAngle) 弧度
 *
 * 适用场景：武器弧扇形 Container.rotation、挂载点朝向标记
 *
 * @example
 * sectorContainer.rotation = nauticalToPixiSectorRotation(mountFacingNautical);
 */
export function nauticalToPixiSectorRotation(nauticalAngle: number): number {
	return toRadians(nauticalAngle - 90);
}

/**
 * 挂载点偏移 → PixiJS 局部坐标偏移
 *
 * 挂载点偏移坐标系（航海坐标系）：
 * - offsetX 正值 = 左舷（heading=0时指向屏幕左侧 -X）
 * - offsetY 正值 = 船头（heading=0时指向屏幕上方 -Y）
 *
 * PixiJS 局部坐标系：
 * - X向右为正
 * - Y向下为正
 *
 * 转换：取负（左舷/船头为正 → PixiJS 中取反）
 *
 * @example
 * const screenOffset = mountOffsetToScreen(mount.position);
 * // screenOffset.x = -mount.position.x
 * // screenOffset.y = -mount.position.y
 */
export function mountOffsetToScreen(mountOffset: Point): Point {
	return { x: -mountOffset.x, y: -mountOffset.y };
}

/**
 * 计算挂载点扇形在 PixiJS 中的 rotation
 *
 * 结合舰船朝向和挂载点朝向，返回适用于扇形 Container 的 rotation
 *
 * @param shipHeading - 舰船朝向（航海角度）
 * @param mountFacing - 挂载点朝向（航海角度，相对舰船）
 * @returns PixiJS rotation（弧度）
 *
 * @example
 * sectorContainer.rotation = getMountSectorRotation(shipHeading, mount.facing);
 */
export function getMountSectorRotation(shipHeading: number, mountFacing: number): number {
	return nauticalToPixiSectorRotation(shipHeading + mountFacing);
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

// ==================== 碰撞体检测 ====================

/**
 * 获取舰船菱形碰撞体的四个顶点（世界坐标）
 *
 * 菱形定义（局部坐标系，船头朝上）：
 *   - 上顶点：(0, -halfLength)
 *   - 右顶点：(halfWidth, 0)
 *   - 下顶点：(0, halfLength)
 *   - 左顶点：(-halfWidth, 0)
 *
 * 通过旋转矩阵将顶点转换到世界坐标：
 *   worldX = centerX + localX * cos(heading) - localY * sin(heading)
 *   worldY = centerY + localX * sin(heading) + localY * cos(heading)
 *
 * @param center - 舰船中心世界坐标
 * @param heading - 舰船朝向（航海角度，0°=北/船头向上）
 * @param halfWidth - 宽度的一半
 * @param halfLength - 长度的一半
 * @returns 四个顶点数组 [上, 右, 下, 左]（世界坐标）
 */
export function getShipCollisionVertices(
	center: Point,
	heading: number,
	halfWidth: number,
	halfLength: number
): [Point, Point, Point, Point] {
	const rad = toRadians(heading);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	// 局部坐标顶点（菱形）
	const localVerts: Point[] = [
		{ x: 0, y: -halfLength },       // 上
		{ x: halfWidth, y: 0 },          // 右
		{ x: 0, y: halfLength },         // 下
		{ x: -halfWidth, y: 0 },         // 左
	];

	return localVerts.map((v) => ({
		x: center.x + v.x * cos - v.y * sin,
		y: center.y + v.x * sin + v.y * cos,
	})) as [Point, Point, Point, Point];
}

/**
 * 将多边形顶点投影到指定轴上
 *
 * @param vertices - 多边形顶点数组
 * @param axis - 投影轴（单位向量）
 * @returns [min, max] 投影区间
 */
function projectVertices(vertices: Point[], axis: Point): [number, number] {
	let min = Infinity;
	let max = -Infinity;

	for (const v of vertices) {
		const projection = v.x * axis.x + v.y * axis.y;
		if (projection < min) min = projection;
		if (projection > max) max = projection;
	}

	return [min, max];
}

/**
 * 获取多边形一条边的法线（作为分离轴）
 *
 * @param a - 边的起点
 * @param b - 边的终点
 * @returns 单位法线向量
 */
function getEdgeNormal(a: Point, b: Point): Point {
	const edgeX = b.x - a.x;
	const edgeY = b.y - a.y;
	// 法线：(edgeY, -edgeX) 并归一化
	const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
	if (len === 0) return { x: 0, y: 0 };
	return { x: edgeY / len, y: -edgeX / len };
}

/**
 * 检测两个凸多边形是否重叠（分离轴定理 SAT）
 *
 * 对两个多边形的每条边计算法线轴，将两个多边形投影到该轴上，
 * 如果存在一条轴使投影区间不重叠，则两个多边形不重叠。
 *
 * @param vertsA - 多边形A的顶点（按顺序）
 * @param vertsB - 多边形B的顶点（按顺序）
 * @returns 是否重叠（碰撞）
 */
export function doPolygonsOverlap(
	vertsA: Point[],
	vertsB: Point[]
): boolean {
	const edges = [
		...vertsA.map((v, i) => [v, vertsA[(i + 1) % vertsA.length]] as [Point, Point]),
		...vertsB.map((v, i) => [v, vertsB[(i + 1) % vertsB.length]] as [Point, Point]),
	];

	for (const [a, b] of edges) {
		const axis = getEdgeNormal(a, b);
		if (axis.x === 0 && axis.y === 0) continue;

		const [minA, maxA] = projectVertices(vertsA, axis);
		const [minB, maxB] = projectVertices(vertsB, axis);

		// 如果投影区间不重叠，则两个多边形不碰撞
		if (maxA < minB || maxB < minA) {
			return false;
		}
	}

	return true;
}

/**
 * 检测两艘舰船的菱形碰撞体是否重叠
 *
 * @param centerA - 舰船A中心
 * @param headingA - 舰船A朝向（航海角度）
 * @param halfWidthA - 舰船A半宽
 * @param halfLengthA - 舰船A半长
 * @param centerB - 舰船B中心
 * @param headingB - 舰船B朝向（航海角度）
 * @param halfWidthB - 舰船B半宽
 * @param halfLengthB - 舰船B半长
 * @returns 是否碰撞
 */
export function doShipCollisionBoxesOverlap(
	centerA: Point,
	headingA: number,
	halfWidthA: number,
	halfLengthA: number,
	centerB: Point,
	headingB: number,
	halfWidthB: number,
	halfLengthB: number
): boolean {
	const vertsA = getShipCollisionVertices(centerA, headingA, halfWidthA, halfLengthA);
	const vertsB = getShipCollisionVertices(centerB, headingB, halfWidthB, halfLengthB);
	return doPolygonsOverlap(vertsA, vertsB);
}

/**
 * 检测一艘舰船是否与一组舰船中的任何一艘碰撞
 *
 * @param shipCenter - 待检测舰船中心
 * @param shipHeading - 待检测舰船朝向
 * @param shipHalfWidth - 待检测舰船半宽
 * @param shipHalfLength - 待检测舰船半长
 * @param excludeId - 排除的舰船ID（自身）
 * @param allShips - 所有舰船数组，每艘需有 $id, runtime.position, runtime.heading, spec.width, spec.length
 * @returns 碰撞的舰船ID数组（空数组表示无碰撞）
 */
export function findCollidingShips(
	shipCenter: Point,
	shipHeading: number,
	shipHalfWidth: number,
	shipHalfLength: number,
	excludeId: string,
	allShips: { $id: string; runtime?: { position?: Point; heading?: number; destroyed?: boolean }; spec?: { width?: number | undefined; length?: number | undefined } }[]
): string[] {
	const results: string[] = [];

	for (const other of allShips) {
		if (other.$id === excludeId) continue;
		if (other.runtime?.destroyed) continue;
		if (!other.runtime?.position) continue;

		const otherPos = other.runtime.position;
		const otherHeading = other.runtime.heading ?? 0;
		const otherHalfW = (other.spec?.width ?? 30) / 2;
		const otherHalfL = (other.spec?.length ?? 50) / 2;

		if (doShipCollisionBoxesOverlap(
			shipCenter, shipHeading, shipHalfWidth, shipHalfLength,
			otherPos, otherHeading, otherHalfW, otherHalfL
		)) {
			results.push(other.$id);
		}
	}

	return results;
}