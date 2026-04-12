/**
 * 战斗 UI 状态管理 Slice
 *
 * 管理战斗交互的 UI 状态：
 * - 目标选择
 * - 武器选择
 * - 象限选择
 * - 攻击预览
 */

import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { ArmorQuadrant } from '@vt/contracts/types';
import type { AttackPreviewResult } from '@vt/contracts/protocol';

// ==================== 类型定义 ====================

/** 战斗 UI 状态 */
interface CombatUISliceState {
  // 目标选择
  selectedTargetId: string | null;
  // 武器选择
  selectedWeaponId: string | null;
  // 象限选择
  selectedQuadrant: ArmorQuadrant | null;
  // 攻击预览
  attackPreview: AttackPreviewResult | null;
  // 是否正在加载预览
  isLoadingPreview: boolean;
  // 攻击确认中
  isConfirmingAttack: boolean;
  // 最后一次攻击结果
  lastAttackResult: {
    success: boolean;
    damage: number;
    timestamp: number;
  } | null;
  // 显示伤害数字
  showDamageNumbers: boolean;
  // 选中的攻击者
  selectedAttackerId: string | null;
}

// ==================== 初始状态 ====================

const initialState: CombatUISliceState = {
  selectedTargetId: null,
  selectedWeaponId: null,
  selectedQuadrant: null,
  attackPreview: null,
  isLoadingPreview: false,
  isConfirmingAttack: false,
  lastAttackResult: null,
  showDamageNumbers: true,
  selectedAttackerId: null,
};

// ==================== Slice ====================

const combatUISlice = createSlice({
  name: 'combatUI',
  initialState,
  reducers: {
    /**
     * 选择目标
     */
    selectTarget: (state, action: PayloadAction<string | null>) => {
      state.selectedTargetId = action.payload;
      // 切换目标时清除武器和象限选择
      if (action.payload === null) {
        state.selectedWeaponId = null;
        state.selectedQuadrant = null;
        state.attackPreview = null;
      }
    },

    /**
     * 选择武器
     */
    selectWeapon: (state, action: PayloadAction<string | null>) => {
      state.selectedWeaponId = action.payload;
      // 切换武器时清除象限选择和预览
      state.selectedQuadrant = null;
      state.attackPreview = null;
    },

    /**
     * 选择象限
     */
    selectQuadrant: (state, action: PayloadAction<ArmorQuadrant | null>) => {
      state.selectedQuadrant = action.payload;
    },

    /**
     * 设置攻击预览
     */
    setAttackPreview: (state, action: PayloadAction<AttackPreviewResult | null>) => {
      state.attackPreview = action.payload;
      state.isLoadingPreview = false;
    },

    /**
     * 开始加载预览
     */
    startLoadingPreview: (state) => {
      state.isLoadingPreview = true;
    },

    /**
     * 确认攻击开始
     */
    startConfirmingAttack: (state) => {
      state.isConfirmingAttack = true;
    },

    /**
     * 确认攻击结束
     */
    endConfirmingAttack: (state) => {
      state.isConfirmingAttack = false;
    },

    /**
     * 设置攻击结果
     */
    setAttackResult: (state, action: PayloadAction<{
      success: boolean;
      damage: number;
    }>) => {
      state.lastAttackResult = {
        ...action.payload,
        timestamp: Date.now(),
      };
      state.isConfirmingAttack = false;

      // 清除选择状态
      state.selectedTargetId = null;
      state.selectedWeaponId = null;
      state.selectedQuadrant = null;
      state.attackPreview = null;
    },

    /**
     * 清除攻击结果
     */
    clearAttackResult: (state) => {
      state.lastAttackResult = null;
    },

    /**
     * 切换伤害数字显示
     */
    toggleDamageNumbers: (state) => {
      state.showDamageNumbers = !state.showDamageNumbers;
    },

    /**
     * 设置伤害数字显示
     */
    setShowDamageNumbers: (state, action: PayloadAction<boolean>) => {
      state.showDamageNumbers = action.payload;
    },

    /**
     * 选择攻击者
     */
    selectAttacker: (state, action: PayloadAction<string | null>) => {
      state.selectedAttackerId = action.payload;
      // 切换攻击者时清除所有选择
      if (action.payload === null) {
        state.selectedTargetId = null;
        state.selectedWeaponId = null;
        state.selectedQuadrant = null;
        state.attackPreview = null;
      }
    },

    /**
     * 清除所有选择
     */
    clearAllSelections: (state) => {
      state.selectedTargetId = null;
      state.selectedWeaponId = null;
      state.selectedQuadrant = null;
      state.attackPreview = null;
      state.selectedAttackerId = null;
    },

    /**
     * 重置战斗 UI 状态
     */
    resetCombatUI: () => initialState,
  },
});

// ==================== 导出 ====================

export const {
  selectTarget,
  selectWeapon,
  selectQuadrant,
  setAttackPreview,
  startLoadingPreview,
  startConfirmingAttack,
  endConfirmingAttack,
  setAttackResult,
  clearAttackResult,
  toggleDamageNumbers,
  setShowDamageNumbers,
  selectAttacker,
  clearAllSelections,
  resetCombatUI,
} = combatUISlice.actions;

// ==================== 选择器 ====================

// 基础选择器
const selectCombatUIState = (state: { combatUI: CombatUISliceState }) => state.combatUI;

// 简单选择器
export const selectSelectedTargetId = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.selectedTargetId;

export const selectSelectedWeaponId = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.selectedWeaponId;

export const selectSelectedQuadrant = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.selectedQuadrant;

export const selectAttackPreview = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.attackPreview;

export const selectIsLoadingPreview = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.isLoadingPreview;

export const selectIsConfirmingAttack = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.isConfirmingAttack;

export const selectLastAttackResult = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.lastAttackResult;

export const selectShowDamageNumbers = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.showDamageNumbers;

export const selectSelectedAttackerId = (state: { combatUI: CombatUISliceState }) =>
  state.combatUI.selectedAttackerId;

// Memoized 选择器
export const selectHasSelection = createSelector(
  [selectSelectedTargetId, selectSelectedWeaponId],
  (targetId, weaponId) => targetId !== null || weaponId !== null
);

export const selectCanAttack = createSelector(
  [selectSelectedTargetId, selectSelectedWeaponId, selectIsConfirmingAttack],
  (targetId, weaponId, isConfirming) =>
    targetId !== null && weaponId !== null && !isConfirming
);

export const selectCombatSelectionState = createSelector(
  [
    selectSelectedAttackerId,
    selectSelectedTargetId,
    selectSelectedWeaponId,
    selectSelectedQuadrant,
  ],
  (attackerId, targetId, weaponId, quadrant) => ({
    attackerId,
    targetId,
    weaponId,
    quadrant,
    isComplete: attackerId !== null && targetId !== null && weaponId !== null,
  })
);

export default combatUISlice.reducer;