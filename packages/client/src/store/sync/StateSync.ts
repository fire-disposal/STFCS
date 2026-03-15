/**
 * 客户端状态同步器
 * 
 * 目标：
 * 1. 自动将 WS 消息同步到 Redux store
 * 2. 统一的类型安全消息处理
 * 3. 支持增量更新和批量更新
 */

import type { AppDispatch, RootState } from '@/store';
import type { WSMessage, WSMessageType } from '@vt/shared';
import { WS_MESSAGE_TYPES } from '@vt/shared';

// Redux actions
import {
  updateOtherPlayerCamera,
  removeOtherPlayerCamera,
  clearOtherPlayersCameras,
  addToken,
  updateToken,
  removeToken,
  selectToken,
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
  addShip,
  updateShip,
  removeShip,
} from '@/store/slices/shipSlice';
import {
  addExplosion,
  addCombatResult,
} from '@/store/slices/combatSlice';
import {
  updateDMPlayers,
} from '@/store/slices/uiSlice';
import {
  addPlayer,
  updatePlayer,
  removePlayer,
  playerJoined,
  playerLeft,
} from '@/store/slices/playerSlice';

/**
 * 消息处理器接口
 */
export interface MessageHandler {
  /**
   * 处理消息
   */
  handle(message: WSMessage, dispatch: AppDispatch, getState: () => RootState): void;
}

/**
 * 状态同步器配置
 */
export interface StateSyncOptions {
  /** 是否启用日志 */
  enableLogging?: boolean;
  /** 自定义消息处理器 */
  customHandlers?: Partial<Record<WSMessageType, (payload: any, dispatch: AppDispatch, getState: () => RootState) => void>>;
}

/**
 * 状态同步器
 */
export class StateSync implements MessageHandler {
  private enableLogging: boolean;
  private customHandlers: Partial<Record<WSMessageType, (payload: any, dispatch: AppDispatch, getState: () => RootState) => void>>;

  constructor(options: StateSyncOptions = {}) {
    this.enableLogging = options.enableLogging ?? false;
    this.customHandlers = options.customHandlers ?? {};
  }

  /**
   * 处理 WS 消息并同步到 Redux
   */
  handle(message: WSMessage, dispatch: AppDispatch, getState: () => RootState): void {
    // 优先使用自定义处理器
    const customHandler = this.customHandlers[message.type];
    if (customHandler) {
      customHandler(message.payload, dispatch, getState);
      return;
    }

    // 默认处理器
    this.handleDefault(message, dispatch, getState);
  }

