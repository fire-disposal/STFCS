/**
 * 武器数据管理 - 基于 @vt/data 权威设计
 */

import { type WeaponJSON } from "@vt/data";
import { DataRegistry } from "../DataRegistry.js";

/** 武器数据管理器 */
export class WeaponDataManager {
  private registry: DataRegistry;

  constructor() {
    this.registry = new DataRegistry();
  }

  /**
   * 加载预设武器
   */
  loadPresetWeapons(): WeaponJSON[] {
    try {
      return this.registry.getAllWeapons().filter(w => w.$id.startsWith("preset:"));
    } catch (error) {
      console.error("Failed to load preset weapons:", error);
      return [];
    }
  }

  /**
   * 根据ID获取武器
   */
  getWeaponById(weaponId: string): WeaponJSON | undefined {
    try {
      return this.registry.getWeaponJSON(weaponId);
    } catch (error) {
      console.error(`Failed to get weapon ${weaponId}:`, error);
      return undefined;
    }
  }

  /**
   * 验证武器数据
   */
  validateWeapon(weaponData: unknown): { valid: boolean; errors?: string[] } {
    if (!weaponData || typeof weaponData !== "object") {
      return { valid: false, errors: ["Invalid weapon data"] };
    }
    const weapon = weaponData as WeaponJSON;
    if (!weapon.$id || !weapon.weapon) {
      return { valid: false, errors: ["Missing required fields: $id, weapon"] };
    }
    return { valid: true };
  }

  /**
   * 创建运行时武器状态
   */
  createRuntimeWeapon(_weaponJson: WeaponJSON, mountId: string): WeaponJSON["runtime"] {
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
    const effectiveRange = spec.range;

    return { dps, fluxPerSecond, effectiveRange };
  }
}

// 导出单例实例
export const weaponDataManager = new WeaponDataManager();