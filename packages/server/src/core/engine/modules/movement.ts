/**
 * 移动模块 - ABC 阶段系统
 *
 * 符号约定：
 * - 前后移动：向前为正，向后为负
 * - 侧向移动：向左为正，向右为负
 * - 资源消耗使用绝对值计算
 *
 * 阶段设计：
 * - A阶段：平移（选择前后或左右之一，选定后锁定方向）
 * - B阶段：旋转（消耗总角度资源）
 * - C阶段：平移（选择前后或左右之一，选定后锁定方向）
 * - 顺序：A → B → C，不可逆
 * - 输入：移动距离和旋转角度强制为整数
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createMoveEvent, createRotateEvent } from "../context.js";
import { calculateModifiedValue } from "./modifier.js";

/** 移动阶段 */
export type MovementPhase = "A" | "B" | "C" | "DONE";

/** 平移方向锁定 */
export type TranslationLock = "FORWARD_BACKWARD" | "LEFT_RIGHT" | null;

/**
 * 获取或初始化移动状态
 */
function getMovementState(ship: any): {
  currentPhase: MovementPhase;
  phaseAUsed: number;
  turnAngleUsed: number;
  phaseCUsed: number;
  phaseALock: TranslationLock;
  phaseCLock: TranslationLock;
  hasMoved: boolean;
} {
  const defaultState = {
    currentPhase: "A" as MovementPhase,
    phaseAUsed: 0,
    turnAngleUsed: 0,
    phaseCUsed: 0,
    phaseALock: null as TranslationLock,
    phaseCLock: null as TranslationLock,
    hasMoved: false,
  };

  if (!ship.runtime.movement) {
    return defaultState;
  }

  return {
    currentPhase: ship.runtime.movement.currentPhase || "A",
    phaseAUsed: ship.runtime.movement.phaseAUsed || 0,
    turnAngleUsed: ship.runtime.movement.turnAngleUsed || 0,
    phaseCUsed: ship.runtime.movement.phaseCUsed || 0,
    phaseALock: ship.runtime.movement.phaseALock || null,
    phaseCLock: ship.runtime.movement.phaseCLock || null,
    hasMoved: ship.runtime.movement.hasMoved || false,
  };
}

/**
 * 判断移动类型（前后 vs 左右）
 * 正数：前后移动（forwardDistance > 0 向前，< 0 向后）
 * 正数：侧向移动（strafeDistance > 0 向左，< 0 向右）
 */
function getTranslationType(isStrafe: boolean): TranslationLock {
  return isStrafe ? "LEFT_RIGHT" : "FORWARD_BACKWARD";
}

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
    const moveResult = processMovement(ship, payload);
    
    updates.set(`ship:${ship.$id}`, {
      runtime: {
        ...ship.runtime,
        position: moveResult.newPosition,
        movement: moveResult.newMovementState,
      },
    });

    events.push(createMoveEvent(
      ship.$id,
      ship.runtime.position,
      moveResult.newPosition,
      Math.abs(payload.distance)
    ));

  } else if (action.type === "ROTATE") {
    const rotateResult = processRotation(ship, payload);
    
    updates.set(`ship:${ship.$id}`, {
      runtime: {
        ...ship.runtime,
        heading: rotateResult.newHeading,
        movement: rotateResult.newMovementState,
      },
    });

    events.push(createRotateEvent(
      ship.$id,
      ship.runtime.heading || 0,
      rotateResult.newHeading,
      payload.angle
    ));
  } else if (action.type === "ADVANCE_PHASE") {
    const phaseResult = advancePhase(ship);
    
    updates.set(`ship:${ship.$id}`, {
      runtime: {
        ...ship.runtime,
        movement: phaseResult.newMovementState,
      },
    });

    events.push({
      type: "PHASE_ADVANCED",
      shipId: ship.$id,
      fromPhase: phaseResult.fromPhase,
      toPhase: phaseResult.toPhase,
    });
  }

  const newState = applyStateUpdates(state, updates);
  return { newState, events };
}

/**
 * 处理移动（A/C阶段）
 *
 * payload:
 *   - forwardDistance: 前后移动距离（正=前，负=后，0=不移动）
 *   - strafeDistance: 侧向移动距离（正=左，负=右，0=不移动）
 *   - 两者不能同时非零
 */
