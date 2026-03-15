/**
 * 统一消息协议层
 * 
 * 原则：
 * 1. 从 core-types.ts 导入基础 schema
 * 2. 只定义消息级别的 schema
 * 3. 避免重复定义
 */

import { z } from 'zod';
import {
  PointSchema,
  PlayerInfoSchema,
  TokenInfoSchema,
  CameraStateSchema,
  ShipMovementSchema,
  ShipStatusSchema,
  ExplosionDataSchema,
  CombatResultSchema,
  MapConfigSchema,
  TokenTypeSchema,
  UnitTurnStateSchema,
} from '../core-types';

// ==================== 消息定义工具 ====================

/** 消息配置 */
export interface MessageConfig<T extends z.ZodType> {
  /** 消息类型字符串 */
  type: string;
  /** 负载 schema */
  schema: T;
  /** 是否广播 */
  broadcast?: boolean;
  /** 是否需要确认 */
  requireAck?: boolean;
}

/** 请求消息配置 */
export interface RequestConfig<TReq extends z.ZodType, TRes extends z.ZodType> {
  type: string;
  requestSchema: TReq;
  responseSchema: TRes;
}

/** 事件消息配置 */
export interface EventConfig<T extends z.ZodType> {
  type: string;
  schema: T;
  /** 转换为 WS 消息的函数 */
  toWSMessage?: (event: z.infer<T>, roomId: string) => unknown;
}

// ==================== 消息目录定义 ====================

/**
 * 玩家相关消息
 */
