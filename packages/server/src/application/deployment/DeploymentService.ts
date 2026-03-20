/**
 * 部署阶段服务
 *
 * 管理部署阶段的完整流程：
 * - 舰船部署
 * - 部署就绪状态
 * - 部署区域验证
 * - 部署完成处理
 */

import type { FactionId } from '@vt/shared/types';
import type { ShipTokenV2 } from '@vt/shared/types';
import type {
  DeployShipRequest,
  DeployShipResult,
  RemoveDeployedShipRequest,
  RemoveDeployedShipResult,
  DeploymentReadyRequest,
  DeploymentState,
  DeploymentStart,
} from '@vt/shared/protocol';
import {
  createDefaultDeploymentState,
  isValidDeploymentPosition,
  areShipsOverlapping,
} from '@vt/shared/protocol';
import { TokenFactory, type TokenFactoryDeps } from './TokenFactory.js';

// ==================== 类型定义 ====================

/** 部署区域配置 */
export interface DeploymentZone {
  center: { x: number; y: number };
  radius: number;
  shape?: 'circle' | 'rectangle';
  size?: { width: number; height: number };
}

/** 部署服务依赖 */
export interface DeploymentServiceDeps extends TokenFactoryDeps {
  /** 广播消息 */
  broadcast(message: unknown): void;
  /** 发送消息给特定客户端 */
  sendTo(clientId: string, message: unknown): void;
  /** 获取房间内的所有玩家 */
  getPlayersInRoom(roomId: string): Array<{ id: string; name: string; faction?: FactionId }>;
  /** 检查玩家是否在房间内 */
  isPlayerInRoom(playerId: string, roomId: string): boolean;
  /** 获取玩家的阵营 */
  getPlayerFaction(playerId: string): FactionId | undefined;
}

/** 部署服务事件 */
export type DeploymentEvent =
  | { type: 'SHIP_DEPLOYED'; token: ShipTokenV2; playerId: string }
  | { type: 'SHIP_REMOVED'; tokenId: string; playerId: string }
  | { type: 'READY_STATUS_CHANGED'; faction: FactionId; playerId: string; ready: boolean }
  | { type: 'DEPLOYMENT_COMPLETE'; ships: ShipTokenV2[] };

// ==================== 部署服务类 ====================

export class DeploymentService {
  private readonly tokenFactory: TokenFactory;
  private readonly state: DeploymentState;
  private readonly deploymentZones: Map<FactionId, DeploymentZone> = new Map();
  private readonly events: DeploymentEvent[] = [];

  constructor(private readonly deps: DeploymentServiceDeps) {
    this.tokenFactory = new TokenFactory(deps);
    this.state = createDefaultDeploymentState();
  }

  // ==================== 部署阶段控制 ====================

