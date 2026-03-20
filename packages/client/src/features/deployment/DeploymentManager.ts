/**
 * 部署管理服务
 *
 * 管理部署阶段的交互逻辑：
 * - 部署区域设置
 * - 舰船放置
 * - 部署验证
 * - 部署确认
 */

import type { Point } from '@vt/shared/core-types';
import type { FactionId } from '@vt/shared/types';
import type { ShipDefinition } from '@vt/shared/config';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

/**
 * 部署区域
 */
export interface DeploymentZone {
  factionId: FactionId;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  color: string;
  label: string;
}

/**
 * 已部署的舰船
 */
export interface DeployedShip {
  id: string;
  shipDefinitionId: string;
  factionId: FactionId;
  ownerId: string;
  position: Point;
  heading: number;
  name?: string;
}

/**
 * 部署状态
 */
export interface DeploymentState {
  phase: 'setup' | 'deploying' | 'confirming' | 'ready';
  zones: DeploymentZone[];
  deployedShips: DeployedShip[];
  readyFactions: Record<FactionId, boolean>;
  deploymentPoints: Record<FactionId, { used: number; max: number }>;
}

/**
 * 部署管理器配置
 */
export interface DeploymentManagerConfig {
  roomId: string;
  playerId: string;
  factionId: FactionId | null;
  isDM: boolean;
  onStateChange?: (state: DeploymentState) => void;
  onDeployComplete?: (ship: DeployedShip) => void;
  onError?: (error: string) => void;
}

/**
 * 部署管理器
 */
export class DeploymentManager {
  private config: DeploymentManagerConfig;
  private state: DeploymentState;

  constructor(config: DeploymentManagerConfig) {
    this.config = config;
    this.state = {
      phase: 'setup',
      zones: [],
      deployedShips: [],
      readyFactions: {},
      deploymentPoints: {},
    };
    this.setupWebSocketHandlers();
  }

  /**
   * 获取当前状态
   */
  getState(): DeploymentState {
    return { ...this.state };
  }

