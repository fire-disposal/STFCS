/**
 * 部署阶段消息协议
 *
 * 定义部署阶段的所有消息类型：
 * - 舰船部署请求/响应
 * - 部署就绪状态
 * - 部署阶段控制
 */

import { z } from 'zod';
import { FactionIdSchema, PointSchema } from '../core-types.js';
import {
  ShipTokenV2Schema,
} from '../types/token-v2.js';

// ==================== 部署阶段消息类型常量 ====================

export const DEPLOYMENT_MESSAGE_TYPES = {
  // 部署操作
  DEPLOY_SHIP: 'DEPLOY_SHIP',
  DEPLOY_SHIP_RESULT: 'DEPLOY_SHIP_RESULT',
  REMOVE_DEPLOYED_SHIP: 'REMOVE_DEPLOYED_SHIP',
  REMOVE_DEPLOYED_SHIP_RESULT: 'REMOVE_DEPLOYED_SHIP_RESULT',

  // 部署就绪
  DEPLOYMENT_READY: 'DEPLOYMENT_READY',
  DEPLOYMENT_READY_UPDATE: 'DEPLOYMENT_READY_UPDATE',

  // 部署阶段控制
  DEPLOYMENT_START: 'DEPLOYMENT_START',
  DEPLOYMENT_COMPLETE: 'DEPLOYMENT_COMPLETE',
  DEPLOYMENT_CANCEL: 'DEPLOYMENT_CANCEL',

  // 部署状态同步
  DEPLOYMENT_STATE_SYNC: 'DEPLOYMENT_STATE_SYNC',
  DEPLOYMENT_SHIPS_UPDATE: 'DEPLOYMENT_SHIPS_UPDATE',
} as const;

export type DeploymentMessageType = typeof DEPLOYMENT_MESSAGE_TYPES[keyof typeof DEPLOYMENT_MESSAGE_TYPES];

// ==================== 部署舰船请求 Schema ====================

/** 部署舰船请求 Schema */
export const DeployShipRequestSchema = z.object({
  /** 舰船定义ID */
  shipDefinitionId: z.string().min(1),
  /** 所有者ID（玩家ID） */
  ownerId: z.string().min(1),
  /** 阵营ID */
  faction: FactionIdSchema,
  /** 部署位置 */
  position: PointSchema,
  /** 初始朝向 */
  heading: z.number().min(0).max(360),
  /** 舰船名称（可选） */
  shipName: z.string().optional(),
});

/** 部署舰船响应 Schema */
export const DeployShipResultSchema = z.object({
  success: z.boolean(),
  /** 创建的Token（成功时） */
  token: ShipTokenV2Schema.optional(),
  /** 错误信息（失败时） */
  error: z.string().optional(),
  /** 错误代码 */
  errorCode: z.enum([
    'INVALID_SHIP_DEFINITION',
    'INVALID_POSITION',
    'POSITION_OCCUPIED',
    'OUT_OF_DEPLOYMENT_ZONE',
    'FACTION_LIMIT_REACHED',
    'NOT_IN_DEPLOYMENT_PHASE',
  ]).optional(),
});

// ==================== 移除已部署舰船 Schema ====================

