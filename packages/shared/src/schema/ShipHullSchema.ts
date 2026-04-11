/**
 * 舰船数据导入系统
 * 
 * 支持从 JSON 文件导入舰船规格，创建预设舰船库
 */

import type { WeaponMountType } from './WeaponSchema.js';

/**
 * 舰船尺寸类型
 */
export type ShipSize = 'fighter' | 'frigate' | 'destroyer' | 'cruiser' | 'capital';

/**
 * 舰船类型分类
 */
export type ShipClass = 'strike' | 'support' | 'line' | 'carrier' | 'battleship';

/**
 * 武器挂载点定义 (JSON 格式)
 */
export interface WeaponMountDef {
  id: string;
  mountType: WeaponMountType;
  offsetX: number;
  offsetY: number;
  facing: number;
  arcMin: number;
  arcMax: number;
  defaultWeapon?: string;
}

/**
 * 舰船规格定义 (JSON 格式)
 */
export interface ShipHullSpec {
  // 基础信息
  id: string;
  name: string;
  description?: string;
  size: ShipSize;
  class: ShipClass;
  faction?: string;
  
  // 外观
  width: number;      // 宽度 (单位)
  length: number;     // 长度 (单位)
  spritePath?: string; // 贴图路径
  
  // 基础属性
  hullPoints: number;     // 船体值
  armorValue: number;     // 基础装甲值
  armorDistribution?: number[]; // 6 象限装甲分布比例 (默认均匀)
  
  // 护盾系统
  hasShield: boolean;
  shieldType?: 'front' | 'full';
  shieldRadius?: number;
  shieldCenterOffset?: { x: number; y: number };
  shieldArc?: number;
  shieldEfficiency?: number;
  shieldMaintenanceCost?: number;
  
  // 辐能系统
  fluxCapacity: number;
  fluxDissipation: number;
  
  // 机动性能
  maxSpeed: number;       // 最大速度 (X)
  maxTurnRate: number;    // 最大转向率 (Y)
  acceleration: number;   // 加速度
  
  // 武器系统
  weaponMounts: WeaponMountDef[];
  
  // 特殊能力
  tags?: string[];
}

/**
 * 预设舰船库
 */
