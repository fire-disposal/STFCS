/**
 * 状态同步器 v2
 *
 * 基于统一领域事件系统的状态同步
 *
 * 目标：
 * 1. 使用领域事件而不是原始 WS 消息
 * 2. 自动同步到 Redux store
 * 3. 支持增量更新和批量更新
 * 4. 类型安全的事件处理
 */

import type { AppDispatch, RootState } from '@/store';
import type { DomainEvent, DomainEventType, EventContext } from '@vt/shared';
import { DOMAIN_EVENTS } from '@vt/shared';

// Redux actions
import {
  updateOtherPlayerCamera,
  removeOtherPlayerCamera,
  addToken,
  updateToken,
  removeToken,
} from '@/store/slices/mapSlice';
import {
  updateRemoteCamera,
  removeRemoteCamera,
} from '@/store/slices/cameraSlice';
import {
  setSelections,
  updateSelection,
  removeSelection,
  beginTokenDrag,
  updateTokenDrag,
  endTokenDrag,
} from '@/store/slices/selectionSlice';
import {
  addPlayer,
  updatePlayer,
  removePlayer,
} from '@/store/slices/playerSlice';
import {
  updateDMPlayers,
} from '@/store/slices/uiSlice';

/**
 * 事件处理器接口
 */
export interface DomainEventHandler {
  /**
   * 处理领域事件
   */
  handle(event: DomainEvent, context: EventContext, dispatch: AppDispatch, getState: () => RootState): void;
}

/**
 * 状态同步器配置
 */
export interface StateSyncV2Options {
  /** 是否启用日志 */
  enableLogging?: boolean;
  /** 自定义事件处理器 */
  customHandlers?: Partial<Record<DomainEventType, (payload: any, context: EventContext, dispatch: AppDispatch, getState: () => RootState) => void>>;
}

/**
 * 状态同步器 v2
 */
export class StateSyncV2 implements DomainEventHandler {
  private enableLogging: boolean;
  private customHandlers: Partial<Record<DomainEventType, (payload: any, context: EventContext, dispatch: AppDispatch, getState: () => RootState) => void>>;

  constructor(options: StateSyncV2Options = {}) {
    this.enableLogging = options.enableLogging ?? false;
    this.customHandlers = options.customHandlers ?? {};
  }

  /**
   * 处理领域事件并同步到 Redux
   */
  handle(event: DomainEvent, context: EventContext, dispatch: AppDispatch, getState: () => RootState): void {
    // 优先使用自定义处理器
    const customHandler = this.customHandlers[event.type];
    if (customHandler) {
      customHandler(event.payload, context, dispatch, getState);
      return;
    }

    // 默认处理器
    this.handleDefault(event, context, dispatch, getState);
  }

