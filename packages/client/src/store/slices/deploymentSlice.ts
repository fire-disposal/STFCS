/**
 * 部署阶段状态管理 Slice
 *
 * 管理部署阶段的状态：
 * - 已部署的舰船
 * - 部署就绪状态
 * - 放置预览
 * - 部署区域
 */

import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { FactionId, ShipTokenV2 } from '@vt/contracts/types';

// 部署区域类型
interface DeploymentZone {
  center: { x: number; y: number };
  radius: number;
  shape?: 'circle' | 'rectangle';
  size?: { width: number; height: number };
}

// ==================== 类型定义 ====================

/** 放置预览状态 */
interface PlacementPreview {
  shipDefinitionId: string;
  shipName: string;
  hullId: string;
}

/** 部署阶段状态 */
interface DeploymentSliceState {
  // 是否处于部署阶段
  isDeploymentPhase: boolean;
  // 各阵营已部署的舰船
  deployedShips: Record<FactionId, ShipTokenV2[]>;
  // 各阵营就绪状态
  readyStatus: Record<FactionId, boolean>;
  // 放置模式
  placementMode: boolean;
  // 放置预览
  placementPreview: PlacementPreview | null;
  // 部署区域
  deploymentZones: Record<FactionId, DeploymentZone>;
  // 选中的舰船（用于移除）
  selectedShipId: string | null;
  // 部署点数限制
  deploymentPoints: Record<FactionId, { used: number; max: number }>;
}

// ==================== 初始状态 ====================

const initialState: DeploymentSliceState = {
  isDeploymentPhase: false,
  deployedShips: {} as Record<FactionId, ShipTokenV2[]>,
  readyStatus: {} as Record<FactionId, boolean>,
  placementMode: false,
  placementPreview: null,
  deploymentZones: {} as Record<FactionId, DeploymentZone>,
  selectedShipId: null,
  deploymentPoints: {} as Record<FactionId, { used: number; max: number }>,
};

// ==================== Slice ====================

const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    /**
     * 开始部署阶段
     */
    startDeployment: (state, action: PayloadAction<{
      factions: FactionId[];
      zones?: Record<FactionId, DeploymentZone>;
      maxPoints?: number;
    }>) => {
      state.isDeploymentPhase = true;
      state.deployedShips = {} as Record<FactionId, ShipTokenV2[]>;
      state.readyStatus = {} as Record<FactionId, boolean>;
      state.deploymentPoints = {} as Record<FactionId, { used: number; max: number }>;

      for (const faction of action.payload.factions) {
        state.deployedShips[faction] = [];
        state.readyStatus[faction] = false;
        state.deploymentPoints[faction] = {
          used: 0,
          max: action.payload.maxPoints ?? 100,
        };
      }

      if (action.payload.zones) {
        state.deploymentZones = action.payload.zones;
      }
    },

    /**
     * 结束部署阶段
     */
    endDeployment: (state) => {
      state.isDeploymentPhase = false;
      state.placementMode = false;
      state.placementPreview = null;
      state.selectedShipId = null;
    },

    /**
     * 部署舰船
     */
    deployShip: (state, action: PayloadAction<{
      token: ShipTokenV2;
      cost?: number;
    }>) => {
      const { token, cost = 10 } = action.payload;
      const faction = token.faction as FactionId;

      if (!state.deployedShips[faction]) {
        state.deployedShips[faction] = [];
      }

      state.deployedShips[faction].push(token);

      if (state.deploymentPoints[faction]) {
        state.deploymentPoints[faction].used += cost;
      }
    },

    /**
     * 移除已部署的舰船
     */
    removeDeployedShip: (state, action: PayloadAction<{
      tokenId: string;
      faction: FactionId;
      cost?: number;
    }>) => {
      const { tokenId, faction, cost = 10 } = action.payload;

      if (state.deployedShips[faction]) {
        const index = state.deployedShips[faction].findIndex(s => s.id === tokenId);
        if (index !== -1) {
          state.deployedShips[faction].splice(index, 1);

          if (state.deploymentPoints[faction]) {
            state.deploymentPoints[faction].used = Math.max(
              0,
              state.deploymentPoints[faction].used - cost
            );
          }
        }
      }

      if (state.selectedShipId === tokenId) {
        state.selectedShipId = null;
      }
    },

    /**
     * 设置阵营就绪状态
     */
    setFactionReady: (state, action: PayloadAction<{
      faction: FactionId;
      ready: boolean;
    }>) => {
      state.readyStatus[action.payload.faction] = action.payload.ready;
    },

    /**
     * 设置放置模式
     */
    setPlacementMode: (state, action: PayloadAction<boolean>) => {
      state.placementMode = action.payload;
      if (!action.payload) {
        state.placementPreview = null;
      }
    },

    /**
     * 设置放置预览
     */
    setPlacementPreview: (state, action: PayloadAction<PlacementPreview | null>) => {
      state.placementPreview = action.payload;
      if (action.payload) {
        state.placementMode = true;
      }
    },

    /**
     * 清除放置预览
     */
    clearPlacementPreview: (state) => {
      state.placementPreview = null;
      state.placementMode = false;
    },

    /**
     * 设置部署区域
     */
    setDeploymentZone: (state, action: PayloadAction<{
      faction: FactionId;
      zone: DeploymentZone;
    }>) => {
      state.deploymentZones[action.payload.faction] = action.payload.zone;
    },

    /**
     * 选择舰船
     */
    selectShip: (state, action: PayloadAction<string | null>) => {
      state.selectedShipId = action.payload;
    },

    /**
     * 更新已部署舰船
     */
    updateDeployedShips: (state, action: PayloadAction<{
      faction: FactionId;
      ships: ShipTokenV2[];
    }>) => {
      state.deployedShips[action.payload.faction] = action.payload.ships;
    },

    /**
     * 同步部署状态
     */
    syncDeploymentState: (state, action: PayloadAction<{
      deployedShips: Record<FactionId, ShipTokenV2[]>;
      readyStatus: Record<FactionId, boolean>;
    }>) => {
      state.deployedShips = action.payload.deployedShips;
      state.readyStatus = action.payload.readyStatus;
    },

    /**
     * 重置部署状态
     */
    resetDeployment: () => initialState,
  },
});

