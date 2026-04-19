/**
 * 舰船数据管理 - 基于 @vt/data 权威设计
 */

import { DataRegistry, type ShipJSON } from "@vt/data";

/** 舰船数据管理器 */
export class ShipDataManager {
  private registry: DataRegistry;

  constructor() {
    this.registry = new DataRegistry();
  }

  /**
   * 加载预设舰船
   */
  async loadPresetShips(): Promise<ShipJSON[]> {
    try {
      // 从 @vt/data 加载预设
      const presetShips = await this.registry.loadPresetShips();
      return presetShips;
    } catch (error) {
      console.error("Failed to load preset ships:", error);
      return [];
    }
  }

  /**
   * 根据ID获取舰船
   */
  getShipById(shipId: string): ShipJSON | null {
    try {
      return this.registry.getShip(shipId);
    } catch (error) {
      console.error(`Failed to get ship ${shipId}:`, error);
      return null;
    }
  }

  /**
   * 验证舰船数据
   */
  validateShip(shipData: any): { valid: boolean; errors?: string[] } {
    try {
      const result = this.registry.validateShip(shipData);
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error}`],
      };
    }
  }

  /**
   * 创建运行时舰船状态
   */
  createRuntimeShip(shipJson: ShipJSON, ownerId?: string): ShipJSON["runtime"] {
    const spec = shipJson.ship;
    
    return {
      position: { x: 0, y: 0 },
      heading: 0,
      hull: spec.maxHitPoints,
      armor: Array(6).fill(spec.armorMaxPerQuadrant || 100),
      fluxSoft: 0,
      fluxHard: 0,
      shield: spec.shield ? { active: false, value: 100 } : undefined,
      overloaded: false,
      destroyed: false,
      movement: {
        hasMoved: false,
        phaseAUsed: 0,
        turnAngleUsed: 0,
        phaseCUsed: 0,
      },
      hasFired: false,
      weapons: spec.mounts?.map(mount => ({
        mountId: mount.id,
        state: "READY",
        cooldownRemaining: 0,
      })),
      faction: "PLAYER",
      ownerId,
    };
  }

  /**
   * 获取所有可用舰船
   */
  getAllShips(): ShipJSON[] {
    try {
      return this.registry.getAllShips();
    } catch (error) {
      console.error("Failed to get all ships:", error);
      return [];
    }
  }

  /**
   * 按类别筛选舰船
   */
  getShipsByClass(shipClass: string): ShipJSON[] {
    return this.getAllShips().filter(
      ship => ship.ship.class === shipClass
    );
  }

  /**
   * 按尺寸筛选舰船
   */
  getShipsBySize(size: string): ShipJSON[] {
    return this.getAllShips().filter(
      ship => ship.ship.size === size
    );
  }
}

// 导出单例实例
export const shipDataManager = new ShipDataManager();