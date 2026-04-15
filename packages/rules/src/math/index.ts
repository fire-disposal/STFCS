import { vec2 } from "gl-matrix";
import SAT from "sat";

// 重新导出 gl-matrix 的 vec2 以便共享包统一使用
export { vec2 };

/**
 * 三阶段移动参数
 */
export interface MovementPlan {
  phaseAForward: number;   // 阶段A前进距离 (正前/负后)
  phaseAStrafe: number;    // 阶段A侧移距离 (正右/负左)
  turnAngle: number;       // 转向角度 (正右/负左)
  phaseCForward: number;   // 阶段C前进距离 (转向后平移)
  phaseCStrafe: number;    // 阶段C侧移距离 (转向后平移)
}

/**
 * 移动验证结果
 */
export interface MovementValidation {
  valid: boolean;
  error?: string;
  finalPosition?: { x: number; y: number };
  finalHeading?: number;
}

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
 * 计算两点之间的距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 根据朝向角度计算前进向量 (船头方向)
 */
export function getForwardVector(heading: number): vec2 {
  const rad = toRadians(heading);
  return vec2.fromValues(Math.sin(rad), -Math.cos(rad));
}

/**
 * 根据朝向角度计算右侧切线向量
 */
export function getRightVector(heading: number): vec2 {
  const rad = toRadians(heading);
  return vec2.fromValues(Math.cos(rad), Math.sin(rad));
}

/**
 * 计算两点之间的角度
 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let angle = toDegrees(Math.atan2(dy, dx));
  // 转换为0-360范围
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * 计算两个角度之间的最小差值
 */
export function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * 规范化角度到 0-360 范围
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * 计算三阶段移动后的最终位置和朝向
 * @param startX 起始X
 * @param startY 起始Y
 * @param startHeading 起始朝向
 * @param plan 移动计划
 * @returns 最终位置和朝向
 */
export function calculateThreePhaseMove(
  startX: number,
  startY: number,
  startHeading: number,
  plan: MovementPlan
): { x: number; y: number; heading: number } {
  // 阶段A: 沿当前朝向平移
  const forwardA = getForwardVector(startHeading);
  const rightA = getRightVector(startHeading);
  
  let x = startX + forwardA[0] * plan.phaseAForward + rightA[0] * plan.phaseAStrafe;
  let y = startY + forwardA[1] * plan.phaseAForward + rightA[1] * plan.phaseAStrafe;
  
  // 阶段B: 转向
  const newHeading = normalizeAngle(startHeading + plan.turnAngle);
  
  // 阶段C: 沿新朝向平移
  const forwardB = getForwardVector(newHeading);
  const rightB = getRightVector(newHeading);
  
  x = x + forwardB[0] * plan.phaseCForward + rightB[0] * plan.phaseCStrafe;
  y = y + forwardB[1] * plan.phaseCForward + rightB[1] * plan.phaseCStrafe;
  
  return { x, y, heading: newHeading };
}

/**
 * 验证三阶段移动是否符合规则
 * @param startX 起始X
 * @param startY 起始Y
 * @param startHeading 起始朝向
 * @param plan 移动计划
 * @param maxSpeed 最大速度X (阶段A/B各最大2X平移，最大X横移)
 * @param maxTurnRate 最大转向率Y
 * @returns 验证结果
 */
export function validateThreePhaseMove(
  startX: number,
  startY: number,
  startHeading: number,
  plan: MovementPlan,
  maxSpeed: number,
  maxTurnRate: number
): MovementValidation {
  // 验证阶段A前进/后退距离 (最大2X)
  const maxForward = maxSpeed * 2;
  if (Math.abs(plan.phaseAForward) > maxForward) {
    return { 
      valid: false, 
      error: `Phase A forward distance ${Math.abs(plan.phaseAForward).toFixed(2)} exceeds maximum ${maxForward}` 
    };
  }
  
  // 验证阶段A横移距离 (最大X)
  if (Math.abs(plan.phaseAStrafe) > maxSpeed) {
    return { 
      valid: false, 
      error: `Phase A strafe distance ${Math.abs(plan.phaseAStrafe).toFixed(2)} exceeds maximum ${maxSpeed}` 
    };
  }
  
  // 验证转向角度 (最大Y)
  if (Math.abs(plan.turnAngle) > maxTurnRate) {
    return { 
      valid: false, 
      error: `Turn angle ${Math.abs(plan.turnAngle).toFixed(2)} exceeds maximum ${maxTurnRate}` 
    };
  }
  
  // 验证阶段C前进/后退距离 (最大2X)
  if (Math.abs(plan.phaseCForward) > maxForward) {
    return { 
      valid: false, 
      error: `Phase C forward distance ${Math.abs(plan.phaseCForward).toFixed(2)} exceeds maximum ${maxForward}` 
    };
  }
  
  // 验证阶段C横移距离 (最大X)
  if (Math.abs(plan.phaseCStrafe) > maxSpeed) {
    return { 
      valid: false, 
      error: `Phase C strafe distance ${Math.abs(plan.phaseCStrafe).toFixed(2)} exceeds maximum ${maxSpeed}` 
    };
  }
  
  // 计算最终位置
  const result = calculateThreePhaseMove(startX, startY, startHeading, plan);
  
  return {
    valid: true,
    finalPosition: { x: result.x, y: result.y },
    finalHeading: result.heading
  };
}

/**
 * 计算从当前位置到目标位置所需的三阶段移动计划
 * 这是一个简化版本，尝试找到符合机动规则的路径
 */