function processMovement(ship: any, payload: any) {
  const { forwardDistance = 0, strafeDistance = 0 } = payload;
  const currentPos = ship.runtime.position;
  const heading = ship.runtime.heading || 0;
  const movement = getMovementState(ship);

  let newPosition = { ...currentPos };
  const rad = (heading * Math.PI) / 180;

  if (forwardDistance !== 0) {
    newPosition.x += Math.cos(rad) * forwardDistance;
    newPosition.y += Math.sin(rad) * forwardDistance;
  }

  if (strafeDistance !== 0) {
    const strafeRad = strafeDistance > 0
      ? rad + Math.PI / 2
      : rad - Math.PI / 2;
    const absStrafe = Math.abs(strafeDistance);
    newPosition.x += Math.cos(strafeRad) * absStrafe;
    newPosition.y += Math.sin(strafeRad) * absStrafe;
  }

  const isStrafe = strafeDistance !== 0;
  const distance = isStrafe ? Math.abs(strafeDistance) : Math.abs(forwardDistance);
  const directionType = getTranslationType(isStrafe);

  const newMovementState = { ...movement };

  if (movement.currentPhase === "A") {
    newMovementState.phaseAUsed = movement.phaseAUsed + distance;
    if (!movement.phaseALock) {
      newMovementState.phaseALock = directionType;
    }
  } else if (movement.currentPhase === "C") {
    newMovementState.phaseCUsed = movement.phaseCUsed + distance;
    if (!movement.phaseCLock) {
      newMovementState.phaseCLock = directionType;
    }
  }

  return {
    newPosition,
    newMovementState,
  };
}
export { processMovement };

/**
 * 处理旋转（B阶段）
 */
function processRotation(ship: any, payload: any) {
  const { angle } = payload;
  const currentHeading = ship.runtime.heading || 0;
  const movement = getMovementState(ship);

  let newHeading = (currentHeading + angle) % 360;
  if (newHeading < 0) newHeading += 360;

  const newMovementState = { ...movement };
  newMovementState.turnAngleUsed = movement.turnAngleUsed + Math.abs(angle);

  return {
    newHeading,
    newMovementState,
  };
}
export { processRotation };

/**
 * 推进到下一阶段
 * A → B → C → DONE
 */
function advancePhase(ship: any): {
  newMovementState: any;
  fromPhase: MovementPhase;
  toPhase: MovementPhase;
} {
  const movement = getMovementState(ship);
  const fromPhase = movement.currentPhase;
  let toPhase: MovementPhase;

  switch (fromPhase) {
    case "A":
      toPhase = "B";
      break;
    case "B":
      toPhase = "C";
      break;
    case "C":
      toPhase = "DONE";
      break;
    case "DONE":
      toPhase = "DONE";
      break;
    default:
      toPhase = "A";
  }

  const newMovementState = {
    ...movement,
    currentPhase: toPhase,
  };

  if (toPhase === "DONE") {
    newMovementState.hasMoved = true;
  }

  return {
    newMovementState,
    fromPhase,
    toPhase,
  };
}
export { advancePhase };

// ==================== 验证函数 ====================

/**
 * 检查移动合法性（A/C阶段）
 *
 * 参数：
 *   - forwardDistance: 前后移动（正=前，负=后）
 *   - strafeDistance: 侧向移动（正=左，负=右）
 *   - 两者不能同时非零
 */