/** 移除已部署舰船请求 Schema */
export const RemoveDeployedShipRequestSchema = z.object({
  /** Token ID */
  tokenId: z.string().min(1),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 移除已部署舰船响应 Schema */
export const RemoveDeployedShipResultSchema = z.object({
  success: z.boolean(),
  /** 被移除的Token ID */
  tokenId: z.string().optional(),
  /** 错误信息 */
  error: z.string().optional(),
});

// ==================== 部署就绪 Schema ====================

/** 部署就绪请求 Schema */
export const DeploymentReadyRequestSchema = z.object({
  /** 阵营ID */
  faction: FactionIdSchema,
  /** 玩家ID */
  playerId: z.string().min(1),
  /** 是否就绪 */
  ready: z.boolean(),
});

/** 部署就绪状态更新 Schema */
export const DeploymentReadyUpdateSchema = z.object({
  /** 各阵营就绪状态 */
  factions: z.record(
    z.string(),
    z.object({
      ready: z.boolean(),
      players: z.array(z.object({
        playerId: z.string(),
        playerName: z.string(),
        ready: z.boolean(),
      })),
    })
  ),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 部署阶段控制 Schema ====================

/** 部署开始消息 Schema */
export const DeploymentStartSchema = z.object({
  /** 参与阵营 */
  factions: z.array(FactionIdSchema),
  /** 部署区域配置 */
  deploymentZones: z.record(
    z.string(),
    z.object({
      /** 部署区域中心 */
      center: PointSchema,
      /** 部署区域半径 */
      radius: z.number().min(0),
      /** 部署区域形状 */
      shape: z.enum(['circle', 'rectangle']).optional(),
      /** 矩形区域尺寸（shape为rectangle时） */
      size: z.object({
        width: z.number(),
        height: z.number(),
      }).optional(),
    })
  ).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 部署完成消息 Schema */
export const DeploymentCompleteSchema = z.object({
  /** 部署的舰船列表 */
  deployedShips: z.array(ShipTokenV2Schema),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 部署取消消息 Schema */
export const DeploymentCancelSchema = z.object({
  /** 取消原因 */
  reason: z.string().optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 部署状态同步 Schema ====================

/** 部署状态 Schema */
export const DeploymentStateSchema = z.object({
  /** 是否处于部署阶段 */
  isDeploymentPhase: z.boolean(),
  /** 各阵营已部署的舰船 */
  deployedShips: z.record(
    z.string(),
    z.array(ShipTokenV2Schema)
  ),
  /** 各阵营就绪状态 */
  readyStatus: z.record(
    z.string(),
    z.boolean()
  ),
  /** 部署区域 */
  deploymentZones: z.record(
    z.string(),
    z.object({
      center: PointSchema,
      radius: z.number(),
    })
  ).optional(),
});

/** 部署状态同步消息 Schema */
export const DeploymentStateSyncSchema = z.object({
  state: DeploymentStateSchema,
  timestamp: z.number(),
});

/** 部署舰船更新消息 Schema */
export const DeploymentShipsUpdateSchema = z.object({
  /** 阵营ID */
  faction: FactionIdSchema,
  /** 该阵营的舰船列表 */
  ships: z.array(ShipTokenV2Schema),
  /** 更新类型 */
  updateType: z.enum(['add', 'remove', 'update']),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 类型推导 ====================

export type DeployShipRequest = z.infer<typeof DeployShipRequestSchema>;
export type DeployShipResult = z.infer<typeof DeployShipResultSchema>;
export type RemoveDeployedShipRequest = z.infer<typeof RemoveDeployedShipRequestSchema>;
export type RemoveDeployedShipResult = z.infer<typeof RemoveDeployedShipResultSchema>;
export type DeploymentReadyRequest = z.infer<typeof DeploymentReadyRequestSchema>;
export type DeploymentReadyUpdate = z.infer<typeof DeploymentReadyUpdateSchema>;
export type DeploymentStart = z.infer<typeof DeploymentStartSchema>;
export type DeploymentComplete = z.infer<typeof DeploymentCompleteSchema>;
export type DeploymentCancel = z.infer<typeof DeploymentCancelSchema>;
export type DeploymentState = z.infer<typeof DeploymentStateSchema>;
export type DeploymentStateSync = z.infer<typeof DeploymentStateSyncSchema>;
export type DeploymentShipsUpdate = z.infer<typeof DeploymentShipsUpdateSchema>;

// ==================== 消息定义 ====================

/** 部署阶段消息目录 */
export const DeploymentMessageDirectory = {
  // 部署操作
  deployShip: {
    operation: 'deployment.deployShip',
    requestSchema: DeployShipRequestSchema,
    responseSchema: DeployShipResultSchema,
    description: '部署一艘舰船',
  },
  removeDeployedShip: {
    operation: 'deployment.removeShip',
    requestSchema: RemoveDeployedShipRequestSchema,
    responseSchema: RemoveDeployedShipResultSchema,
    description: '移除已部署的舰船',
  },
  setDeploymentReady: {
    operation: 'deployment.setReady',
    requestSchema: DeploymentReadyRequestSchema,
    responseSchema: z.object({ success: z.boolean() }),
    description: '设置部署就绪状态',
  },

  // 广播消息
  deploymentStart: {
    type: 'DEPLOYMENT_START',
    schema: DeploymentStartSchema,
    direction: 'broadcast' as const,
    description: '部署阶段开始',
  },
  deploymentComplete: {
    type: 'DEPLOYMENT_COMPLETE',
    schema: DeploymentCompleteSchema,
    direction: 'broadcast' as const,
    description: '部署阶段完成',
  },
  deploymentReadyUpdate: {
    type: 'DEPLOYMENT_READY_UPDATE',
    schema: DeploymentReadyUpdateSchema,
    direction: 'broadcast' as const,
    description: '部署就绪状态更新',
  },
  deploymentStateSync: {
    type: 'DEPLOYMENT_STATE_SYNC',
    schema: DeploymentStateSyncSchema,
    direction: 'broadcast' as const,
    description: '部署状态同步',
  },
  deploymentShipsUpdate: {
    type: 'DEPLOYMENT_SHIPS_UPDATE',
    schema: DeploymentShipsUpdateSchema,
    direction: 'broadcast' as const,
    description: '部署舰船更新',
  },
} as const;

// ==================== 工具函数 ====================

/** 创建默认部署状态 */
export function createDefaultDeploymentState(): DeploymentState {
  return {
    isDeploymentPhase: false,
    deployedShips: {},
    readyStatus: {},
  };
}

/** 检查部署位置是否有效 */
export function isValidDeploymentPosition(
  position: { x: number; y: number },
  zone?: { center: { x: number; y: number }; radius: number }
): boolean {
  if (!zone) return true;

  const dx = position.x - zone.center.x;
  const dy = position.y - zone.center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= zone.radius;
}

/** 检查两个舰船是否重叠 */
export function areShipsOverlapping(
  ship1: { position: { x: number; y: number }; visual: { collisionRadius: number } },
  ship2: { position: { x: number; y: number }; visual: { collisionRadius: number } },
  minDistance: number = 10
): boolean {
  const dx = ship1.position.x - ship2.position.x;
  const dy = ship1.position.y - ship2.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const combinedRadius = ship1.visual.collisionRadius + ship2.visual.collisionRadius;

  return distance < combinedRadius + minDistance;
}