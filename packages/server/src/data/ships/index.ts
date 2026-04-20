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
  loadPresetShips(): ShipJSON[] {
    try {
      return this.registry.getPresetShips();
    } catch (error) {
      console.error("Failed to load preset ships:", error);
      return [];
    }
  }

  /**
   * 根据ID获取舰船
   */
  getShipById(shipId: string): ShipJSON | undefined {
    try {
      return this.registry.getShipJSON(shipId);
    } catch (error) {
      console.error(`Failed to get ship ${shipId}:`, error);
      return undefined;
    }
  }

  /**
   * 验证舰船数据
   */
  validateShip(shipData: unknown): { valid: boolean; errors?: string[] } {
    if (!shipData || typeof shipData !== "object") {
      return { valid: false, errors: ["Invalid ship data"] };
    }
    const ship = shipData as ShipJSON;
    if (!ship.$id || !ship.ship) {
      return { valid: false, errors: ["Missing required fields: $id, ship"] };
    }
    return { valid: true };
  }

  /**
   * 创建运行时舰船状态
   */
  createRuntimeShip(shipJson: ShipJSON, ownerId?: string): ShipJSON["runtime"] {
    const spec = shipJson.ship;
    const weapons = spec.mounts?.map(mount => ({
      mountId: mount.id,
      state: "READY" as const,
      cooldownRemaining: 0,
    }));

    const runtime: ShipJSON["runtime"] = {
      position: { x: 0, y: 0 },
      heading: 0,
      hull: spec.maxHitPoints,
      armor: Array(6).fill(spec.armorMaxPerQuadrant || 100),
      fluxSoft: 0,
      fluxHard: 0,
      overloaded: false,
      overloadTime: 0,
      destroyed: false,
      movement: {
        hasMoved: false,
        phaseAUsed: 0,
        turnAngleUsed: 0,
        phaseCUsed: 0,
      },
      hasFired: false,
      faction: "PLAYER",
      ...(ownerId !== undefined ? { ownerId } : {}),
      ...(spec.shield ? { shield: { active: false, value: spec.shield.radius } } : {}),
      ...(weapons ? { weapons } : {}),
    };
    return runtime;
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