export function calculateMovementPlan(
  startX: number,
  startY: number,
  startHeading: number,
  targetX: number,
  targetY: number,
  targetHeading: number,
  maxSpeed: number,
  maxTurnRate: number
): MovementPlan | null {
  // 计算直接向量
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // 简化的移动计划：直接尝试移动到目标
  // 实际游戏中应该由玩家分阶段控制
  const plan: MovementPlan = {
    phaseAForward: distance * 0.5,
    phaseAStrafe: 0,
    turnAngle: normalizeAngle(targetHeading - startHeading),
    phaseCForward: distance * 0.5,
    phaseCStrafe: 0
  };
  
  // 验证计划是否可行
  const validation = validateThreePhaseMove(
    startX, startY, startHeading,
    plan, maxSpeed, maxTurnRate
  );
  
  if (validation.valid) {
    return plan;
  }
  
  return null;
}

/**
 * 检查点是否在扇形区域内
 * @param pointX 点X坐标
 * @param pointY 点Y坐标
 * @param centerX 扇形中心X
 * @param centerY 扇形中心Y
 * @param centerAngle 扇形朝向角度
 * @param arcWidth 扇形弧宽
 * @param maxRange 最大射程
 */
export function isPointInArc(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  centerAngle: number,
  arcWidth: number,
  maxRange: number
): boolean {
  // 首先检查距离
  const dist = distance(pointX, pointY, centerX, centerY);
  if (dist > maxRange) return false;
  
  // 计算点相对于中心的角度
  const angleToPoint = angleBetween(centerX, centerY, pointX, pointY);
  const halfArc = arcWidth / 2;
  
  // 检查角度是否在扇形范围内
  return angleDifference(angleToPoint, centerAngle) <= halfArc;
}

/**
 * 创建战舰的多边形碰撞体（六边形近似）
 * @param x 中心X
 * @param y 中心Y
 * @param heading 朝向
 * @param width 宽度
 * @param length 长度
 */
export function createShipPolygon(
  x: number,
  y: number,
  heading: number,
  width: number,
  length: number
): SAT.Polygon {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  
  // 创建六边形顶点（相对于中心）
  const vertices = [
    new SAT.Vector(0, -halfLength), // 前
    new SAT.Vector(halfWidth * 0.8, -halfLength * 0.3), // 前右
    new SAT.Vector(halfWidth, halfLength * 0.3), // 后右
    new SAT.Vector(0, halfLength), // 后
    new SAT.Vector(-halfWidth, halfLength * 0.3), // 后左
    new SAT.Vector(-halfWidth * 0.8, -halfLength * 0.3), // 前左
  ];
  
  const polygon = new SAT.Polygon(new SAT.Vector(x, y), vertices);
  polygon.setAngle(toRadians(heading));
  
  return polygon;
}

/**
 * 使用SAT.js检查两个多边形是否碰撞
 */
export function checkCollision(poly1: SAT.Polygon, poly2: SAT.Polygon): boolean {
  const response = new SAT.Response();
  return SAT.testPolygonPolygon(poly1, poly2, response);
}

/**
 * 计算移动后的新位置 (简化版本，用于向后兼容)
 * @param x 当前X
 * @param y 当前Y
 * @param heading 当前朝向
 * @param forwardDistance 前进距离（负值为后退）
 * @param strafeDistance 侧移距离（正值向右）
 * @returns 新位置 [x, y]
 */
export function calculateMove(
  x: number,
  y: number,
  heading: number,
  forwardDistance: number,
  strafeDistance: number
): [number, number] {
  const forward = getForwardVector(heading);
  const right = getRightVector(heading);
  
  const newX = x + forward[0] * forwardDistance + right[0] * strafeDistance;
  const newY = y + forward[1] * forwardDistance + right[1] * strafeDistance;
  
  return [newX, newY];
}

/**
 * 检查移动是否在允许的机动范围内 (简化版本)
 * @param startX 起始X
 * @param startY 起始Y
 * @param endX 目标X
 * @param endY 目标Y
 * @param maxDistance 最大移动距离
 */
export function isMoveValid(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxDistance: number
): boolean {
  const dist = distance(startX, startY, endX, endY);
  return dist <= maxDistance;
}

/**
 * 检查转向是否在允许范围内
 * @param startHeading 起始朝向
 * @param endHeading 目标朝向
 * @param maxTurn 最大转向角度
 */
export function isTurnValid(
  startHeading: number,
  endHeading: number,
  maxTurn: number
): boolean {
  const diff = angleDifference(startHeading, endHeading);
  return diff <= maxTurn;
}

/**
 * 计算机动范围预览
 * 返回舰船在当前回合可以到达的所有位置边界
 */
export function calculateMovementRange(
  x: number,
  y: number,
  heading: number,
  maxSpeed: number,
  maxTurnRate: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const maxForward = maxSpeed * 2;
  
  // 采样不同转向角度下的可达位置
  const turnSamples = [-maxTurnRate, -maxTurnRate / 2, 0, maxTurnRate / 2, maxTurnRate];
  
  for (const turn of turnSamples) {
    // 最大前进
    const plan: MovementPlan = {
      phaseAForward: maxForward,
      phaseAStrafe: 0,
      turnAngle: turn,
      phaseCForward: maxForward,
      phaseCStrafe: 0
    };
    const result = calculateThreePhaseMove(x, y, heading, plan);
    points.push({ x: result.x, y: result.y });
    
    // 最大侧移组合
    for (const strafeDir of [-1, 1]) {
      const planStrafe: MovementPlan = {
        phaseAForward: maxForward * 0.5,
        phaseAStrafe: maxSpeed * strafeDir,
        turnAngle: turn,
        phaseCForward: maxForward * 0.5,
        phaseCStrafe: maxSpeed * strafeDir
      };
      const resultStrafe = calculateThreePhaseMove(x, y, heading, planStrafe);
      points.push({ x: resultStrafe.x, y: resultStrafe.y });
    }
  }
  
  return points;
}
