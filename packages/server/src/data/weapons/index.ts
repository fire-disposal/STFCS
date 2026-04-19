/**
 * 武器数据管理 - 基于 @vt/data 权威设计
 */

import { DataRegistry, type WeaponJSON } from "@vt/data";

/** 武器数据管理器 */
export class WeaponDataManager {
  private registry: DataRegistry;

  constructor() {
    this.registry = new DataRegistry();
  }

  /**
   * 加载预设武器
   */
  async loadPresetWeapons(): Promise<WeaponJSON[]> {
    try {
      const presetWeapons = await this.registry.loadPresetWeapons();
      return presetWeapons;
    } catch (error) {
      console.error("Failed to load preset weapons:", error);
      return [];
    }
  }

  /**
   * 根据ID获取武器
   */
  getWeaponById(weaponId: string): WeaponJSON | null {
    try {
      return this.registry.getWeapon(weaponId);
    } catch (error) {
      console.error(`Failed to get weapon ${weaponId}:`, error);
      return null;
    }
  }

  /**
   * 验证武器数据
   */
  validateWeapon(weaponData: any): { valid: boolean; errors?: string[] } {
    try {
      const result = this.registry.validateWeapon(weaponData);
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error}`],
      };
    }
  }

  /**
   * 创建运行时武器状态
   */
  createRuntimeWeapon(weaponJson: WeaponJSON, mountId: string): WeaponJSON["runtime"] {
    return {
      mountId,
      state: "READY",
      cooldownRemaining: 0,
      statusEffects: [],
    };
  }

  /**
   * 获取所有可用武器
   */
  getAllWeapons(): WeaponJSON[] {
    try {
      return this.registry.getAllWeapons();
    } catch (error) {
      console.error("Failed to get all weapons:", error);
      return [];
    }
  }

  /**
   * 按类别筛选武器
   */
  getWeaponsByCategory(category: string): WeaponJSON[] {
    return this.getAllWeapons().filter(
      weapon => weapon.weapon.category === category
    );
  }

  /**
   * 按尺寸筛选武器
   */
  getWeaponsBySize(size: string): WeaponJSON[] {
    return this.getAllWeapons().filter(
      weapon => weapon.weapon.size === size
    );
  }

  /**
   * 按伤害类型筛选武器
   */
  getWeaponsByDamageType(damageType: string): WeaponJSON[] {
    return this.getAllWeapons().filter(
      weapon => weapon.weapon.damageType === damageType
    );
  }

  /**
   * 检查武器兼容性
   */
  checkWeaponCompatibility(weaponId: string, mountSize: string): boolean {
    const weapon = this.getWeaponById(weaponId);
    if (!weapon) return false;

    const weaponSize = weapon.weapon.size;
    
    // 尺寸兼容性规则
    const sizeHierarchy = {
      "SMALL": ["SMALL"],
      "MEDIUM": ["SMALL", "MEDIUM"],
      "LARGE": ["SMALL", "MEDIUM", "LARGE"],
    };

    const compatibleSizes = sizeHierarchy[mountSize as keyof typeof sizeHierarchy] || [];
    return compatibleSizes.includes(weaponSize);
  }

  /**
   * 计算武器属性
   */
  calculateWeaponStats(weaponId: string): {
    dps: number;
    fluxPerSecond: number;
    effectiveRange: number;
  } {
    const weapon = this.getWeaponById(weaponId);
    if (!weapon) {
      return { dps: 0, fluxPerSecond: 0, effectiveRange: 0 };
    }

    const spec = weapon.weapon;
    const cooldown = spec.cooldown || 1;
    const burstCount = spec.burstCount || 1;
    const projectiles = spec.projectilesPerShot || 1;

    const dps = (spec.damage * projectiles * burstCount) / cooldown;
    const fluxPerSecond = spec.fluxCostPerShot / cooldown;
    const effectiveRange = spec.range * (spec.rangeModifier || 1.0);

    return { dps, fluxPerSecond, effectiveRange };
  }
}

// 导出单例实例
export const weaponDataManager = new WeaponDataManager();