/**
 * 移动模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createMoveEvent, createRotateEvent } from "../context.js";
import { distance, angleBetween } from "../geometry/index.js";

/**
 * 应用移动Action
 */
export function applyMovement(context: EngineContext): { newState: any; events: any[] } {
  const { state, action, ship } = context;
  const payload = action.payload as any;
  
  if (!ship) {
    throw new Error("Ship not found for movement");
  }

  const events = [];
  const updates = new Map<string, any>();

  if (action.type === "MOVE") {
    // 处理移动
    const moveResult = processMovement(ship, payload);
    
    // 更新舰船位置
    updates.set(`ship:${ship.id}`, {
      runtime: {
        ...ship.runtime,
        position: moveResult.newPosition,
        movement: moveResult.newMovementState,
      },
    });

    // 创建移动事件
    events.push(createMoveEvent(
      ship.id,
      ship.runtime.position,
      moveResult.newPosition,
      payload.distance
    ));

  } else if (action.type === "ROTATE") {
    // 处理旋转
    const rotateResult = processRotation(ship, payload);
    
    // 更新舰船朝向
    updates.set(`ship:${ship.id}`, {
      runtime: {
        ...ship.runtime,
        heading: rotateResult.newHeading,
        movement: rotateResult.newMovementState,
      },
    });

    // 创建旋转事件
    events.push(createRotateEvent(
      ship.id,
      ship.runtime.heading || 0,
      rotateResult.newHeading,
      payload.angle
    ));
  }

  // 应用状态更新
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 处理移动
 */
function processMovement(ship: any, payload: any) {
  const { distance: moveDistance, direction, phase } = payload;
  const currentPos = ship.runtime.position;
  const heading = ship.runtime.heading || 0;
  const movement = ship.runtime.movement || {
    hasMoved: false,
    phaseAUsed: 0,
    turnAngleUsed: 0,
    phaseCUsed: 0,
  };

  // 计算新位置
  let newPosition = { ...currentPos };
  const rad = (heading * Math.PI) / 180;

  switch (direction) {
    case "FORWARD":
      newPosition.x += Math.cos(rad) * moveDistance;
      newPosition.y += Math.sin(rad) * moveDistance;
      break;
    case "BACKWARD":
      newPosition.x -= Math.cos(rad) * moveDistance;
      newPosition.y -= Math.sin(rad) * moveDistance;
      break;
    case "STRAFE_LEFT":
      // 向左横移（垂直于船头方向）
      newPosition.x += Math.cos(rad + Math.PI / 2) * moveDistance;
      newPosition.y += Math.sin(rad + Math.PI / 2) * moveDistance;
      break;
    case "STRAFE_RIGHT":
      // 向右横移
      newPosition.x += Math.cos(rad - Math.PI / 2) * moveDistance;
      newPosition.y += Math.sin(rad - Math.PI / 2) * moveDistance;
      break;
  }

  // 更新移动状态
  const newMovementState = { ...movement };
  if (phase === "A") {
    newMovementState.phaseAUsed = (movement.phaseAUsed || 0) + moveDistance;
  } else if (phase === "C") {
    newMovementState.phaseCUsed = (movement.phaseCUsed || 0) + moveDistance;
  }
  
  // 检查是否用完移动力
  const maxMove = ship.shipJson.ship.maxSpeed || 0;
  const totalUsed = (newMovementState.phaseAUsed || 0) + (newMovementState.phaseCUsed || 0);
  if (totalUsed >= maxMove) {
    newMovementState.hasMoved = true;
  }

  return {
    newPosition,
    newMovementState,
  };
}

/**
 * 处理旋转
 */
function processRotation(ship: any, payload: any) {
  const { angle } = payload;
  const currentHeading = ship.runtime.heading || 0;
  const movement = ship.runtime.movement || {
    hasMoved: false,
    phaseAUsed: 0,
    turnAngleUsed: 0,
    phaseCUsed: 0,
  };

  // 计算新朝向（规范化到0-360度）
  let newHeading = (currentHeading + angle) % 360;
  if (newHeading < 0) newHeading += 360;

  // 更新移动状态
  const newMovementState = { ...movement };
  newMovementState.turnAngleUsed = (movement.turnAngleUsed || 0) + Math.abs(angle);
  
  // 检查是否用完转向角度
  const maxTurn = ship.shipJson.ship.maxTurnRate || 0;
  if (newMovementState.turnAngleUsed >= maxTurn) {
    newMovementState.hasMoved = true;
  }

  return {
    newHeading,
    newMovementState,
  };
}

/**
 * 检查移动合法性
 */
export function validateMovement(
  ship: any,
  moveDistance: number,
  direction: string,
  phase: string
): { valid: boolean; error?: string } {
  const maxMove = ship.shipJson.ship.maxSpeed || 0;
  const movement = ship.runtime.movement || {
    phaseAUsed: 0,
    phaseCUsed: 0,
    turnAngleUsed: 0,
  };

  // 检查是否已移动
  if (ship.runtime.movement?.hasMoved) {
    return { valid: false, error: "Ship has already moved this turn" };
  }

  // 检查移动距离
  if (moveDistance <= 0) {
    return { valid: false, error: "Move distance must be positive" };
  }

  // 检查阶段移动力
  let usedInPhase = 0;
  if (phase === "A") {
    usedInPhase = movement.phaseAUsed || 0;
  } else if (phase === "C") {
    usedInPhase = movement.phaseCUsed || 0;
  }

  if (usedInPhase + moveDistance > maxMove) {
    return { valid: false, error: `Exceeds available move distance in phase ${phase}` };
  }

  // 检查总移动力
  const totalUsed = (movement.phaseAUsed || 0) + (movement.phaseCUsed || 0);
  if (totalUsed + moveDistance > maxMove) {
    return { valid: false, error: "Exceeds total available move distance" };
  }

  return { valid: true };
}

/**
 * 检查旋转合法性
 */
export function validateRotation(
  ship: any,
  angle: number
): { valid: boolean; error?: string } {
  const maxTurn = ship.shipJson.ship.maxTurnRate || 0;
  const movement = ship.runtime.movement || {
    turnAngleUsed: 0,
  };

  // 检查是否已移动
  if (ship.runtime.movement?.hasMoved) {
    return { valid: false, error: "Ship has already moved this turn" };
  }

  // 检查转向角度
  if (Math.abs(angle) <= 0) {
    return { valid: false, error: "Turn angle must be non-zero" };
  }

  // 检查可用转向角度
  const usedTurn = movement.turnAngleUsed || 0;
  if (usedTurn + Math.abs(angle) > maxTurn) {
    return { valid: false, error: `Exceeds available turn angle (${maxTurn} degrees)` };
  }

  return { valid: true };
}