export const PRESET_SHIPS: Record<string, ShipHullSpec> = {
  // 护卫舰级别
  'frigate_assault': {
    id: 'frigate_assault',
    name: '突击护卫舰',
    description: '轻型护卫舰，适合侦查和骚扰',
    size: 'frigate',
    class: 'strike',
    width: 20,
    length: 40,
    hullPoints: 800,
    armorValue: 100,
    armorDistribution: [120, 100, 80, 80, 80, 100],
    hasShield: true,
    shieldType: 'front',
    shieldRadius: 35,
    shieldArc: 120,
    shieldEfficiency: 0.6,
    shieldMaintenanceCost: 3,
    fluxCapacity: 150,
    fluxDissipation: 12,
    maxSpeed: 120,
    maxTurnRate: 60,
    acceleration: 60,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'fixed',
        offsetX: 0,
        offsetY: -15,
        facing: 0,
        arcMin: -30,
        arcMax: 30,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_left_1',
        mountType: 'turret',
        offsetX: -12,
        offsetY: 5,
        facing: -45,
        arcMin: -90,
        arcMax: 0,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_right_1',
        mountType: 'turret',
        offsetX: 12,
        offsetY: 5,
        facing: 45,
        arcMin: 0,
        arcMax: 90,
        defaultWeapon: 'pulse_laser',
      },
    ],
    tags: ['fast', 'scout'],
  },
  
  'frigate_destroyer': {
    id: 'frigate_destroyer',
    name: '驱逐护卫舰',
    description: '火力较强的护卫舰，适合前线作战',
    size: 'frigate',
    class: 'line',
    width: 24,
    length: 45,
    hullPoints: 1000,
    armorValue: 120,
    armorDistribution: [150, 120, 90, 90, 90, 120],
    hasShield: true,
    shieldType: 'front',
    shieldRadius: 40,
    shieldArc: 140,
    shieldEfficiency: 0.5,
    shieldMaintenanceCost: 5,
    fluxCapacity: 180,
    fluxDissipation: 15,
    maxSpeed: 100,
    maxTurnRate: 45,
    acceleration: 50,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'fixed',
        offsetX: 0,
        offsetY: -18,
        facing: 0,
        arcMin: -20,
        arcMax: 20,
        defaultWeapon: 'railgun',
      },
      {
        id: 'mount_front_2',
        mountType: 'turret',
        offsetX: 0,
        offsetY: -8,
        facing: 0,
        arcMin: -60,
        arcMax: 60,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_left_1',
        mountType: 'turret',
        offsetX: -14,
        offsetY: 8,
        facing: -60,
        arcMin: -120,
        arcMax: -30,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_right_1',
        mountType: 'turret',
        offsetX: 14,
        offsetY: 8,
        facing: 60,
        arcMin: 30,
        arcMax: 120,
        defaultWeapon: 'pulse_laser',
      },
    ],
    tags: ['balanced'],
  },
  
  // 巡洋舰级别
  'cruiser_heavy': {
    id: 'cruiser_heavy',
    name: '重型巡洋舰',
    description: '主力战舰，均衡的火力和防御',
    size: 'cruiser',
    class: 'line',
    width: 35,
    length: 70,
    hullPoints: 1800,
    armorValue: 180,
    armorDistribution: [220, 180, 140, 140, 140, 180],
    hasShield: true,
    shieldType: 'full',
    shieldRadius: 60,
    shieldArc: 360,
    shieldEfficiency: 0.4,
    shieldMaintenanceCost: 8,
    fluxCapacity: 280,
    fluxDissipation: 20,
    maxSpeed: 70,
    maxTurnRate: 30,
    acceleration: 35,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'fixed',
        offsetX: 0,
        offsetY: -28,
        facing: 0,
        arcMin: -15,
        arcMax: 15,
        defaultWeapon: 'heavy_cannon',
      },
      {
        id: 'mount_front_2',
        mountType: 'turret',
        offsetX: -10,
        offsetY: -20,
        facing: -15,
        arcMin: -60,
        arcMax: 30,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_front_3',
        mountType: 'turret',
        offsetX: 10,
        offsetY: -20,
        facing: 15,
        arcMin: -30,
        arcMax: 60,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_left_1',
        mountType: 'turret',
        offsetX: -20,
        offsetY: 0,
        facing: -90,
        arcMin: -150,
        arcMax: -30,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_right_1',
        mountType: 'turret',
        offsetX: 20,
        offsetY: 0,
        facing: 90,
        arcMin: 30,
        arcMax: 150,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_back_1',
        mountType: 'turret',
        offsetX: 0,
        offsetY: 25,
        facing: 180,
        arcMin: 120,
        arcMax: 240,
        defaultWeapon: 'flak_cannon',
      },
    ],
    tags: ['capital', 'balanced'],
  },
  
  'cruiser_carrier': {
    id: 'cruiser_carrier',
    name: '轻型航母',
    description: '搭载战机的支援舰',
    size: 'cruiser',
    class: 'carrier',
    width: 40,
    length: 75,
    hullPoints: 1500,
    armorValue: 150,
    armorDistribution: [180, 150, 120, 120, 120, 150],
    hasShield: true,
    shieldType: 'front',
    shieldRadius: 55,
    shieldArc: 160,
    shieldEfficiency: 0.5,
    shieldMaintenanceCost: 7,
    fluxCapacity: 250,
    fluxDissipation: 18,
    maxSpeed: 65,
    maxTurnRate: 25,
    acceleration: 30,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'turret',
        offsetX: -12,
        offsetY: -25,
        facing: -10,
        arcMin: -60,
        arcMax: 30,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_front_2',
        mountType: 'turret',
        offsetX: 12,
        offsetY: -25,
        facing: 10,
        arcMin: -30,
        arcMax: 60,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_left_1',
        mountType: 'turret',
        offsetX: -22,
        offsetY: 5,
        facing: -90,
        arcMin: -150,
        arcMax: -30,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_right_1',
        mountType: 'turret',
        offsetX: 22,
        offsetY: 5,
        facing: 90,
        arcMin: 30,
        arcMax: 150,
        defaultWeapon: 'pulse_laser',
      },
    ],
    tags: ['carrier', 'support'],
  },
  
  // 主力舰级别
  'capital_battleship': {
    id: 'capital_battleship',
    name: '战列舰',
    description: '重型主力舰，强大的火力和装甲',
    size: 'capital',
    class: 'battleship',
    width: 50,
    length: 100,
    hullPoints: 3000,
    armorValue: 250,
    armorDistribution: [320, 260, 200, 200, 200, 260],
    hasShield: true,
    shieldType: 'full',
    shieldRadius: 80,
    shieldArc: 360,
    shieldEfficiency: 0.35,
    shieldMaintenanceCost: 12,
    fluxCapacity: 400,
    fluxDissipation: 28,
    maxSpeed: 50,
    maxTurnRate: 20,
    acceleration: 25,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'fixed',
        offsetX: 0,
        offsetY: -40,
        facing: 0,
        arcMin: -10,
        arcMax: 10,
        defaultWeapon: 'railgun',
      },
      {
        id: 'mount_front_2',
        mountType: 'fixed',
        offsetX: -15,
        offsetY: -35,
        facing: -5,
        arcMin: -20,
        arcMax: 20,
        defaultWeapon: 'heavy_cannon',
      },
      {
        id: 'mount_front_3',
        mountType: 'fixed',
        offsetX: 15,
        offsetY: -35,
        facing: 5,
        arcMin: -20,
        arcMax: 20,
        defaultWeapon: 'heavy_cannon',
      },
      {
        id: 'mount_left_front_1',
        mountType: 'turret',
        offsetX: -25,
        offsetY: -15,
        facing: -45,
        arcMin: -100,
        arcMax: 10,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_right_front_1',
        mountType: 'turret',
        offsetX: 25,
        offsetY: -15,
        facing: 45,
        arcMin: -10,
        arcMax: 100,
        defaultWeapon: 'autocannon',
      },
      {
        id: 'mount_left_back_1',
        mountType: 'turret',
        offsetX: -25,
        offsetY: 20,
        facing: -120,
        arcMin: -180,
        arcMax: -60,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_right_back_1',
        mountType: 'turret',
        offsetX: 25,
        offsetY: 20,
        facing: 120,
        arcMin: 60,
        arcMax: 180,
        defaultWeapon: 'pulse_laser',
      },
      {
        id: 'mount_back_1',
        mountType: 'turret',
        offsetX: 0,
        offsetY: 40,
        facing: 180,
        arcMin: 120,
        arcMax: 240,
        defaultWeapon: 'flak_cannon',
      },
    ],
    tags: ['capital', 'heavy'],
  },
  
  // 战斗机级别
  'fighter_scout': {
    id: 'fighter_scout',
    name: '侦查机',
    description: '小型快速单位，用于侦查',
    size: 'fighter',
    class: 'strike',
    width: 8,
    length: 12,
    hullPoints: 150,
    armorValue: 30,
    armorDistribution: [40, 30, 20, 20, 20, 30],
    hasShield: false,
    fluxCapacity: 40,
    fluxDissipation: 8,
    maxSpeed: 200,
    maxTurnRate: 90,
    acceleration: 100,
    weaponMounts: [
      {
        id: 'mount_front_1',
        mountType: 'fixed',
        offsetX: 0,
        offsetY: -4,
        facing: 0,
        arcMin: -15,
        arcMax: 15,
        defaultWeapon: 'pulse_laser',
      },
    ],
    tags: ['fighter', 'fast', 'scout'],
  },
};