  /**
   * 设置部署区域（DM专用）
   */
  async setDeploymentZone(zone: DeploymentZone): Promise<void> {
    if (!this.config.isDM) {
      throw new Error('只有DM可以设置部署区域');
    }

    try {
      await websocketService.sendRequest('deployment.setZone', {
        roomId: this.config.roomId,
        zone,
      });

      // 更新本地状态
      const existingIndex = this.state.zones.findIndex(z => z.factionId === zone.factionId);
      if (existingIndex >= 0) {
        this.state.zones[existingIndex] = zone;
      } else {
        this.state.zones.push(zone);
      }

      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 部署舰船
   */
  async deployShip(params: {
    shipDefinitionId: string;
    position: Point;
    heading: number;
    name?: string;
  }): Promise<DeployedShip> {
    if (!this.config.factionId) {
      throw new Error('未选择阵营');
    }

    // 验证位置是否在部署区域内
    const zone = this.state.zones.find(z => z.factionId === this.config.factionId);
    if (zone && !this.isPositionInZone(params.position, zone)) {
      throw new Error('舰船必须部署在指定区域内');
    }

    try {
      const result = await websocketService.sendRequest('deployment.deployShip', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
        factionId: this.config.factionId,
        shipDefinitionId: params.shipDefinitionId,
        position: params.position,
        heading: params.heading,
        name: params.name,
      });

      const deployedShip = result as DeployedShip;

      // 更新本地状态
      this.state.deployedShips.push(deployedShip);
      this.config.onDeployComplete?.(deployedShip);
      this.config.onStateChange?.(this.state);

      return deployedShip;
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 移除已部署的舰船
   */
  async removeShip(shipId: string): Promise<void> {
    try {
      await websocketService.sendRequest('deployment.removeShip', {
        roomId: this.config.roomId,
        shipId,
      });

      // 更新本地状态
      this.state.deployedShips = this.state.deployedShips.filter(s => s.id !== shipId);
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 更新舰船位置
   */
  async updateShipPosition(shipId: string, position: Point, heading: number): Promise<void> {
    // 验证位置是否在部署区域内
    const ship = this.state.deployedShips.find(s => s.id === shipId);
    if (!ship) {
      throw new Error('舰船不存在');
    }

    const zone = this.state.zones.find(z => z.factionId === ship.factionId);
    if (zone && !this.isPositionInZone(position, zone)) {
      throw new Error('舰船必须部署在指定区域内');
    }

    try {
      await websocketService.sendRequest('deployment.updateShip', {
        roomId: this.config.roomId,
        shipId,
        position,
        heading,
      });

      // 更新本地状态
      const shipIndex = this.state.deployedShips.findIndex(s => s.id === shipId);
      if (shipIndex >= 0) {
        this.state.deployedShips[shipIndex] = {
          ...this.state.deployedShips[shipIndex],
          position,
          heading,
        };
      }

      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 设置就绪状态
   */
  async setReady(ready: boolean): Promise<void> {
    if (!this.config.factionId) {
      throw new Error('未选择阵营');
    }

    try {
      await websocketService.sendRequest('deployment.setReady', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
        factionId: this.config.factionId,
        ready,
      });

      // 更新本地状态
      this.state.readyFactions[this.config.factionId] = ready;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 确认部署（DM专用）
   */
  async confirmDeployment(): Promise<void> {
    if (!this.config.isDM) {
      throw new Error('只有DM可以确认部署');
    }

    try {
      await websocketService.sendRequest('deployment.confirm', {
        roomId: this.config.roomId,
      });

      this.state.phase = 'ready';
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 检查位置是否在部署区域内
   */
  isPositionInZone(position: Point, zone: DeploymentZone): boolean {
    return (
      position.x >= zone.bounds.minX &&
      position.x <= zone.bounds.maxX &&
      position.y >= zone.bounds.minY &&
      position.y <= zone.bounds.maxY
    );
  }

  /**
   * 获取阵营的部署区域
   */
  getFactionZone(factionId: FactionId): DeploymentZone | undefined {
    return this.state.zones.find(z => z.factionId === factionId);
  }

  /**
   * 获取阵营已部署的舰船
   */
  getFactionShips(factionId: FactionId): DeployedShip[] {
    return this.state.deployedShips.filter(s => s.factionId === factionId);
  }

  /**
   * 检查阵营是否就绪
   */
  isFactionReady(factionId: FactionId): boolean {
    return this.state.readyFactions[factionId] ?? false;
  }

  /**
   * 检查所有阵营是否就绪
   */
  areAllFactionsReady(): boolean {
    const factions = [...new Set(this.state.zones.map(z => z.factionId))];
    return factions.every(f => this.state.readyFactions[f]);
  }

  /**
   * 设置WebSocket处理器
   */
  private setupWebSocketHandlers(): void {
    // 监听部署状态更新
    websocketService.on(WS_MESSAGE_TYPES.DEPLOYMENT_STATE_UPDATE, (payload: unknown) => {
      const data = payload as Partial<DeploymentState>;
      if (data.zones) this.state.zones = data.zones;
      if (data.deployedShips) this.state.deployedShips = data.deployedShips;
      if (data.readyFactions) this.state.readyFactions = data.readyFactions;
      if (data.deploymentPoints) this.state.deploymentPoints = data.deploymentPoints;
      if (data.phase) this.state.phase = data.phase;

      this.config.onStateChange?.(this.state);
    });

    // 监听舰船部署事件
    websocketService.on(WS_MESSAGE_TYPES.SHIP_DEPLOYED, (payload: unknown) => {
      const ship = payload as DeployedShip;
      const existingIndex = this.state.deployedShips.findIndex(s => s.id === ship.id);
      if (existingIndex >= 0) {
        this.state.deployedShips[existingIndex] = ship;
      } else {
        this.state.deployedShips.push(ship);
      }
      this.config.onStateChange?.(this.state);
    });
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    websocketService.off(WS_MESSAGE_TYPES.DEPLOYMENT_STATE_UPDATE, () => {});
    websocketService.off(WS_MESSAGE_TYPES.SHIP_DEPLOYED, () => {});
    this.config.onStateChange = undefined;
    this.config.onDeployComplete = undefined;
    this.config.onError = undefined;
  }
}

export default DeploymentManager;