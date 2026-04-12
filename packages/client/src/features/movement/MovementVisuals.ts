/**
 * 移动可视化组件
 * 
 * 在 GameCanvas 上渲染：
 * - 机动范围圈（可达区域）
 * - 转向弧线
 * - 移动路径预览
 */

import type { ShipState } from '@vt/contracts';
import type { Graphics } from 'pixi.js';
import type { MovementPlan } from '@/store/slices/movementSlice';

// 颜色配置
const COLORS = {
  rangeRing: 0x4a9eff,      // 蓝色 - 范围圈
  rangeFill: 0x4a9eff40,    // 半透明填充
  turnArc: 0xf1c40f,        // 黄色 - 转向弧
  movePath: 0x2ecc71,       // 绿色 - 移动路径
  invalid: 0xff4a4a,        // 红色 - 无效区域
};

export interface MovementVisualsConfig {
  showRange: boolean;
  showTurnArc: boolean;
  showPath: boolean;
  rangeOpacity: number;
}

/**
 * 绘制机动范围圈
 */
export function drawMovementRange(
  graphics: Graphics,
  ship: ShipState,
  maxSpeed: number,
  config: MovementVisualsConfig
): void {
  if (!config.showRange || !ship) return;

  const { rangeRing, rangeFill } = COLORS;
  const alpha = config.rangeOpacity || 0.3;

  // 绘制最大范围圈
  graphics.circle(ship.transform.x, ship.transform.y, maxSpeed * 4);
  graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.5 });
  graphics.stroke();
  graphics.setFillStyle({ color: rangeFill, alpha });
  graphics.fill();

  // 绘制同心圆参考线
  for (let i = 1; i <= 4; i++) {
    const radius = maxSpeed * i;
    graphics.circle(ship.transform.x, ship.transform.y, radius);
    graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.2 });
    graphics.stroke();
  }

  // 绘制十字参考线
  graphics.moveTo(ship.transform.x - maxSpeed * 4, ship.transform.y);
  graphics.lineTo(ship.transform.x + maxSpeed * 4, ship.transform.y);
  graphics.moveTo(ship.transform.x, ship.transform.y - maxSpeed * 4);
  graphics.lineTo(ship.transform.x, ship.transform.y + maxSpeed * 4);
  graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.2 });
  graphics.stroke();
}

/**
 * 绘制转向弧线
 */
export function drawTurnArc(
  graphics: Graphics,
  ship: ShipState,
  turnAngle: number,
  maxTurnRate: number,
  config: MovementVisualsConfig
): void {
  if (!config.showTurnArc || !ship || Math.abs(turnAngle) < 1) return;

  const { turnArc, invalid } = COLORS;
  const isValid = Math.abs(turnAngle) <= maxTurnRate;
  const color = isValid ? turnArc : invalid;
  
  const arcRadius = 60; // 弧线半径（像素）
  const startAngle = degToRad(ship.transform.heading - 90);
  const turnRad = degToRad(turnAngle);
  
  // 绘制弧线
  graphics.arc(
    ship.transform.x,
    ship.transform.y,
    arcRadius,
    startAngle,
    startAngle + turnRad,
    turnAngle < 0 // 逆时针
  );
  graphics.setStrokeStyle({ width: 3, color, alpha: 0.8 });
  graphics.stroke();

  // 绘制箭头指示
  const arrowAngle = startAngle + turnRad * 0.5;
  const arrowX = ship.transform.x + Math.cos(arrowAngle) * (arcRadius + 10);
  const arrowY = ship.transform.y + Math.sin(arrowAngle) * (arcRadius + 10);
  
  graphics.beginFill(color, 0.8);
  graphics.drawCircle(arrowX, arrowY, 4);
  graphics.endFill();

  // 显示角度数值
  const textAngle = startAngle + turnRad * 0.5;
  const textRadius = arcRadius + 25;
  const textX = ship.transform.x + Math.cos(textAngle) * textRadius;
  const textY = ship.transform.y + Math.sin(textAngle) * textRadius;
  
  // 注意：实际文本渲染需要由 GameCanvas 处理
  // 这里只标记位置
  graphics.beginFill(color, 0.5);
  graphics.drawCircle(textX, textY, 3);
  graphics.endFill();
}