export function validateMovement(
	ship: any,
	forwardDistance: number,
	strafeDistance: number
): { valid: boolean; error?: string } {
	// 应用 speed modifier
	const baseMaxSpeed = ship.spec.maxSpeed || 0;
	const maxMove = calculateModifiedValue(baseMaxSpeed, ship.runtime, "speed");
	const movement = getMovementState(ship);

  // 检查是否已完成移动
  if (movement.hasMoved || movement.currentPhase === "DONE") {
    return { valid: false, error: "Ship has already completed movement this turn" };
  }

  // 检查是否过载
  if (ship.runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded and cannot move" };
  }

  // 检查当前阶段
  if (movement.currentPhase !== "A" && movement.currentPhase !== "C") {
    return { valid: false, error: `Cannot move in phase ${movement.currentPhase}` };
  }

  // 检查整数输入
  if (!Number.isInteger(forwardDistance) || !Number.isInteger(strafeDistance)) {
    return { valid: false, error: "Move distance must be an integer" };
  }

  // 检查不能同时前后和侧移
  if (forwardDistance !== 0 && strafeDistance !== 0) {
    return { valid: false, error: "Cannot move forward/backward and strafe simultaneously" };
  }

  // 检查至少有一个非零
  if (forwardDistance === 0 && strafeDistance === 0) {
    return { valid: false, error: "No movement specified" };
  }

  // 确定移动类型和距离
  const isStrafe = strafeDistance !== 0;
  const distance = isStrafe ? Math.abs(strafeDistance) : Math.abs(forwardDistance);
  const directionType = getTranslationType(isStrafe);

  // 检查方向锁定
  const currentLock = movement.currentPhase === "A" ? movement.phaseALock : movement.phaseCLock;
  
  if (currentLock && currentLock !== directionType) {
    return {
      valid: false,
      error: `Direction locked to ${currentLock === "FORWARD_BACKWARD" ? "forward/backward" : "left/right"} in phase ${movement.currentPhase}`,
    };
  }

  // 检查阶段资源
  const usedInPhase = movement.currentPhase === "A" ? movement.phaseAUsed : movement.phaseCUsed;
  if (usedInPhase + distance > maxMove) {
    return { valid: false, error: `Exceeds available move distance in phase ${movement.currentPhase}` };
  }

  return { valid: true };
}

/**
 * 检查旋转合法性（B阶段）
 */
export function validateRotation(
	ship: any,
	angle: number
): { valid: boolean; error?: string } {
	// 应用 turnRate modifier
	const baseMaxTurn = ship.spec.maxTurnRate || 0;
	const maxTurn = calculateModifiedValue(baseMaxTurn, ship.runtime, "turnRate");
	const movement = getMovementState(ship);

  // 检查是否已完成移动
  if (movement.hasMoved || movement.currentPhase === "DONE") {
    return { valid: false, error: "Ship has already completed movement this turn" };
  }

  // 检查是否过载
  if (ship.runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded and cannot rotate" };
  }

  // 检查当前阶段
  if (movement.currentPhase !== "B") {
    return { valid: false, error: `Cannot rotate in phase ${movement.currentPhase}` };
  }

  // 检查整数输入
  if (!Number.isInteger(angle) || angle === 0) {
    return { valid: false, error: "Turn angle must be a non-zero integer" };
  }

  // 检查可用转向角度
  if (movement.turnAngleUsed + Math.abs(angle) > maxTurn) {
    return { valid: false, error: `Exceeds available turn angle (${maxTurn} degrees)` };
  }

  return { valid: true };
}

/**
 * 检查阶段推进合法性
 */
export function validatePhaseAdvance(ship: any): { valid: boolean; error?: string } {
  const movement = getMovementState(ship);

  if (movement.hasMoved || movement.currentPhase === "DONE") {
    return { valid: false, error: "Ship has already completed movement this turn" };
  }

  return { valid: true };
}

/**
 * 获取移动状态摘要（用于前端显示）
 */
export function getMovementStatus(ship: any): {
	currentPhase: MovementPhase;
	phaseAAvailable: number;
	phaseCAvailable: number;
	turnAngleAvailable: number;
	phaseALock: TranslationLock;
	phaseCLock: TranslationLock;
	canMove: boolean;
} {
	// 应用 speed 和 turnRate modifier
	const baseMaxSpeed = ship.spec?.maxSpeed || 0;
	const baseMaxTurn = ship.spec?.maxTurnRate || 0;
	const maxMove = calculateModifiedValue(baseMaxSpeed, ship.runtime, "speed");
	const maxTurn = calculateModifiedValue(baseMaxTurn, ship.runtime, "turnRate");
	const movement = getMovementState(ship);

	return {
		currentPhase: movement.currentPhase,
		phaseAAvailable: maxMove - movement.phaseAUsed,
		phaseCAvailable: maxMove - movement.phaseCUsed,
		turnAngleAvailable: maxTurn - movement.turnAngleUsed,
		phaseALock: movement.phaseALock,
		phaseCLock: movement.phaseCLock,
		canMove: !movement.hasMoved && movement.currentPhase !== "DONE" && !ship.runtime.overloaded,
	};
}
