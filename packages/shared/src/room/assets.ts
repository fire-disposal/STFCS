/**
 * 素材库配置
 *
 * 定义所有可拖拽放置的素材模板
 */

import type { AssetLibrary, AssetTemplate } from './types.js';
import type { FactionId } from '../types/index.js';

// ==================== 舰船模板 ====================

/** 玩家舰船模板 */
const PLAYER_SHIP_TEMPLATES: AssetTemplate[] = [
  {
    id: 'frigate_hegemony',
    name: '霸主护卫舰',
    type: 'ship',
    category: 'ship',
    faction: 'hegemony',
    isEnemy: false,
    config: { hull: 80, armor: 70, shield: 50, flux: 80, speed: 60, turnRate: 40, size: 40 },
    icon: '🚀',
    description: '快速、重装甲的护卫舰',
  },
  {
    id: 'destroyer_hegemony',
    name: '霸主驱逐舰',
    type: 'ship',
    category: 'ship',
    faction: 'hegemony',
    isEnemy: false,
    config: { hull: 120, armor: 120, shield: 80, flux: 100, speed: 50, turnRate: 30, size: 50 },
    icon: '🚀',
    description: '平衡型驱逐舰',
  },
  {
    id: 'cruiser_hegemony',
    name: '霸主巡洋舰',
    type: 'ship',
    category: 'ship',
    faction: 'hegemony',
    isEnemy: false,
    config: { hull: 180, armor: 180, shield: 100, flux: 120, speed: 40, turnRate: 20, size: 70 },
    icon: '🚀',
    description: '重型巡洋舰',
  },
  {
    id: 'frigate_tritachyon',
    name: '三叠纪护卫舰',
    type: 'ship',
    category: 'ship',
    faction: 'tri_tachyon',
    isEnemy: false,
    config: { hull: 60, armor: 40, shield: 100, flux: 120, speed: 70, turnRate: 50, size: 35 },
    icon: '🚀',
    description: '高科技护卫舰，强力护盾',
  },
  {
    id: 'destroyer_tritachyon',
    name: '三叠纪驱逐舰',
    type: 'ship',
    category: 'ship',
    faction: 'tri_tachyon',
    isEnemy: false,
    config: { hull: 80, armor: 60, shield: 150, flux: 150, speed: 55, turnRate: 35, size: 45 },
    icon: '🚀',
    description: '能量武器优势',
  },
  {
    id: 'frigate_pirate',
    name: '海盗护卫舰',
    type: 'ship',
    category: 'ship',
    faction: 'pirate',
    isEnemy: false,
    config: { hull: 50, armor: 30, shield: 30, flux: 50, speed: 80, turnRate: 60, size: 30 },
    icon: '🏴‍☠️',
    description: '快速、低成本',
  },
];

/** 敌方舰船模板 */
const ENEMY_SHIP_TEMPLATES: AssetTemplate[] = [
  {
    id: 'enemy_scout',
    name: '敌方侦察舰',
    type: 'ship',
    category: 'ship',
    faction: null,
    isEnemy: true,
    config: { hull: 40, armor: 20, shield: 30, flux: 40, speed: 90, turnRate: 70, size: 25 },
    icon: '👾',
    description: '快速侦察单位',
  },
  {
    id: 'enemy_frigate',
    name: '敌方护卫舰',
    type: 'ship',
    category: 'ship',
    faction: null,
    isEnemy: true,
    config: { hull: 80, armor: 60, shield: 50, flux: 70, speed: 60, turnRate: 40, size: 40 },
    icon: '👾',
    description: '标准敌方护卫舰',
  },
  {
    id: 'enemy_destroyer',
    name: '敌方驱逐舰',
    type: 'ship',
    category: 'ship',
    faction: null,
    isEnemy: true,
    config: { hull: 120, armor: 100, shield: 80, flux: 100, speed: 50, turnRate: 30, size: 55 },
    icon: '👾',
    description: '重型敌方单位',
  },
  {
    id: 'enemy_cruiser',
    name: '敌方巡洋舰',
    type: 'ship',
    category: 'ship',
    faction: null,
    isEnemy: true,
    config: { hull: 200, armor: 180, shield: 120, flux: 150, speed: 35, turnRate: 20, size: 75 },
    icon: '👾',
    description: 'Boss 级敌方单位',
  },
  {
    id: 'enemy_station',
    name: '敌方空间站',
    type: 'station',
    category: 'ship',
    faction: null,
    isEnemy: true,
    config: { hull: 500, armor: 300, shield: 200, flux: 300, speed: 0, turnRate: 5, size: 120 },
    icon: '🛸',
    description: '固定防御设施',
  },
];

// ==================== 环境模板 ====================