  /**
   * 默认事件处理
   */
  private handleDefault(event: DomainEvent, context: EventContext, dispatch: AppDispatch, getState: () => RootState): void {
    const { type, payload } = event;

    if (this.enableLogging) {
      console.log('[StateSyncV2] Handling event:', type, payload);
    }

    switch (type) {
      // ===== 玩家相关 =====
      case 'PLAYER_JOINED': {
        dispatch(addPlayer({
          id: payload.playerId,
          name: payload.playerName,
          joinedAt: payload.timestamp,
          isActive: true,
          isDMMode: false,
          isConnected: true,
          isReady: false,
          currentShipId: null,
          selectedTargets: [],
          usedActions: 0,
          pendingActions: 0,
          roomId: context.roomId,
          slotIndex: 0,
          hasActed: false,
          fluxVentingActive: false,
          gamePhase: 'lobby',
        }));
        break;
      }

      case 'PLAYER_LEFT': {
        dispatch(removePlayer(payload.playerId));
        dispatch(removeOtherPlayerCamera(payload.playerId));
        break;
      }

      case 'PLAYER_DM_MODE_CHANGED': {
        dispatch(updateDMPlayers([{
          id: payload.playerId,
          name: payload.playerName,
          isDMMode: payload.isDMMode,
        }]));
        break;
      }

      // ===== 相机相关 =====
      case 'CAMERA_UPDATED': {
        // 只更新其他玩家的相机
        dispatch(updateRemoteCamera({
          playerId: payload.playerId,
          playerName: payload.playerName,
          centerX: payload.centerX,
          centerY: payload.centerY,
          zoom: payload.zoom,
          rotation: payload.rotation,
          timestamp: payload.timestamp,
        }));
        break;
      }

      // ===== Token 相关 =====
      case 'TOKEN_MOVED': {
        dispatch(updateToken({
          id: payload.tokenId,
          updates: {
            position: payload.newPosition,
            heading: payload.newHeading,
          },
        }));
        break;
      }

      case 'OBJECT_SELECTED': {
        dispatch(updateSelection({
          tokenId: payload.tokenId,
          selectedBy: {
            id: payload.playerId,
            name: payload.playerName,
            isDMMode: payload.isDMMode,
          },
          timestamp: payload.timestamp,
        }));
        break;
      }

      case 'OBJECT_DESELECTED': {
        dispatch(removeSelection(payload.tokenId));
        break;
      }

      // ===== Token 拖拽相关 =====
      case 'TOKEN_DRAG_START': {
        dispatch(beginTokenDrag({
          tokenId: payload.tokenId,
          playerId: payload.playerId,
          playerName: payload.playerName,
          position: payload.position,
          heading: payload.heading,
          timestamp: payload.timestamp,
        }));
        break;
      }

      case 'TOKEN_DRAGGING': {
        dispatch(updateTokenDrag({
          tokenId: payload.tokenId,
          playerId: payload.playerId,
          playerName: payload.playerName,
          position: payload.position,
          heading: payload.heading,
          timestamp: payload.timestamp,
        }));
        break;
      }

      case 'TOKEN_DRAG_END': {
        dispatch(endTokenDrag({
          tokenId: payload.tokenId,
          playerId: payload.playerId,
          finalPosition: payload.finalPosition,
          finalHeading: payload.finalHeading,
          committed: payload.committed,
          timestamp: payload.timestamp,
        }));
        break;
      }

      // ===== 舰船相关 =====
      case 'SHIP_MOVED': {
        // 注意：舰船状态在 shipSlice 中，但 Token 在 mapSlice 中
        // 这里需要根据实际情况决定更新哪个 slice
        dispatch(updateToken({
          id: payload.shipId,
          updates: {
            position: payload.newPosition,
            heading: payload.newHeading,
          },
        }));
        break;
      }

      case 'SHIELD_TOGGLED': {
        // TODO: 更新舰船护盾状态
        if (this.enableLogging) {
          console.log('[StateSyncV2] Shield toggled:', payload.shipId, payload.isActive);
        }
        break;
      }

      case 'FLUX_STATE_UPDATED': {
        // TODO: 更新舰船 Flux 状态
        if (this.enableLogging) {
          console.log('[StateSyncV2] Flux state updated:', payload.shipId, payload.fluxState);
        }
        break;
      }

      // ===== 战斗相关 =====
      case 'WEAPON_FIRED': {
        // TODO: 添加武器开火效果
        if (this.enableLogging) {
          console.log('[StateSyncV2] Weapon fired:', payload.weaponId);
        }
        break;
      }

      case 'DAMAGE_DEALT': {
        // TODO: 添加战斗结果
        if (this.enableLogging) {
          console.log('[StateSyncV2] Damage dealt:', payload.targetShipId, payload.damage);
        }
        break;
      }

      default:
        // 未知事件类型，忽略
        if (this.enableLogging) {
          console.warn('[StateSyncV2] Unknown event type:', type);
        }
        break;
    }
  }
}

/**
 * 创建状态同步器 v2 实例
 */
export function createStateSyncV2(options?: StateSyncV2Options): StateSyncV2 {
  return new StateSyncV2(options);
}
