/**
 * 武器系统数据模型
 * 
 * 定义完整的武器规格、挂载点和射击规则
 */

/**
 * 武器伤害类型
 */
export type WeaponDamageType = "kinetic" | "high_explosive" | "energy" | "fragmentation";

/**
 * 武器类型分类
 */
export type WeaponCategory = "ballistic" | "energy" | "missile" | "synergy";

/**
 * 武器挂载类型
 */
export type WeaponMountType = "fixed" | "turret" | "hidden";

/**
 * 武器规格定义 - 从 JSON 导入的静态数据
 */
export interface WeaponSpec {
  id: string;
  name: string;
  description: string;
  category: WeaponCategory;
  damageType: WeaponDamageType;
  mountType: WeaponMountType;
  damage: number;
  range: number;
  arc: number;
  cooldown: number;
  fluxCost: number;
  ammo: number;
  reloadTime: number;
  isBallistic: boolean;
  isEnergy: boolean;
  isMissile: boolean;
  ignoresShields: boolean;
}

/**
 * 武器规格数据接口 (用于预设数据)
 */
export interface WeaponSpecData {
  id: string;
  name: string;
  description: string;
  category: WeaponCategory;
  damageType: WeaponDamageType;
  mountType: WeaponMountType;
  damage: number;
  range: number;
  arc: number;
  cooldown: number;
  fluxCost: number;
  ammo: number;
  reloadTime: number;
  isBallistic: boolean;
  isEnergy: boolean;
  isMissile: boolean;
  ignoresShields: boolean;
}

/**
 * 武器挂载点 - 舰船上的武器安装位置
 */
export interface WeaponMount {
  id: string;
  mountType: WeaponMountType;
  offsetX: number;
  offsetY: number;
  facing: number;
  arcMin: number;
  arcMax: number;
  weaponId: string;
  currentAmmo: number;
  cooldownRemaining: number;
}

/**
 * 射击指令
 */
export interface FireCommand {
  sourceShipId: string;
  targetShipId: string;
  weaponMountId: string;
  timestamp: number;
}

/**
 * 射击结果
 */
export interface FireResult {
  hit: boolean;
  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  hitQuadrant: number;
  softFluxGenerated: number;
  hardFluxGenerated: number;
  sourceShipId: string;
  targetShipId: string;
  weaponId: string;
  timestamp: number;
}

/**
 * 伤害类型倍率配置
 */
export const DAMAGE_MULTIPLIERS: Record<WeaponDamageType, { 
  shield: number; 
  armor: number; 
  hull: number;
  description: string;
}> = {
  kinetic: { 
    shield: 0.5, 
    armor: 2.0, 
    hull: 1.0,
    description: "动能武器 - 对装甲有效，被护盾削弱"
  },
  high_explosive: { 
    shield: 0.5, 
    armor: 0.5, 
    hull: 1.0,
    description: "高爆武器 - 对护盾和装甲都有削弱"
  },
  energy: { 
    shield: 1.0, 
    armor: 1.0, 
    hull: 1.0,
    description: "能量武器 - 无特殊倍率，稳定输出"
  },
  fragmentation: { 
    shield: 0.25, 
    armor: 0.25, 
    hull: 0.25,
    description: "破片武器 - 对所有防御都有削弱"
  },
};

/**
 * 预设武器库
 */