/**
 * 绘制三阶段移动路径
 */
export function drawMovementPath(
  graphics: Graphics,
  ship: ShipState,
  plan: MovementPlan,
  maxSpeed: number,
  maxTurnRate: number,
  config: MovementVisualsConfig
): void {
  if (!config.showPath || !ship || !plan) return;

  const { movePath, invalid } = COLORS;
  
  // 验证移动
  const isValid = (
    Math.abs(plan.phaseAForward) <= maxSpeed * 2 &&
    Math.abs(plan.phaseAStrafe) <= maxSpeed &&
    Math.abs(plan.turnAngle) <= maxTurnRate &&
    Math.abs(plan.phaseBForward) <= maxSpeed * 2 &&
    Math.abs(plan.phaseBStrafe) <= maxSpeed
  );

  const color = isValid ? movePath : invalid;

  // 计算各阶段位置
  const startPos = { x: ship.transform.x, y: ship.transform.y };
  const headingRad = degToRad(ship.transform.heading);
  
  // 阶段 A: 平移
  const forwardA = { x: Math.sin(headingRad), y: -Math.cos(headingRad) };
  const rightA = { x: Math.cos(headingRad), y: Math.sin(headingRad) };
  
  const posA = {
    x: startPos.x + forwardA.x * plan.phaseAForward + rightA.x * plan.phaseAStrafe,
    y: startPos.y + forwardA.y * plan.phaseAForward + rightA.y * plan.phaseAStrafe,
  };

  // 阶段 B: 转向
  const newHeading = normalizeAngle(ship.transform.heading + plan.turnAngle);
  const newHeadingRad = degToRad(newHeading);

  // 阶段 C: 平移
  const forwardC = { x: Math.sin(newHeadingRad), y: -Math.cos(newHeadingRad) };
  const rightC = { x: Math.cos(newHeadingRad), y: Math.sin(newHeadingRad) };
  
  const finalPos = {
    x: posA.x + forwardC.x * plan.phaseBForward + rightC.x * plan.phaseBStrafe,
    y: posA.y + forwardC.y * plan.phaseBForward + rightC.y * plan.phaseBStrafe,
  };

  // 绘制路径线
  // 阶段 A
  graphics.moveTo(startPos.x, startPos.y);
  graphics.lineTo(posA.x, posA.y);
  graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
  graphics.stroke();

  // 阶段 C
  graphics.moveTo(posA.x, posA.y);
  graphics.lineTo(finalPos.x, finalPos.y);
  graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
  graphics.stroke();

  // 绘制关键点
  // 起点
  graphics.beginFill(color, 0.8);
  graphics.drawCircle(startPos.x, startPos.y, 5);
  graphics.endFill();

  // 中间点（阶段 A 结束）
  graphics.beginFill(color, 0.6);
  graphics.drawCircle(posA.x, posA.y, 4);
  graphics.endFill();

  // 终点
  graphics.beginFill(color, 1);
  graphics.drawCircle(finalPos.x, finalPos.y, 6);
  graphics.endFill();

  // 绘制最终朝向指示
  const arrowLength = 30;
  const arrowEnd = {
    x: finalPos.x + Math.sin(newHeadingRad) * arrowLength,
    y: finalPos.y - Math.cos(newHeadingRad) * arrowLength,
  };
  
  graphics.moveTo(finalPos.x, finalPos.y);
  graphics.lineTo(arrowEnd.x, arrowEnd.y);
  graphics.setStrokeStyle({ width: 3, color, alpha: 1 });
  graphics.stroke();
}

/**
 * 清除移动可视化
 */
export function clearMovementVisuals(graphics: Graphics): void {
  graphics.clear();
}

// 工具函数
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}
