/**
 * 武器系统测试
 */

import { describe, it, expect } from 'vitest';
import {
  getWeaponSpec,
  getAvailableWeapons,
  PRESET_WEAPONS,
  DAMAGE_MULTIPLIERS,
} from './WeaponSchema.js';

describe('武器系统', () => {
  describe('PRESET_WEAPONS', () => {
    it('包含预设武器', () => {
      expect(Object.keys(PRESET_WEAPONS).length).toBeGreaterThan(0);
    });

    it('武器规格完整', () => {
      const weapon = PRESET_WEAPONS['autocannon'];
      expect(weapon).toBeDefined();
      expect(weapon.id).toBe('autocannon');
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.range).toBeGreaterThan(0);
      expect(weapon.cooldown).toBeGreaterThan(0);
    });
  });

  describe('getWeaponSpec', () => {
    it('获取存在的武器规格', () => {
      const spec = getWeaponSpec('autocannon');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('自动加农炮');
      expect(spec?.damage).toBe(25);
    });

    it('返回不存在的武器', () => {
      const spec = getWeaponSpec('nonexistent_weapon');
      expect(spec).toBeUndefined();
    });

    it('返回的武器规格包含所有必要字段', () => {
      const spec = getWeaponSpec('pulse_laser');
      expect(spec).toBeDefined();
      expect(spec?.id).toBeDefined();
      expect(spec?.name).toBeDefined();
      expect(spec?.category).toBeDefined();
      expect(spec?.damageType).toBeDefined();
      expect(spec?.damage).toBeDefined();
      expect(spec?.range).toBeDefined();
      expect(spec?.cooldown).toBeDefined();
      expect(spec?.fluxCost).toBeDefined();
    });
  });

  describe('getAvailableWeapons', () => {
    it('返回所有可用武器列表', () => {
      const weapons = getAvailableWeapons();
      expect(weapons.length).toBeGreaterThan(0);
      expect(weapons.every(w => w.id && w.name)).toBe(true);
    });
  });

  describe('DAMAGE_MULTIPLIERS', () => {
    it('包含所有伤害类型', () => {
      expect(DAMAGE_MULTIPLIERS.kinetic).toBeDefined();
      expect(DAMAGE_MULTIPLIERS.high_explosive).toBeDefined();
      expect(DAMAGE_MULTIPLIERS.energy).toBeDefined();
      expect(DAMAGE_MULTIPLIERS.fragmentation).toBeDefined();
    });

    it('动能武器对装甲有效', () => {
      expect(DAMAGE_MULTIPLIERS.kinetic.armor).toBe(2.0);
      expect(DAMAGE_MULTIPLIERS.kinetic.shield).toBe(0.5);
    });

    it('高爆武器对护盾和装甲都有削弱', () => {
      expect(DAMAGE_MULTIPLIERS.high_explosive.armor).toBe(0.5);
      expect(DAMAGE_MULTIPLIERS.high_explosive.shield).toBe(0.5);
    });

    it('能量武器无特殊倍率', () => {
      expect(DAMAGE_MULTIPLIERS.energy.armor).toBe(1.0);
      expect(DAMAGE_MULTIPLIERS.energy.shield).toBe(1.0);
    });

    it('破片武器对所有防御都有削弱', () => {
      expect(DAMAGE_MULTIPLIERS.fragmentation.armor).toBe(0.25);
      expect(DAMAGE_MULTIPLIERS.fragmentation.shield).toBe(0.25);
      expect(DAMAGE_MULTIPLIERS.fragmentation.hull).toBe(0.25);
    });
  });

  describe('武器分类', () => {
    it('动能武器标识正确', () => {
      const autocannon = getWeaponSpec('autocannon');
      expect(autocannon?.isBallistic).toBe(true);
      expect(autocannon?.isEnergy).toBe(false);
      expect(autocannon?.isMissile).toBe(false);
    });

    it('能量武器标识正确', () => {
      const pulseLaser = getWeaponSpec('pulse_laser');
      expect(pulseLaser?.isBallistic).toBe(false);
      expect(pulseLaser?.isEnergy).toBe(true);
      expect(pulseLaser?.isMissile).toBe(false);
    });

    it('导弹武器标识正确', () => {
      const missile = getWeaponSpec('assault_missile');
      expect(missile?.isBallistic).toBe(false);
      expect(missile?.isEnergy).toBe(false);
      expect(missile?.isMissile).toBe(true);
      expect(missile?.ammo).toBeGreaterThan(0);
    });

    it('特殊武器标识正确', () => {
      const phaseCharge = getWeaponSpec('phase_charge');
      expect(phaseCharge?.ignoresShields).toBe(true);
    });
  });
});
