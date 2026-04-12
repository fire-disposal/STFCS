/**
 * 根状态分层定义
 *
 * 将 Redux 状态分为三层：
 * 1. Domain - 领域状态（来自服务器，只读）
 * 2. UI - UI 状态（本地）
 * 3. Cache - 缓存状态（本地计算）
 */

import type { PlayerInfo, TokenInfo, ShipStatus } from '@vt/contracts/types';
import type { SelectionRecord } from '@/store/slices/selectionSlice';

/**
 * 领域状态层
 * 
 * 来自服务器的数据，客户端只读
 * 通过 WS 事件自动同步
 */
export interface DomainState {
  /** 玩家实体 */
  players: Record<string, PlayerInfo & {
    isConnected: boolean;
    isReady: boolean;
    currentShipId: string | null;
  }>;

  /** Token 实体 */
  tokens: Record<string, TokenInfo>;

  /** 舰船状态实体 */
  ships: Record<string, ShipStatus>;

  /** 选中状态 */
  selections: Record<string, SelectionRecord>;
}

/**
 * UI 状态层
 * 
 * 纯本地 UI 状态，不与服务器同步
 */
export interface UIState {
  /** 相机状态 */
  camera: {
    local: {
      centerX: number;
      centerY: number;
      zoom: number;
      rotation: number;
      minZoom?: number;
      maxZoom?: number;
    };
    /** 其他玩家的相机 */
    remote: Record<string, {
      playerId: string;
      playerName: string;
      centerX: number;
      centerY: number;
      zoom: number;
      rotation: number;
      timestamp: number;
    }>;
  };

  /** 交互状态 */
  interaction: {
    mode: 'idle' | 'hoverToken' | 'dragToken' | 'panning';
    cursor: 'default' | 'grab' | 'grabbing' | 'pointer' | 'move' | 'crosshair';
    keyboard: {
      isSpacePressed: boolean;
      isShiftPressed: boolean;
      isCtrlPressed: boolean;
    };
  };

  /** 图层状态 */
  layers: {
    visibility: Record<string, boolean>;
    currentViewMode: 'tactical' | 'strategic' | 'free';
  };

  /** 面板状态 */
  panels: {
    leftPanelCollapsed: boolean;
    rightPanelCollapsed: boolean;
    chatExpanded: boolean;
  };

  /** 连接状态 */
  connection: {
    isConnected: boolean;
    isConnecting: boolean;
    playerId: string | null;
    playerName: string | null;
    roomId: string | null;
    lastPing: number;
  };

  /** 工具选择 */
  selectedTool: string;

  /** DM 模式玩家列表 */
  dmPlayers: Array<{
    id: string;
    name: string;
    isDMMode: boolean;
  }>;
}

/**
 * 缓存状态层
 * 
 * 本地计算的状态，用于性能优化
 */
export interface CacheState {
  /** Token 位置缓存 */
  tokenPositions: Record<string, {
    x: number;
    y: number;
    timestamp: number;
  }>;

  /** 可见 Token 列表 */
  visibleTokens: string[];

  /** 可见 Token 的缓存时间 */
  visibleTokensTimestamp: number;
}

/**
 * 完整的根状态
 */
export interface AppRootState {
  /** 领域状态 */
  domain: DomainState;

  /** UI 状态 */
  ui: UIState;

  /** 缓存状态 */
  cache: CacheState;
}

/**
 * 状态分层工具
 */
export const StateLayers = {
  /**
   * 检查状态是否属于领域层
   */
  isDomain: (key: keyof AppRootState): key is 'domain' => key === 'domain',

  /**
   * 检查状态是否属于 UI 层
   */
  isUI: (key: keyof AppRootState): key is 'ui' => key === 'ui',

  /**
   * 检查状态是否属于缓存层
   */
  isCache: (key: keyof AppRootState): key is 'cache' => key === 'cache',

  /**
   * 获取状态层的可变性
   */
  getMutability: (layer: keyof AppRootState): 'readonly' | 'writable' => {
    switch (layer) {
      case 'domain':
        return 'readonly'; // 领域状态只能通过事件更新
      case 'ui':
        return 'writable'; // UI 状态可以自由修改
      case 'cache':
        return 'writable'; // 缓存状态可以重新计算
      default:
        return 'writable';
    }
  },
};

/**
 * 状态更新策略
 */
export const UpdateStrategies = {
  /**
   * 领域状态更新策略
   * - 只能通过事件触发
   * - 批量更新
   * - 乐观更新支持
   */
  domain: {
    allowDirectMutation: false,
    requiresEvent: true,
    supportsBatching: true,
    supportsOptimistic: true,
  },

  /**
   * UI 状态更新策略
   * - 可以直接修改
   * - 立即生效
   */
  ui: {
    allowDirectMutation: true,
    requiresEvent: false,
    supportsBatching: false,
    supportsOptimistic: false,
  },

  /**
   * 缓存状态更新策略
   * - 基于计算
   * - 惰性更新
   */
  cache: {
    allowDirectMutation: true,
    requiresEvent: false,
    supportsBatching: true,
    supportsOptimistic: false,
  },
};

// 导出类型
export type StateLayer = 'domain' | 'ui' | 'cache';
export type MutabilityType = 'readonly' | 'writable';
export type UpdateStrategy = typeof UpdateStrategies['domain'];