const ENVIRONMENT_TEMPLATES: AssetTemplate[] = [
  {
    id: 'asteroid_small',
    name: '小行星（小）',
    type: 'asteroid',
    category: 'environment',
    faction: null,
    isEnemy: false,
    config: { hull: 50, armor: 50, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 20 },
    icon: '🪨',
    description: '小型障碍物',
  },
  {
    id: 'asteroid_medium',
    name: '小行星（中）',
    type: 'asteroid',
    category: 'environment',
    faction: null,
    isEnemy: false,
    config: { hull: 100, armor: 100, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 40 },
    icon: '🪨',
    description: '中型障碍物',
  },
  {
    id: 'asteroid_large',
    name: '小行星（大）',
    type: 'asteroid',
    category: 'environment',
    faction: null,
    isEnemy: false,
    config: { hull: 200, armor: 200, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 80 },
    icon: '🪨',
    description: '大型障碍物',
  },
  {
    id: 'debris_field',
    name: '残骸场',
    type: 'debris',
    category: 'environment',
    faction: null,
    isEnemy: false,
    config: { hull: 30, armor: 30, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 60 },
    icon: '💫',
    description: '提供掩护的残骸',
  },
  {
    id: 'nebula',
    name: '星云',
    type: 'debris',
    category: 'environment',
    faction: null,
    isEnemy: false,
    config: { hull: 0, armor: 0, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 150 },
    icon: '🌌',
    description: '降低侦测范围',
  },
];

// ==================== 目标模板 ====================

const OBJECTIVE_TEMPLATES: AssetTemplate[] = [
  {
    id: 'objective_beacon',
    name: '信标',
    type: 'objective',
    category: 'objective',
    faction: null,
    isEnemy: false,
    config: { hull: 50, armor: 30, shield: 50, flux: 0, speed: 0, turnRate: 0, size: 30 },
    icon: '📡',
    description: '控制点目标',
  },
  {
    id: 'objective_cargo',
    name: '货柜',
    type: 'objective',
    category: 'objective',
    faction: null,
    isEnemy: false,
    config: { hull: 30, armor: 20, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 25 },
    icon: '📦',
    description: '可回收物资',
  },
  {
    id: 'objective_station',
    name: '空间站',
    type: 'station',
    category: 'objective',
    faction: null,
    isEnemy: false,
    config: { hull: 300, armor: 200, shield: 150, flux: 200, speed: 0, turnRate: 0, size: 100 },
    icon: '🏠',
    description: '可占领设施',
  },
  {
    id: 'objective_jump_point',
    name: '跳跃点',
    type: 'objective',
    category: 'objective',
    faction: null,
    isEnemy: false,
    config: { hull: 0, armor: 0, shield: 0, flux: 0, speed: 0, turnRate: 0, size: 50 },
    icon: '🌀',
    description: '撤离点',
  },
];

// ==================== 素材库 ====================

export const ASSET_LIBRARY: AssetLibrary = {
  categories: [
    {
      id: 'player_ships',
      name: '玩家舰船',
      icon: '🚀',
      templates: PLAYER_SHIP_TEMPLATES,
    },
    {
      id: 'enemy_ships',
      name: '敌方单位',
      icon: '👾',
      templates: ENEMY_SHIP_TEMPLATES,
    },
    {
      id: 'environment',
      name: '环境',
      icon: '🪨',
      templates: ENVIRONMENT_TEMPLATES,
    },
    {
      id: 'objectives',
      name: '目标',
      icon: '🎯',
      templates: OBJECTIVE_TEMPLATES,
    },
  ],
};

// ==================== 辅助函数 ====================

/**
 * 获取模板
 */
export function getTemplate(templateId: string): AssetTemplate | undefined {
  for (const category of ASSET_LIBRARY.categories) {
    const template = category.templates.find((t: AssetTemplate) => t.id === templateId);
    if (template) return template;
  }
  return undefined;
}

/**
 * 获取玩家可用的模板（部署阶段）
 */
export function getPlayerTemplates(faction: FactionId): AssetTemplate[] {
  return PLAYER_SHIP_TEMPLATES.filter(t => t.faction === faction);
}

/**
 * 获取 DM 可用的模板
 */
export function getDMTemplates(): AssetTemplate[] {
  return [
    ...ENEMY_SHIP_TEMPLATES,
    ...ENVIRONMENT_TEMPLATES,
    ...OBJECTIVE_TEMPLATES,
  ];
}

/**
 * 检查模板是否可用于指定阶段
 */
export function isTemplateAvailable(
  template: AssetTemplate,
  phase: 'lobby' | 'deployment' | 'playing' | 'ended',
  isDM: boolean,
  faction?: FactionId
): boolean {
  // DM 全程可用
  if (isDM) return true;

  // 玩家仅部署阶段可用
  if (phase !== 'deployment') return false;

  // 玩家只能使用自己阵营的舰船
  if (template.category === 'ship' && template.faction === faction) {
    return true;
  }

  return false;
}