/**
 * 获取舰船规格
 */
export function getShipHullSpec(shipId: string): ShipHullSpec | undefined {
  return PRESET_SHIPS[shipId];
}

/**
 * 获取所有可用舰船列表
 */
export function getAvailableShips(): ShipHullSpec[] {
  return Object.values(PRESET_SHIPS);
}

/**
 * 从 JSON 导入舰船规格
 */
export function importShipHullFromJson(jsonData: string): ShipHullSpec | Error {
  try {
    const data = JSON.parse(jsonData);
    
    // 基础验证
    if (!data.id || typeof data.id !== 'string') {
      return new Error('缺少有效的舰船 ID');
    }
    if (!data.name || typeof data.name !== 'string') {
      return new Error('缺少有效的舰船名称');
    }
    if (!['fighter', 'frigate', 'destroyer', 'cruiser', 'capital'].includes(data.size)) {
      return new Error(`无效的舰船尺寸：${data.size}`);
    }
    
    // 验证武器挂载点
    if (!Array.isArray(data.weaponMounts)) {
      return new Error('缺少武器挂载点定义');
    }
    
    return data as ShipHullSpec;
  } catch (e) {
    return new Error(`JSON 解析失败：${e instanceof Error ? e.message : '未知错误'}`);
  }
}

/**
 * 导出舰船规格为 JSON
 */
export function exportShipHullToJson(spec: ShipHullSpec): string {
  return JSON.stringify(spec, null, 2);
}