export const PRESET_WEAPONS: Record<string, WeaponSpecData> = {
  // 动能武器
  "autocannon": {
    id: "autocannon",
    name: "自动加农炮",
    description: "标准动能自动武器，平衡的性能",
    category: "ballistic",
    damageType: "kinetic",
    mountType: "turret",
    damage: 25,
    range: 250,
    arc: 360,
    cooldown: 1.5,
    fluxCost: 8,
    ammo: 0,
    reloadTime: 0,
    isBallistic: true,
    isEnergy: false,
    isMissile: false,
    ignoresShields: false,
  },
  "heavy_cannon": {
    id: "heavy_cannon",
    name: "重型加农炮",
    description: "高伤害动能武器，射速较慢",
    category: "ballistic",
    damageType: "kinetic",
    mountType: "turret",
    damage: 50,
    range: 300,
    arc: 180,
    cooldown: 3,
    fluxCost: 15,
    ammo: 0,
    reloadTime: 0,
    isBallistic: true,
    isEnergy: false,
    isMissile: false,
    ignoresShields: false,
  },
  "railgun": {
    id: "railgun",
    name: "电磁轨道炮",
    description: "超远射程动能武器，需要充能时间",
    category: "ballistic",
    damageType: "kinetic",
    mountType: "fixed",
    damage: 80,
    range: 500,
    arc: 60,
    cooldown: 5,
    fluxCost: 25,
    ammo: 0,
    reloadTime: 0,
    isBallistic: true,
    isEnergy: false,
    isMissile: false,
    ignoresShields: false,
  },
  
  // 能量武器
  "pulse_laser": {
    id: "pulse_laser",
    name: "脉冲激光",
    description: "标准能量武器，快速连射",
    category: "energy",
    damageType: "energy",
    mountType: "turret",
    damage: 15,
    range: 200,
    arc: 360,
    cooldown: 1,
    fluxCost: 6,
    ammo: 0,
    reloadTime: 0,
    isBallistic: false,
    isEnergy: true,
    isMissile: false,
    ignoresShields: false,
  },
  "beam_laser": {
    id: "beam_laser",
    name: "聚焦光束",
    description: "持续能量伤害，需要锁定目标",
    category: "energy",
    damageType: "energy",
    mountType: "fixed",
    damage: 40,
    range: 150,
    arc: 90,
    cooldown: 4,
    fluxCost: 20,
    ammo: 0,
    reloadTime: 0,
    isBallistic: false,
    isEnergy: true,
    isMissile: false,
    ignoresShields: false,
  },
  "plasma_cannon": {
    id: "plasma_cannon",
    name: "等离子炮",
    description: "高伤害能量武器，产生大量软辐能",
    category: "energy",
    damageType: "energy",
    mountType: "turret",
    damage: 60,
    range: 250,
    arc: 180,
    cooldown: 4,
    fluxCost: 30,
    ammo: 0,
    reloadTime: 0,
    isBallistic: false,
    isEnergy: true,
    isMissile: false,
    ignoresShields: false,
  },
  
  // 导弹武器
  "assault_missile": {
    id: "assault_missile",
    name: "突击导弹",
    description: "快速导弹，追踪目标",
    category: "missile",
    damageType: "high_explosive",
    mountType: "fixed",
    damage: 45,
    range: 400,
    arc: 120,
    cooldown: 4,
    fluxCost: 10,
    ammo: 8,
    reloadTime: 10,
    isBallistic: false,
    isEnergy: false,
    isMissile: true,
    ignoresShields: false,
  },
  "harpoon_missile": {
    id: "harpoon_missile",
    name: "鱼叉导弹",
    description: "重型导弹，高伤害但速度慢",
    category: "missile",
    damageType: "high_explosive",
    mountType: "fixed",
    damage: 100,
    range: 500,
    arc: 90,
    cooldown: 8,
    fluxCost: 20,
    ammo: 4,
    reloadTime: 15,
    isBallistic: false,
    isEnergy: false,
    isMissile: true,
    ignoresShields: false,
  },
  
  // 特殊武器
  "flak_cannon": {
    id: "flak_cannon",
    name: "高射炮",
    description: "区域防御武器，对导弹有效",
    category: "ballistic",
    damageType: "fragmentation",
    mountType: "turret",
    damage: 10,
    range: 150,
    arc: 360,
    cooldown: 0.5,
    fluxCost: 3,
    ammo: 0,
    reloadTime: 0,
    isBallistic: true,
    isEnergy: false,
    isMissile: false,
    ignoresShields: false,
  },
  "phase_charge": {
    id: "phase_charge",
    name: "相位电荷",
    description: "实验性武器，无视护盾",
    category: "synergy",
    damageType: "energy",
    mountType: "fixed",
    damage: 35,
    range: 200,
    arc: 60,
    cooldown: 6,
    fluxCost: 25,
    ammo: 0,
    reloadTime: 0,
    isBallistic: false,
    isEnergy: true,
    isMissile: false,
    ignoresShields: true,
  },
};

function toWeaponSpec(preset: WeaponSpecData): WeaponSpec {
  return { ...preset };
}

/**
 * 获取武器规格
 */
export function getWeaponSpec(weaponId: string): WeaponSpec | undefined {
  const preset = PRESET_WEAPONS[weaponId];
  if (!preset) return undefined;

  return toWeaponSpec(preset);
}

/**
 * 获取所有可用武器列表
 */
export function getAvailableWeapons(): WeaponSpec[] {
  return Object.values(PRESET_WEAPONS).map(toWeaponSpec);
}