  /**
   * 开始部署阶段
   */
  startDeployment(factions: FactionId[], zones?: Record<string, DeploymentZone>): DeploymentStart {
    this.state.isDeploymentPhase = true;
    this.state.deployedShips = {};
    this.state.readyStatus = {};

    // 初始化各阵营状态
    for (const faction of factions) {
      this.state.deployedShips[faction] = [];
      this.state.readyStatus[faction] = false;

      // 设置部署区域
      if (zones?.[faction]) {
        this.deploymentZones.set(faction, zones[faction]);
      }
    }

    return {
      factions,
      deploymentZones: zones ? Object.fromEntries(
        Object.entries(zones).map(([faction, zone]) => [faction, {
          center: zone.center,
          radius: zone.radius,
        }])
      ) : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * 结束部署阶段
   */
  completeDeployment(): ShipTokenV2[] {
    const allShips: ShipTokenV2[] = [];

    for (const ships of Object.values(this.state.deployedShips)) {
      allShips.push(...ships);
    }

    this.state.isDeploymentPhase = false;
    this.events.push({ type: 'DEPLOYMENT_COMPLETE', ships: allShips });

    return allShips;
  }

  /**
   * 取消部署阶段
   */
  cancelDeployment(reason?: string): void {
    this.state.isDeploymentPhase = false;
    this.state.deployedShips = {};
    this.state.readyStatus = {};
    this.deploymentZones.clear();
  }

  // ==================== 舰船部署 ====================

  /**
   * 部署舰船
   */
  deployShip(request: DeployShipRequest, requesterId: string): DeployShipResult {
    // 检查是否在部署阶段
    if (!this.state.isDeploymentPhase) {
      return {
        success: false,
        error: '当前不在部署阶段',
        errorCode: 'NOT_IN_DEPLOYMENT_PHASE',
      };
    }

    // 检查请求者是否与所有者匹配
    if (request.ownerId !== requesterId) {
      return {
        success: false,
        error: '只能为自己部署舰船',
        errorCode: 'INVALID_SHIP_DEFINITION',
      };
    }

    // 检查部署区域
    const zone = this.deploymentZones.get(request.faction);
    if (zone && !isValidDeploymentPosition(request.position, zone)) {
      return {
        success: false,
        error: '部署位置超出允许区域',
        errorCode: 'OUT_OF_DEPLOYMENT_ZONE',
      };
    }

    // 检查位置是否被占用
    const existingShips = this.state.deployedShips[request.faction] ?? [];
    for (const ship of existingShips) {
      if (areShipsOverlapping(
        { position: request.position, visual: { collisionRadius: 50 } },
        { position: ship.position, visual: ship.visual }
      )) {
        return {
          success: false,
          error: '部署位置已被占用',
          errorCode: 'POSITION_OCCUPIED',
        };
      }
    }

    // 创建 Token
    const token = this.tokenFactory.createShipToken({
      shipDefinitionId: request.shipDefinitionId,
      ownerId: request.ownerId,
      faction: request.faction,
      position: request.position,
      heading: request.heading,
      shipName: request.shipName,
    });

    if (!token) {
      return {
        success: false,
        error: '无效的舰船定义',
        errorCode: 'INVALID_SHIP_DEFINITION',
      };
    }

    // 添加到部署列表
    if (!this.state.deployedShips[request.faction]) {
      this.state.deployedShips[request.faction] = [];
    }
    this.state.deployedShips[request.faction].push(token);

    // 记录事件
    this.events.push({
      type: 'SHIP_DEPLOYED',
      token,
      playerId: requesterId,
    });

    return {
      success: true,
      token,
    };
  }

  /**
   * 移除已部署的舰船
   */
  removeDeployedShip(request: RemoveDeployedShipRequest): RemoveDeployedShipResult {
    // 查找舰船
    let foundFaction: FactionId | null = null;
    let foundIndex: number = -1;

    for (const [faction, ships] of Object.entries(this.state.deployedShips)) {
      const index = ships.findIndex(ship => ship.id === request.tokenId);
      if (index !== -1) {
        foundFaction = faction as FactionId;
        foundIndex = index;
        break;
      }
    }

    if (foundFaction === null || foundIndex === -1) {
      return {
        success: false,
        error: '未找到指定的舰船',
      };
    }

    // 检查权限（只有所有者可以移除）
    const ship = this.state.deployedShips[foundFaction][foundIndex];
    if (ship.ownerId !== request.requesterId) {
      return {
        success: false,
        error: '只能移除自己部署的舰船',
      };
    }

    // 移除舰船
    this.state.deployedShips[foundFaction].splice(foundIndex, 1);

    // 记录事件
    this.events.push({
      type: 'SHIP_REMOVED',
      tokenId: request.tokenId,
      playerId: request.requesterId,
    });

    return {
      success: true,
      tokenId: request.tokenId,
    };
  }

  // ==================== 就绪状态 ====================

  /**
   * 设置部署就绪状态
   */
  setDeploymentReady(request: DeploymentReadyRequest): boolean {
    if (!this.state.isDeploymentPhase) {
      return false;
    }

    // 更新就绪状态
    this.state.readyStatus[request.faction] = request.ready;

    // 记录事件
    this.events.push({
      type: 'READY_STATUS_CHANGED',
      faction: request.faction,
      playerId: request.playerId,
      ready: request.ready,
    });

    return true;
  }

  /**
   * 检查所有阵营是否就绪
   */
  isAllFactionsReady(): boolean {
    const factions = Object.keys(this.state.readyStatus);
    if (factions.length === 0) return false;

    return factions.every(faction => this.state.readyStatus[faction]);
  }

  /**
   * 获取就绪状态
   */
  getReadyStatus(): Record<string, boolean> {
    return { ...this.state.readyStatus };
  }

  // ==================== 状态查询 ====================

  /**
   * 获取部署状态
   */
  getState(): DeploymentState {
    return {
      ...this.state,
      deployedShips: Object.fromEntries(
        Object.entries(this.state.deployedShips).map(([faction, ships]) => [
          faction,
          [...ships],
        ])
      ),
    };
  }

  /**
   * 获取阵营的已部署舰船
   */
  getFactionShips(faction: FactionId): ShipTokenV2[] {
    return [...(this.state.deployedShips[faction] ?? [])];
  }

  /**
   * 获取所有已部署舰船
   */
  getAllShips(): ShipTokenV2[] {
    const allShips: ShipTokenV2[] = [];
    for (const ships of Object.values(this.state.deployedShips)) {
      allShips.push(...ships);
    }
    return allShips;
  }

  /**
   * 获取部署区域
   */
  getDeploymentZone(faction: FactionId): DeploymentZone | undefined {
    return this.deploymentZones.get(faction);
  }

  /**
   * 是否处于部署阶段
   */
  isDeploymentPhase(): boolean {
    return this.state.isDeploymentPhase;
  }

  /**
   * 获取事件历史
   */
  getEvents(): DeploymentEvent[] {
    return [...this.events];
  }

  /**
   * 清除事件历史
   */
  clearEvents(): void {
    this.events.length = 0;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建部署服务实例
 */
export function createDeploymentService(deps: DeploymentServiceDeps): DeploymentService {
  return new DeploymentService(deps);
}