export const PlayerMessages = {
  PLAYER_JOINED: {
    type: 'PLAYER_JOINED' as const,
    schema: PlayerInfoSchema,
    broadcast: true,
  },
  PLAYER_LEFT: {
    type: 'PLAYER_LEFT' as const,
    schema: z.object({
      playerId: z.string(),
      reason: z.string().optional(),
    }),
    broadcast: true,
  },
  DM_TOGGLE: {
    type: 'DM_TOGGLE' as const,
    schema: z.object({
      playerId: z.string(),
      playerName: z.string(),
      enable: z.boolean(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  DM_STATUS_UPDATE: {
    type: 'DM_STATUS_UPDATE' as const,
    schema: z.object({
      players: z.array(z.object({
        id: z.string(),
        name: z.string(),
        isDMMode: z.boolean(),
      })),
    }),
    broadcast: true,
  },
} as const;

/**
 * Token/选中相关消息
 */
export const TokenMessages = {
  TOKEN_PLACED: {
    type: 'TOKEN_PLACED' as const,
    schema: TokenInfoSchema,
    broadcast: true,
  },
  TOKEN_MOVED: {
    type: 'TOKEN_MOVED' as const,
    schema: z.object({
      tokenId: z.string(),
      previousPosition: PointSchema,
      newPosition: PointSchema,
      previousHeading: z.number(),
      newHeading: z.number(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  OBJECT_SELECTED: {
    type: 'OBJECT_SELECTED' as const,
    schema: z.object({
      playerId: z.string(),
      playerName: z.string(),
      tokenId: z.string(),
      timestamp: z.number(),
      forceOverride: z.boolean().optional(),
    }),
    broadcast: true,
  },
  OBJECT_DESELECTED: {
    type: 'OBJECT_DESELECTED' as const,
    schema: z.object({
      playerId: z.string(),
      tokenId: z.string(),
      timestamp: z.number(),
      reason: z.enum(['manual', 'override', 'released']).optional(),
    }),
    broadcast: true,
  },
  SELECTION_UPDATE: {
    type: 'SELECTION_UPDATE' as const,
    schema: z.object({
      selections: z.array(z.object({
        tokenId: z.string(),
        selectedBy: z.object({
          id: z.string(),
          name: z.string(),
          isDMMode: z.boolean(),
        }).nullable(),
        timestamp: z.number(),
      })),
    }),
    broadcast: true,
  },
  TOKEN_DRAG_START: {
    type: 'TOKEN_DRAG_START' as const,
    schema: z.object({
      tokenId: z.string(),
      playerId: z.string(),
      playerName: z.string(),
      position: PointSchema,
      heading: z.number(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  TOKEN_DRAGGING: {
    type: 'TOKEN_DRAGGING' as const,
    schema: z.object({
      tokenId: z.string(),
      playerId: z.string(),
      playerName: z.string(),
      position: PointSchema,
      heading: z.number(),
      timestamp: z.number(),
      isDragging: z.boolean(),
    }),
    broadcast: true,
  },
  TOKEN_DRAG_END: {
    type: 'TOKEN_DRAG_END' as const,
    schema: z.object({
      tokenId: z.string(),
      playerId: z.string(),
      finalPosition: PointSchema,
      finalHeading: z.number(),
      timestamp: z.number(),
      committed: z.boolean(),
    }),
    broadcast: true,
  },
} as const;

/**
 * 相机相关消息
 */
export const CameraMessages = {
  CAMERA_UPDATED: {
    type: 'CAMERA_UPDATED' as const,
    schema: z.object({
      playerId: z.string(),
      playerName: z.string(),
      centerX: z.number(),
      centerY: z.number(),
      zoom: z.number(),
      rotation: z.number(),
      minZoom: z.number(),
      maxZoom: z.number(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
} as const;

/**
 * 舰船相关消息
 */
export const ShipMessages = {
  SHIP_MOVED: {
    type: 'SHIP_MOVED' as const,
    schema: z.object({
      shipId: z.string(),
      phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      type: z.enum(['straight', 'strafe', 'rotate']),
      distance: z.number().optional(),
      angle: z.number().optional(),
      newX: z.number(),
      newY: z.number(),
      newHeading: z.number(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  SHIP_STATUS_UPDATE: {
    type: 'SHIP_STATUS_UPDATE' as const,
    schema: z.object({
      id: z.string(),
      hull: z.object({ current: z.number(), max: z.number() }),
      flux: z.object({ 
        current: z.number(), 
        capacity: z.number(),
        softFlux: z.number(),
        hardFlux: z.number(),
      }),
      shield: z.object({
        type: z.enum(['front', 'full']),
        active: z.boolean(),
      }),
      position: PointSchema,
      heading: z.number(),
      disabled: z.boolean(),
    }),
    broadcast: true,
  },
  SHIELD_UPDATE: {
    type: 'SHIELD_UPDATE' as const,
    schema: z.object({
      shipId: z.string(),
      active: z.boolean(),
      type: z.enum(['front', 'full']),
      coverageAngle: z.number(),
    }),
    broadcast: true,
  },
  FLUX_STATE: {
    type: 'FLUX_STATE' as const,
    schema: z.object({
      shipId: z.string(),
      fluxState: z.enum(['normal', 'venting', 'overloaded']),
      currentFlux: z.number(),
      softFlux: z.number(),
      hardFlux: z.number(),
    }),
    broadcast: true,
  },
} as const;

/**
 * 战斗相关消息
 */
export const CombatMessages = {
  EXPLOSION: {
    type: 'EXPLOSION' as const,
    schema: z.object({
      id: z.string(),
      position: PointSchema,
      radius: z.number(),
      damage: z.number(),
      sourceShipId: z.string().optional(),
      targetShipId: z.string().optional(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  WEAPON_FIRED: {
    type: 'WEAPON_FIRED' as const,
    schema: z.object({
      sourceShipId: z.string(),
      targetShipId: z.string(),
      weaponId: z.string(),
      mountId: z.string(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
  DAMAGE_DEALT: {
    type: 'DAMAGE_DEALT' as const,
    schema: z.object({
      sourceShipId: z.string(),
      targetShipId: z.string(),
      hit: z.boolean(),
      damage: z.number().optional(),
      shieldAbsorbed: z.number(),
      armorReduced: z.number(),
      hullDamage: z.number(),
      softFluxGenerated: z.number(),
      hardFluxGenerated: z.number(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
} as const;

/**
 * 房间相关消息
 */
export const RoomMessages = {
  ROOM_UPDATE: {
    type: 'ROOM_UPDATE' as const,
    schema: z.object({
      roomId: z.string(),
      players: z.array(z.object({
        id: z.string(),
        name: z.string(),
        isReady: z.boolean(),
        currentShipId: z.string().nullable(),
      })),
    }),
    broadcast: false,
  },
} as const;

/**
 * 绘图相关消息
 */
export const DrawingMessages = {
  DRAWING_ADD: {
    type: 'DRAWING_ADD' as const,
    schema: z.object({
      playerId: z.string(),
      element: z.object({
        type: z.enum(['path', 'line', 'arrow', 'rect', 'circle']),
        color: z.string(),
        lineWidth: z.number(),
        path: z.string().optional(),
        x1: z.number().optional(),
        y1: z.number().optional(),
        x2: z.number().optional(),
        y2: z.number().optional(),
        cx: z.number().optional(),
        cy: z.number().optional(),
        radius: z.number().optional(),
      }),
    }),
    broadcast: true,
  },
  DRAWING_CLEAR: {
    type: 'DRAWING_CLEAR' as const,
    schema: z.object({
      playerId: z.string(),
    }),
    broadcast: true,
  },
  DRAWING_SYNC: {
    type: 'DRAWING_SYNC' as const,
    schema: z.object({
      elements: z.array(z.unknown()),
    }),
    broadcast: false,
  },
} as const;

/**
 * 聊天相关消息
 */
export const ChatMessages = {
  CHAT_MESSAGE: {
    type: 'CHAT_MESSAGE' as const,
    schema: z.object({
      senderId: z.string(),
      senderName: z.string(),
      content: z.string(),
      timestamp: z.number(),
    }),
    broadcast: true,
  },
} as const;

/**
 * 连接相关消息
 */
export const ConnectionMessages = {
  PING: {
    type: 'PING' as const,
    schema: z.object({
      timestamp: z.number(),
    }),
    broadcast: false,
  },
  PONG: {
    type: 'PONG' as const,
    schema: z.object({
      timestamp: z.number(),
    }),
    broadcast: false,
  },
} as const;

/**
 * 错误消息
 */
export const ErrorMessages = {
  ERROR: {
    type: 'ERROR' as const,
    schema: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
    broadcast: false,
  },
} as const;

// ==================== 请求/响应消息 ====================

/**
 * 请求操作定义
 */
export const RequestOperations = {
  PLAYER_JOIN: {
    type: 'player.join' as const,
    requestSchema: z.object({
      id: z.string(),
      name: z.string(),
      roomId: z.string().optional(),
    }),
    responseSchema: PlayerInfoSchema,
  },
  PLAYER_LEAVE: {
    type: 'player.leave' as const,
    requestSchema: z.object({
      playerId: z.string(),
      roomId: z.string(),
    }),
    responseSchema: z.void(),
  },
  PLAYER_LIST: {
    type: 'player.list' as const,
    requestSchema: z.object({
      roomId: z.string(),
    }),
    responseSchema: z.array(PlayerInfoSchema),
  },
  ROOM_LIST: {
    type: 'room.list' as const,
    requestSchema: z.object({}),
    responseSchema: z.object({
      rooms: z.array(z.object({
        roomId: z.string(),
        playerCount: z.number(),
        maxPlayers: z.number(),
        createdAt: z.number(),
      })),
    }),
  },
  ROOM_CREATE: {
    type: 'room.create' as const,
    requestSchema: z.object({
      roomId: z.string(),
      maxPlayers: z.number().optional(),
    }),
    responseSchema: z.object({
      roomId: z.string(),
    }),
  },
  CAMERA_UPDATE: {
    type: 'camera.update' as const,
    requestSchema: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }),
    responseSchema: z.void(),
  },
  DM_TOGGLE: {
    type: 'dm.toggle' as const,
    requestSchema: z.object({
      enable: z.boolean(),
    }),
    responseSchema: PlayerInfoSchema,
  },
} as const;

// ==================== 类型推导工具 ====================

/** 从消息配置推导消息类型 */
export type InferMessage<T extends { type: string; schema: z.ZodType }> = {
  type: T['type'];
  payload: z.infer<T['schema']>;
};

/** 从请求配置推导请求类型 */
export type InferRequest<T extends { type: string; requestSchema: z.ZodType; responseSchema: z.ZodType }> = {
  type: 'REQUEST';
  payload: {
    requestId: string;
    operation: T['type'];
    data: z.infer<T['requestSchema']>;
  };
};

/** 从请求配置推导响应类型 */
export type InferResponse<T extends { type: string; requestSchema: z.ZodType; responseSchema: z.ZodType }> = {
  type: 'RESPONSE';
  payload: {
    requestId: string;
  } & (
    | { success: true; operation: T['type']; data: z.infer<T['responseSchema']>; timestamp: number }
    | { success: false; operation: T['type']; error: { code: string; message: string; details?: Record<string, unknown> }; timestamp: number }
  );
};

/** 所有广播消息的联合类型 */
export type BroadcastMessage = 
  | InferMessage<typeof PlayerMessages.PLAYER_JOINED>
  | InferMessage<typeof PlayerMessages.PLAYER_LEFT>
  | InferMessage<typeof PlayerMessages.DM_TOGGLE>
  | InferMessage<typeof PlayerMessages.DM_STATUS_UPDATE>
  | InferMessage<typeof TokenMessages.TOKEN_PLACED>
  | InferMessage<typeof TokenMessages.TOKEN_MOVED>
  | InferMessage<typeof TokenMessages.OBJECT_SELECTED>
  | InferMessage<typeof TokenMessages.OBJECT_DESELECTED>
  | InferMessage<typeof TokenMessages.SELECTION_UPDATE>
  | InferMessage<typeof TokenMessages.TOKEN_DRAG_START>
  | InferMessage<typeof TokenMessages.TOKEN_DRAGGING>
  | InferMessage<typeof TokenMessages.TOKEN_DRAG_END>
  | InferMessage<typeof CameraMessages.CAMERA_UPDATED>
  | InferMessage<typeof ShipMessages.SHIP_MOVED>
  | InferMessage<typeof ShipMessages.SHIP_STATUS_UPDATE>
  | InferMessage<typeof ShipMessages.SHIELD_UPDATE>
  | InferMessage<typeof ShipMessages.FLUX_STATE>
  | InferMessage<typeof CombatMessages.EXPLOSION>
  | InferMessage<typeof CombatMessages.WEAPON_FIRED>
  | InferMessage<typeof CombatMessages.DAMAGE_DEALT>
  | InferMessage<typeof DrawingMessages.DRAWING_ADD>
  | InferMessage<typeof DrawingMessages.DRAWING_CLEAR>
  | InferMessage<typeof ChatMessages.CHAT_MESSAGE>
  | InferMessage<typeof ErrorMessages.ERROR>;

/** 所有请求/响应消息的联合类型 */
export type RequestResponseMessage = 
  | InferRequest<typeof RequestOperations.PLAYER_JOIN>
  | InferRequest<typeof RequestOperations.PLAYER_LEAVE>
  | InferRequest<typeof RequestOperations.PLAYER_LIST>
  | InferRequest<typeof RequestOperations.ROOM_LIST>
  | InferRequest<typeof RequestOperations.ROOM_CREATE>
  | InferRequest<typeof RequestOperations.CAMERA_UPDATE>
  | InferRequest<typeof RequestOperations.DM_TOGGLE>
  | InferResponse<typeof RequestOperations.PLAYER_JOIN>
  | InferResponse<typeof RequestOperations.PLAYER_LEAVE>
  | InferResponse<typeof RequestOperations.PLAYER_LIST>
  | InferResponse<typeof RequestOperations.ROOM_LIST>
  | InferResponse<typeof RequestOperations.ROOM_CREATE>
  | InferResponse<typeof RequestOperations.CAMERA_UPDATE>
  | InferResponse<typeof RequestOperations.DM_TOGGLE>;

/** 所有 WS 消息的联合类型 */
export type WSMessage = BroadcastMessage | RequestResponseMessage;

/** 消息类型字符串 */
export type WSMessageType = WSMessage['type'];

/** 从类型字符串提取消息 */
export type WSMessageOf<T extends WSMessageType> = Extract<WSMessage, { type: T }>;

/** 消息 payload 类型 */
export type WSPayload<T extends WSMessageType> = WSMessageOf<T>['payload'];

// ==================== 消息验证器 ====================

/**
 * 验证并解析消息
 * @param type 消息类型
 * @param payload 消息负载
 * @returns 验证后的消息或错误
 */
export function validateMessage<T extends WSMessageType>(
  type: T,
  payload: unknown
): { success: true; message: WSMessageOf<T> } | { success: false; error: string } {
  const schema = getSchemaForType(type);
  if (!schema) {
    return { success: false, error: `Unknown message type: ${type}` };
  }
  
  try {
    const validated = schema.parse(payload);
    return { success: true, message: { type, payload: validated } as WSMessageOf<T> };
  } catch (err) {
    const error = err as any;
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * 获取消息类型的 schema
 */
function getSchemaForType(type: string): z.ZodType | null {
  // 广播消息
  const broadcastMessages = [
    PlayerMessages, TokenMessages, CameraMessages, 
    ShipMessages, CombatMessages, DrawingMessages,
    ChatMessages, ErrorMessages, ConnectionMessages, RoomMessages
  ];
  
  for (const group of broadcastMessages) {
    for (const msg of Object.values(group)) {
      if (msg.type === type) {
        return msg.schema;
      }
    }
  }
  
  return null;
}

// ==================== 导出 ====================
