/**
 * WebSocket 消息类型定义
 *
 * 用于客户端内部的消息类型常量
 */

/** 消息类型常量 */
export const WS_MESSAGE_TYPES = {
  // 连接
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // 房间
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE: 'room:update',

  // 玩家
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_UPDATE: 'player:update',
  PLAYER_END_TURN: 'player:end_turn',
  PLAYER_CANCEL_END_TURN: 'player:cancel_end_turn',

  // Token
  TOKEN_MOVED: 'token:moved',
  TOKEN_DRAG_START: 'token:drag_start',
  TOKEN_DRAGGING: 'token:dragging',
  TOKEN_DRAG_END: 'token:drag_end',
  OBJECT_SELECTED: 'object:selected',
  OBJECT_DESELECTED: 'object:deselected',

  // 舰船
  SHIP_MOVED: 'ship:moved',
  SHIP_ACTION: 'ship:action',
  SHIELD_UPDATE: 'shield:update',
  FLUX_STATE: 'flux:state',

  // 战斗
  WEAPON_FIRED: 'weapon:fired',
  DAMAGE_DEALT: 'damage:dealt',

  // 相机
  CAMERA_UPDATED: 'camera:updated',

  // DM
  DM_STATUS_UPDATE: 'dm:status',

  // 聊天
  CHAT_MESSAGE: 'chat:message',
} as const;

/** 消息类型 */
export type WSMessageType = typeof WS_MESSAGE_TYPES[keyof typeof WS_MESSAGE_TYPES];

/** 基础消息结构 */
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp?: number;
}