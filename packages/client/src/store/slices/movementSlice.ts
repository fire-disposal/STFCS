/**
 * 移动系统状态管理
 * 
 * 三阶段移动系统：
 * - 阶段 A: 平移（可以中途攻击）
 * - 阶段 B: 转向（可以中途攻击）
 * - 阶段 C: 平移（可以中途攻击）
 * 
 * 攻击操作独立于移动阶段，可在任何阶段进行
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Point } from "@vt/contracts/types";

// 本地定义 MovementPlan 类型
export interface MovementPlan {
  phaseAForward: number;
  phaseAStrafe: number;
  turnAngle: number;
  phaseBForward: number;
  phaseBStrafe: number;
}

// 移动阶段枚举
export enum MovementPhase {
  NONE = 'NONE',           // 未开始
  PHASE_A = 'PHASE_A',     // 阶段 A: 平移
  PHASE_B = 'PHASE_B',     // 阶段 B: 转向
  PHASE_C = 'PHASE_C',     // 阶段 C: 平移
  COMPLETED = 'COMPLETED', // 已完成
}

// 攻击状态
export interface AttackState {
  hasAttacked: boolean;
  attackCount: number;
  lastAttackPhase: MovementPhase | null;
}

export interface MovementRangePoint extends Point {
  reachable: boolean;
  distance: number;
}

// 阶段状态
export interface PhaseState {
  completed: boolean;
  executing: boolean;    // 正在执行动画
  forward: number;
  strafe: number;
  turn: number;
}

interface MovementState {
  // 当前移动计划
  currentPlan: MovementPlan | null;
  
  // 当前阶段
  currentPhase: MovementPhase;
  
  // 各阶段状态
  phaseA: PhaseState;
  phaseB: PhaseState;
  phaseC: PhaseState;
  
  // 攻击状态（每回合独立）
  attacks: AttackState;
  
  // 移动验证状态
  isValid: boolean;
  validationError: string | null;
  
  // 机动范围（可达点）
  movementRange: MovementRangePoint[];
  
  // 本回合已执行移动
  executedMoves: string[]; // shipId list
  
  // 移动预览设置
  showRange: boolean;
  showTurnArc: boolean;
  
  // 动画状态
  isAnimating: boolean;
  animationPhase: MovementPhase | null;
  
  // 回合信息
  turnNumber: number;
}

const initialPhaseState: PhaseState = {
  completed: false,
  executing: false,
  forward: 0,
  strafe: 0,
  turn: 0,
};

const initialState: MovementState = {
  currentPlan: null,
  currentPhase: MovementPhase.NONE,
  phaseA: { ...initialPhaseState },
  phaseB: { ...initialPhaseState },
  phaseC: { ...initialPhaseState },
  attacks: {
    hasAttacked: false,
    attackCount: 0,
    lastAttackPhase: null,
  },
  isValid: false,
  validationError: null,
  movementRange: [],
  executedMoves: [],
  showRange: true,
  showTurnArc: true,
  isAnimating: false,
  animationPhase: null,
  turnNumber: 1,
};

const movementSlice = createSlice({
  name: "movement",
  initialState,
  reducers: {
    // 开始移动流程
    startMovement: (state, action: PayloadAction<MovementPlan>) => {
      state.currentPlan = action.payload;
      state.currentPhase = MovementPhase.PHASE_A;
      state.phaseA = { ...initialPhaseState };
      state.phaseB = { ...initialPhaseState };
      state.phaseC = { ...initialPhaseState };
      state.attacks = {
        hasAttacked: false,
        attackCount: 0,
        lastAttackPhase: null,
      };
    },
    
    // 设置当前移动计划
    setCurrentPlan: (state, action: PayloadAction<MovementPlan | null>) => {
      state.currentPlan = action.payload;
    },
    
    // 清除当前移动计划
    clearCurrentPlan: (state) => {
      state.currentPlan = null;
      state.currentPhase = MovementPhase.NONE;
      state.isValid = false;
      state.validationError = null;
    },
    
    // 切换到下一阶段
    advancePhase: (state) => {
      // 标记当前阶段完成
      switch (state.currentPhase) {
        case MovementPhase.PHASE_A:
          state.phaseA.completed = true;
          state.currentPhase = MovementPhase.PHASE_B;
          break;
        case MovementPhase.PHASE_B:
          state.phaseB.completed = true;
          state.currentPhase = MovementPhase.PHASE_C;
          break;
        case MovementPhase.PHASE_C:
          state.phaseC.completed = true;
          state.currentPhase = MovementPhase.COMPLETED;
          break;
      }
    },
    
    // 设置当前阶段
    setCurrentPhase: (state, action: PayloadAction<MovementPhase>) => {
      state.currentPhase = action.payload;
    },
    
    // 执行阶段移动（开始动画）
    executePhase: (state, action: PayloadAction<{
      phase: MovementPhase;
      forward?: number;
      strafe?: number;
      turn?: number;
    }>) => {
      const { phase, forward, strafe, turn } = action.payload;
      
      switch (phase) {
        case MovementPhase.PHASE_A:
          state.phaseA.executing = true;
          state.phaseA.forward = forward || 0;
          state.phaseA.strafe = strafe || 0;
          break;
        case MovementPhase.PHASE_B:
          state.phaseB.executing = true;
          state.phaseB.turn = turn || 0;
          break;
        case MovementPhase.PHASE_C:
          state.phaseC.executing = true;
          state.phaseC.forward = forward || 0;
          state.phaseC.strafe = strafe || 0;
          break;
      }
      
      state.isAnimating = true;
      state.animationPhase = phase;
    },
    
    // 完成阶段移动（动画结束）
    completePhase: (state, action: PayloadAction<MovementPhase>) => {
      const phase = action.payload;
      
      switch (phase) {
        case MovementPhase.PHASE_A:
          state.phaseA.executing = false;
          state.phaseA.completed = true;
          break;
        case MovementPhase.PHASE_B:
          state.phaseB.executing = false;
          state.phaseB.completed = true;
          break;
        case MovementPhase.PHASE_C:
          state.phaseC.executing = false;
          state.phaseC.completed = true;
          break;
      }
      
      state.isAnimating = false;
      state.animationPhase = null;
    },
    
    // 注册攻击
    registerAttack: (state) => {
      state.attacks.hasAttacked = true;
      state.attacks.attackCount++;
      state.attacks.lastAttackPhase = state.currentPhase;
    },
    
    // 更新移动验证状态
    updateValidation: (state, action: PayloadAction<{ 
      isValid: boolean; 
      error?: string;
    }>) => {
      state.isValid = action.payload.isValid;
      state.validationError = action.payload.error || null;
    },
    
    // 计算机动范围
    setMovementRange: (state, action: PayloadAction<MovementRangePoint[]>) => {
      state.movementRange = action.payload;
    },
    
    // 清除机动范围
    clearMovementRange: (state) => {
      state.movementRange = [];
    },
    
    // 标记移动已执行
    markMoveExecuted: (state, action: PayloadAction<string>) => {
      if (!state.executedMoves.includes(action.payload)) {
        state.executedMoves.push(action.payload);
      }
    },
    
    // 清除已执行移动（新回合）
    clearExecutedMoves: (state) => {
      state.executedMoves = [];
      state.phaseA = { ...initialPhaseState };
      state.phaseB = { ...initialPhaseState };
      state.phaseC = { ...initialPhaseState };
      state.currentPhase = MovementPhase.NONE;
      state.currentPlan = null;
      state.attacks = {
        hasAttacked: false,
        attackCount: 0,
        lastAttackPhase: null,
      };
      state.isValid = false;
      state.validationError = null;
    },
    
    // 切换范围显示
    toggleRangeDisplay: (state) => {
      state.showRange = !state.showRange;
    },
    
    // 切换转向弧显示
    toggleTurnArcDisplay: (state) => {
      state.showTurnArc = !state.showTurnArc;
    },
    
    // 设置范围显示
    setRangeDisplay: (state, action: PayloadAction<boolean>) => {
      state.showRange = action.payload;
    },
    
    // 设置转向弧显示
    setTurnArcDisplay: (state, action: PayloadAction<boolean>) => {
      state.showTurnArc = action.payload;
    },
    
    // 设置动画状态
    setAnimationState: (state, action: PayloadAction<{
      isAnimating: boolean;
      phase?: MovementPhase | null;
    }>) => {
      state.isAnimating = action.payload.isAnimating;
      state.animationPhase = action.payload.phase ?? null;
    },
    
    // 更新回合数
    setTurnNumber: (state, action: PayloadAction<number>) => {
      state.turnNumber = action.payload;
    },
    
    // 新回合开始（重置所有状态）
    newTurn: (state, action: PayloadAction<number>) => {
      state.turnNumber = action.payload;
      state.currentPhase = MovementPhase.NONE;
      state.currentPlan = null;
      state.phaseA = { ...initialPhaseState };
      state.phaseB = { ...initialPhaseState };
      state.phaseC = { ...initialPhaseState };
      state.attacks = {
        hasAttacked: false,
        attackCount: 0,
        lastAttackPhase: null,
      };
      state.isValid = false;
      state.validationError = null;
      state.isAnimating = false;
      state.animationPhase = null;
      state.executedMoves = [];
    },
  },
});

export const {
  startMovement,
  setCurrentPlan,
  clearCurrentPlan,
  advancePhase,
  setCurrentPhase,
  executePhase,
  completePhase,
  registerAttack,
  updateValidation,
  setMovementRange,
  clearMovementRange,
  markMoveExecuted,
  clearExecutedMoves,
  toggleRangeDisplay,
  toggleTurnArcDisplay,
  setRangeDisplay,
  setTurnArcDisplay,
  setAnimationState,
  setTurnNumber,
  newTurn,
} = movementSlice.actions;

export default movementSlice.reducer;