// ==================== 导出 ====================

export const {
  startDeployment,
  endDeployment,
  deployShip,
  removeDeployedShip,
  setFactionReady,
  setPlacementMode,
  setPlacementPreview,
  clearPlacementPreview,
  setDeploymentZone,
  selectShip,
  updateDeployedShips,
  syncDeploymentState,
  resetDeployment,
} = deploymentSlice.actions;

// ==================== 选择器 ====================

// 基础选择器
const selectDeploymentState = (state: { deployment: DeploymentSliceState }) => state.deployment;

// 简单选择器
export const selectIsDeploymentPhase = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.isDeploymentPhase;

export const selectDeployedShips = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.deployedShips;

export const selectReadyStatus = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.readyStatus;

export const selectPlacementMode = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.placementMode;

export const selectPlacementPreview = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.placementPreview;

export const selectDeploymentZones = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.deploymentZones;

export const selectSelectedShipId = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.selectedShipId;

export const selectDeploymentPoints = (state: { deployment: DeploymentSliceState }) =>
  state.deployment.deploymentPoints;

// Memoized 选择器
export const selectFactionShips = (faction: FactionId) =>
  createSelector(
    [selectDeployedShips],
    (ships) => ships[faction] ?? []
  );

export const selectFactionReady = (faction: FactionId) =>
  createSelector(
    [selectReadyStatus],
    (status) => status[faction] ?? false
  );

export const selectAllFactionsReady = createSelector(
  [selectReadyStatus],
  (status) => Object.values(status).every(r => r)
);

export const selectTotalDeployedShips = createSelector(
  [selectDeployedShips],
  (ships) => Object.values(ships).flat().length
);

export const selectFactionDeploymentPoints = (faction: FactionId) =>
  createSelector(
    [selectDeploymentPoints],
    (points) => points[faction] ?? { used: 0, max: 100 }
  );

export const selectDeploymentZone = (faction: FactionId) =>
  createSelector(
    [selectDeploymentZones],
    (zones) => zones[faction]
  );

export default deploymentSlice.reducer;