  /**
   * 默认消息处理
   */
  private handleDefault(message: WSMessage, dispatch: AppDispatch, getState: () => RootState): void {
    if (this.enableLogging) {
      console.log('[StateSync] Handling message:', message.type);
    }

    switch (message.type) {
      // ===== 玩家相关 =====
      case WS_MESSAGE_TYPES.PLAYER_JOINED: {
        const payload = message.payload;
        dispatch(playerJoined({
          id: payload.id,
          name: payload.name,
          joinedAt: payload.joinedAt,
          isActive: payload.isActive,
          isDMMode: payload.isDMMode,
          isConnected: true,
          isReady: false,
          currentShipId: null,
          selectedTargets: [],
          usedActions: 0,
          pendingActions: 0,
          roomId: '',
          slotIndex: 0,
          hasActed: false,
          fluxVentingActive: false,
          gamePhase: 'lobby',
        }));
        break;
      }

      case WS_MESSAGE_TYPES.PLAYER_LEFT: {
        const { playerId } = message.payload;
        dispatch(playerLeft(playerId));
        dispatch(removeOtherPlayerCamera(playerId));
        break;
      }

      case WS_MESSAGE_TYPES.DM_STATUS_UPDATE: {
        const { players } = message.payload;
        dispatch(updateDMPlayers(players.map(p => ({
          id: p.id,
          name: p.name,
          isDMMode: p.isDMMode,
        }))));
        break;
      }

      // ===== 相机相关 =====
      case WS_MESSAGE_TYPES.CAMERA_UPDATED: {
        const payload = message.payload;
        if ('playerId' in payload) {
          // 远程玩家相机
          dispatch(updateRemoteCamera(payload));
        }
        break;
      }

      // ===== Token 相关 =====
      case WS_MESSAGE_TYPES.TOKEN_PLACED: {
        dispatch(addToken(message.payload));
        break;
      }

      case WS_MESSAGE_TYPES.TOKEN_MOVED: {
        const { tokenId, newPosition, newHeading } = message.payload;
        dispatch(updateToken({
          id: tokenId,
          updates: {
            position: newPosition,
            heading: newHeading,
          },
        }));
        break;
      }

      case WS_MESSAGE_TYPES.SELECTION_UPDATE: {
        const { selections } = message.payload;
        const selectionRecords: Record<string, { selectedBy: { id: string; name: string; isDMMode: boolean } | null; timestamp: number }> = {};
        
        selections.forEach(s => {
          selectionRecords[s.tokenId] = {
            selectedBy: s.selectedBy,
            timestamp: s.timestamp,
          };
        });
        
        dispatch(setSelections(selectionRecords));
        break;
      }

      case WS_MESSAGE_TYPES.OBJECT_SELECTED: {
        const { playerId, playerName, tokenId, timestamp, forceOverride } = message.payload;
        dispatch(updateSelection({
          tokenId,
          selectedBy: {
            id: playerId,
            name: playerName,
            isDMMode: forceOverride ?? false,
          },
          timestamp,
        }));
        break;
      }

      case WS_MESSAGE_TYPES.OBJECT_DESELECTED: {
        const { tokenId } = message.payload;
        dispatch(removeSelection(tokenId));
        break;
      }

      // ===== Token 拖拽相关 =====
      case WS_MESSAGE_TYPES.TOKEN_DRAG_START: {
        const { tokenId, playerId, playerName, position, heading, timestamp } = message.payload;
        dispatch(beginTokenDrag({
          tokenId,
          playerId,
          playerName,
          position,
          heading,
          timestamp,
        }));
        break;
      }

      case WS_MESSAGE_TYPES.TOKEN_DRAGGING: {
        const { tokenId, playerId, playerName, position, heading, timestamp } = message.payload;
        dispatch(updateTokenDrag({
          tokenId,
          playerId,
          playerName,
          position,
          heading,
          timestamp,
        }));
        break;
      }

      case WS_MESSAGE_TYPES.TOKEN_DRAG_END: {
        const { tokenId, playerId, finalPosition, finalHeading, committed, timestamp } = message.payload;
        dispatch(endTokenDrag({
          tokenId,
          playerId,
          finalPosition,
          finalHeading,
          committed,
          timestamp,
        }));
        break;
      }

      // ===== 舰船相关 =====
      case WS_MESSAGE_TYPES.SHIP_MOVED: {
        const { shipId, newX, newY, newHeading } = message.payload;
        dispatch(updateShip({
          id: shipId,
          updates: {
            position: { x: newX, y: newY },
            heading: newHeading,
          },
        }));
        break;
      }

      case WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE: {
        const ship = message.payload;
        dispatch(updateShip({
          id: ship.id,
          updates: {
            hull: ship.hull,
            flux: {
              current: ship.flux.current,
              capacity: ship.flux.capacity,
              dissipation: 0,
              softFlux: ship.flux.softFlux,
              hardFlux: ship.flux.hardFlux,
            },
            fluxState: 'normal',
            shield: ship.shield,
            disabled: ship.disabled,
          },
        }));
        break;
      }

      case WS_MESSAGE_TYPES.SHIELD_UPDATE: {
        const { shipId, active, type, coverageAngle } = message.payload;
        dispatch(updateShip({
          id: shipId,
          updates: {
            shield: {
              type,
              radius: 0,
              centerOffset: { x: 0, y: 0 },
              coverageAngle,
              efficiency: 1,
              maintenanceCost: 0,
              active,
            },
          },
        }));
        break;
      }

      case WS_MESSAGE_TYPES.FLUX_STATE: {
        const { shipId, fluxState, currentFlux, softFlux, hardFlux } = message.payload;
        dispatch(updateShip({
          id: shipId,
          updates: {
            flux: {
              current: currentFlux,
              capacity: 0,
              dissipation: 0,
              softFlux,
              hardFlux,
            },
            fluxState,
          },
        }));
        break;
      }

      // ===== 战斗相关 =====
      case WS_MESSAGE_TYPES.EXPLOSION: {
        dispatch(addExplosion(message.payload));
        break;
      }

      case WS_MESSAGE_TYPES.DAMAGE_DEALT: {
        dispatch(addCombatResult(message.payload));
        break;
      }

      // ===== 绘图相关 =====
      case WS_MESSAGE_TYPES.DRAWING_ADD:
      case WS_MESSAGE_TYPES.DRAWING_CLEAR:
      case WS_MESSAGE_TYPES.DRAWING_SYNC:
        // TODO: 实现绘图状态同步
        if (this.enableLogging) {
          console.log('[StateSync] Drawing messages not yet implemented');
        }
        break;

      // ===== 聊天相关 =====
      case WS_MESSAGE_TYPES.CHAT_MESSAGE:
        // TODO: 实现聊天状态同步
        if (this.enableLogging) {
          console.log('[StateSync] Chat messages not yet implemented');
        }
        break;

      // ===== 房间相关 =====
      case WS_MESSAGE_TYPES.ROOM_UPDATE: {
        const { players } = message.payload;
        players.forEach(player => {
          dispatch(updatePlayer({
            id: player.id,
            updates: {
              isReady: player.isReady,
              currentShipId: player.currentShipId,
            },
          }));
        });
        break;
      }

      // ===== 回合系统相关 =====
      case WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED:
      case WS_MESSAGE_TYPES.TURN_ORDER_UPDATED:
      case WS_MESSAGE_TYPES.TURN_INDEX_CHANGED:
      case WS_MESSAGE_TYPES.UNIT_STATE_CHANGED:
      case WS_MESSAGE_TYPES.ROUND_INCREMENTED:
        // TODO: 实现回合状态同步
        if (this.enableLogging) {
          console.log('[StateSync] Turn messages not yet implemented');
        }
        break;

      // ===== 错误相关 =====
      case WS_MESSAGE_TYPES.ERROR: {
        console.error('[StateSync] Server error:', message.payload);
        break;
      }

      // ===== 其他消息（不需要状态同步）=====
      case WS_MESSAGE_TYPES.PING:
      case WS_MESSAGE_TYPES.PONG:
      case WS_MESSAGE_TYPES.REQUEST:
      case WS_MESSAGE_TYPES.RESPONSE:
      case WS_MESSAGE_TYPES.WEAPON_FIRED:
      case WS_MESSAGE_TYPES.MAP_INITIALIZED:
        // 这些消息不需要状态同步
        break;

      default:
        // 未知消息类型
        const _exhaustiveCheck: never = message;
        if (this.enableLogging) {
          console.warn('[StateSync] Unknown message type:', _exhaustiveCheck);
        }
    }
  }
}

/**
 * 创建状态同步器实例
 */
export function createStateSync(options?: StateSyncOptions): StateSync {
  return new StateSync(options);
}
