/**
 * 组件数据管理 - 基于 @vt/data 权威设计
 */

import type { ShipJSON } from "@vt/data";

/** 组件类型 */
export type ComponentType = 
  | "ENGINE"
  | "SHIELD_GENERATOR"
  | "FLUX_CAPACITOR"
  | "WEAPON_CONTROL"
  | "SENSOR_ARRAY"
  | "COMMUNICATIONS"
  | "DEFENSE_MATRIX";

/** 组件规格 */
export interface ComponentSpec {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  stats: Record<string, number>;
  requirements?: {
    shipSize?: string[];
    shipClass?: string[];
    power?: number;
    slots?: number;
  };
  effects?: {
    modifiers?: Record<string, number>;
    abilities?: string[];
    restrictions?: string[];
  };
}

/** 组件运行时状态 */
export interface ComponentRuntime {
  componentId: string;
  active: boolean;
  health: number;
  cooldown?: number;
  statusEffects?: string[];
}

/** 组件数据管理器 */
export class ComponentDataManager {
  private components: Map<string, ComponentSpec> = new Map();

  constructor() {
    this.initializeDefaultComponents();
  }

  /**
   * 初始化默认组件
   */
  private initializeDefaultComponents(): void {
    // 引擎组件
    this.addComponent({
      id: "engine_basic",
      name: "基础推进器",
      type: "ENGINE",
      description: "标准舰船推进系统",
      stats: {
        speedBonus: 0.1,
        turnRateBonus: 0.1,
        powerConsumption: 5,
      },
      requirements: {
        power: 10,
      },
    });

    // 护盾发生器
    this.addComponent({
      id: "shield_basic",
      name: "基础护盾发生器",
      type: "SHIELD_GENERATOR",
      description: "标准能量护盾系统",
      stats: {
        shieldStrength: 100,
        shieldEfficiency: 0.9,
        rechargeRate: 10,
        powerConsumption: 15,
      },
      requirements: {
        shipSize: ["DESTROYER", "CRUISER", "CAPITAL"],
        power: 20,
      },
    });

    // 辐能电容器
    this.addComponent({
      id: "flux_capacitor_basic",
      name: "基础辐能电容器",
      type: "FLUX_CAPACITOR",
      description: "能量存储和调节系统",
      stats: {
        capacityBonus: 0.2,
        dissipationBonus: 0.15,
        overloadRecovery: 0.1,
        powerConsumption: 8,
      },
    });

    // 武器控制系统
    this.addComponent({
      id: "weapon_control_basic",
      name: "基础火控系统",
      type: "WEAPON_CONTROL",
      description: "武器瞄准和控制系统",
      stats: {
        accuracyBonus: 0.05,
        rangeBonus: 0.1,
        cooldownReduction: 0.05,
        powerConsumption: 12,
      },
    });

    // 传感器阵列
    this.addComponent({
      id: "sensor_basic",
      name: "基础传感器阵列",
      type: "SENSOR_ARRAY",
      description: "目标探测和追踪系统",
      stats: {
        detectionRange: 500,
        trackingAccuracy: 0.8,
        lockOnTime: 2.0,
        powerConsumption: 6,
      },
    });
  }

  /**
   * 添加组件
   */
  addComponent(component: ComponentSpec): void {
    this.components.set(component.id, component);
  }

  /**
   * 根据ID获取组件
   */
  getComponentById(componentId: string): ComponentSpec | null {
    return this.components.get(componentId) || null;
  }

  /**
   * 获取所有组件
   */
  getAllComponents(): ComponentSpec[] {
    return Array.from(this.components.values());
  }

  /**
   * 按类型筛选组件
   */
  getComponentsByType(type: ComponentType): ComponentSpec[] {
    return this.getAllComponents().filter(
      component => component.type === type
    );
  }

  /**
   * 检查组件兼容性
   */
  checkComponentCompatibility(componentId: string, shipJson: ShipJSON): boolean {
    const component = this.getComponentById(componentId);
    if (!component) return false;

    const requirements = component.requirements;
    if (!requirements) return true;

    // 检查舰船尺寸
    if (requirements.shipSize && !requirements.shipSize.includes(shipJson.ship.size)) {
      return false;
    }

    // 检查舰船类别
    if (requirements.shipClass && !requirements.shipClass.includes(shipJson.ship.class)) {
      return false;
    }

    // 检查电力需求
    if (requirements.power) {
      // 简化：假设舰船有基础电力系统
      const availablePower = shipJson.ship.fluxCapacity || 100;
      if (requirements.power > availablePower * 0.3) {
        return false;
      }
    }

    return true;
  }

  /**
   * 创建运行时组件状态
   */
  createRuntimeComponent(componentId: string): ComponentRuntime {
    return {
      componentId,
      active: true,
      health: 100,
      cooldown: 0,
      statusEffects: [],
    };
  }

  /**
   * 计算组件效果
   */
  calculateComponentEffects(componentIds: string[]): Record<string, number> {
    const effects: Record<string, number> = {};

    for (const componentId of componentIds) {
      const component = this.getComponentById(componentId);
      if (!component || !component.effects?.modifiers) continue;

      for (const [key, value] of Object.entries(component.effects.modifiers)) {
        effects[key] = (effects[key] || 0) + value;
      }
    }

    return effects;
  }

  /**
   * 验证组件数据
   */
  validateComponent(componentData: any): { valid: boolean; errors?: string[] | undefined } {
    const errors: string[] = [];

    // 检查必需字段
    if (!componentData.id) errors.push("Missing component ID");
    if (!componentData.name) errors.push("Missing component name");
    if (!componentData.type) errors.push("Missing component type");
    if (!componentData.stats) errors.push("Missing component stats");

    // 检查类型有效性
    const validTypes: ComponentType[] = [
      "ENGINE", "SHIELD_GENERATOR", "FLUX_CAPACITOR", 
      "WEAPON_CONTROL", "SENSOR_ARRAY", "COMMUNICATIONS", "DEFENSE_MATRIX"
    ];
    if (componentData.type && !validTypes.includes(componentData.type)) {
      errors.push(`Invalid component type: ${componentData.type}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// 导出单例实例
export const componentDataManager = new ComponentDataManager();