/**
 * 舰船数据系统测试
 */

import { describe, it, expect } from 'vitest';
import {
  getShipHullSpec,
  getAvailableShips,
  PRESET_SHIPS,
  importShipHullFromJson,
  exportShipHullToJson,
} from './ShipHullSchema.js';

describe('舰船数据系统', () => {
  describe('PRESET_SHIPS', () => {
    it('包含预设舰船', () => {
      expect(Object.keys(PRESET_SHIPS).length).toBeGreaterThan(0);
    });

    it('舰船规格完整', () => {
      const ship = PRESET_SHIPS['frigate_assault'];
      expect(ship).toBeDefined();
      expect(ship.id).toBe('frigate_assault');
      expect(ship.hullPoints).toBeGreaterThan(0);
      expect(ship.weaponMounts.length).toBeGreaterThan(0);
    });

    it('所有舰船都有必要的字段', () => {
      const ships = getAvailableShips();
      ships.forEach(ship => {
        expect(ship.id).toBeDefined();
        expect(ship.name).toBeDefined();
        expect(ship.size).toBeDefined();
        expect(ship.class).toBeDefined();
        expect(ship.hullPoints).toBeGreaterThan(0);
        expect(ship.fluxCapacity).toBeGreaterThan(0);
        expect(ship.weaponMounts).toBeDefined();
      });
    });
  });

  describe('getShipHullSpec', () => {
    it('获取存在的舰船规格', () => {
      const spec = getShipHullSpec('frigate_assault');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('突击护卫舰');
      expect(spec?.hullPoints).toBe(800);
    });

    it('返回不存在的舰船', () => {
      const spec = getShipHullSpec('nonexistent_ship');
      expect(spec).toBeUndefined();
    });

    it('获取不同尺寸的舰船', () => {
      const fighter = getShipHullSpec('fighter_scout');
      const capital = getShipHullSpec('capital_battleship');

      expect(fighter?.size).toBe('fighter');
      expect(capital?.size).toBe('capital');

      // 主力舰应该比战斗机更强
      expect(capital!.hullPoints).toBeGreaterThan(fighter!.hullPoints);
      expect(capital!.fluxCapacity).toBeGreaterThan(fighter!.fluxCapacity);
      expect(capital!.weaponMounts.length).toBeGreaterThan(fighter!.weaponMounts.length);
    });
  });

  describe('getAvailableShips', () => {
    it('返回所有可用舰船列表', () => {
      const ships = getAvailableShips();
      expect(ships.length).toBeGreaterThan(0);
      expect(ships.every(s => s.id && s.name)).toBe(true);
    });

    it('包含各种尺寸的舰船', () => {
      const ships = getAvailableShips();
      const sizes = ships.map(s => s.size);
      expect(sizes).toContain('fighter');
      expect(sizes).toContain('frigate');
      expect(sizes).toContain('cruiser');
      expect(sizes).toContain('capital');
    });
  });

  describe('importShipHullFromJson', () => {
    it('导入有效的舰船 JSON', () => {
      const json = JSON.stringify({
        id: 'custom_ship',
        name: '自定义舰船',
        size: 'frigate',
        class: 'strike',
        width: 20,
        length: 40,
        hullPoints: 1000,
        armorValue: 100,
        fluxCapacity: 150,
        fluxDissipation: 12,
        maxSpeed: 100,
        maxTurnRate: 45,
        acceleration: 50,
        hasShield: true,
        weaponMounts: [
          {
            id: 'mount_1',
            mountType: 'turret',
            offsetX: 0,
            offsetY: -10,
            facing: 0,
            arcMin: -45,
            arcMax: 45,
          },
        ],
      });

      const result = importShipHullFromJson(json);
      expect(result).not.toBeInstanceOf(Error);
      expect((result as { id: string }).id).toBe('custom_ship');
    });

    it('拒绝缺少 ID 的 JSON', () => {
      const json = JSON.stringify({
        name: '无 ID 舰船',
        size: 'frigate',
      });

      const result = importShipHullFromJson(json);
      expect(result).toBeInstanceOf(Error);
    });

    it('拒绝缺少名称的 JSON', () => {
      const json = JSON.stringify({
        id: 'no_name',
        size: 'frigate',
      });

      const result = importShipHullFromJson(json);
      expect(result).toBeInstanceOf(Error);
    });

    it('拒绝无效尺寸的 JSON', () => {
      const json = JSON.stringify({
        id: 'invalid_size',
        name: '无效尺寸',
        size: 'invalid',
      });

      const result = importShipHullFromJson(json);
      expect(result).toBeInstanceOf(Error);
    });

    it('拒绝缺少武器挂载点的 JSON', () => {
      const json = JSON.stringify({
        id: 'no_weapons',
        name: '无武器',
        size: 'frigate',
      });

      const result = importShipHullFromJson(json);
      expect(result).toBeInstanceOf(Error);
    });

    it('拒绝无效的 JSON 格式', () => {
      const json = '{ invalid json }';
      const result = importShipHullFromJson(json);
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('exportShipHullToJson', () => {
    it('导出舰船规格为 JSON', () => {
      const ship = getShipHullSpec('frigate_assault');
      expect(ship).toBeDefined();

      const json = exportShipHullToJson(ship!);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.id).toBe('frigate_assault');
      expect(parsed.name).toBe('突击护卫舰');
    });

    it('导出的 JSON 可以重新导入', () => {
      const originalShip = getShipHullSpec('cruiser_heavy');
      expect(originalShip).toBeDefined();

      const json = exportShipHullToJson(originalShip!);
      const imported = importShipHullFromJson(json);

      expect(imported).not.toBeInstanceOf(Error);
      expect((imported as { id: string }).id).toBe(originalShip!.id);
    });
  });

  describe('舰船分类', () => {
    it('护卫舰具有高速高机动性', () => {
      const frigate = getShipHullSpec('frigate_assault');
      expect(frigate?.maxSpeed).toBeGreaterThan(100);
      expect(frigate?.maxTurnRate).toBeGreaterThan(45);
    });

    it('主力舰具有低速度慢机动性', () => {
      const capital = getShipHullSpec('capital_battleship');
      expect(capital?.maxSpeed).toBeLessThan(100);
      expect(capital?.maxTurnRate).toBeLessThan(30);
    });

    it('航母具有支援分类', () => {
      const carrier = getShipHullSpec('cruiser_carrier');
      expect(carrier?.class).toBe('carrier');
      expect(carrier?.tags).toContain('carrier');
    });
  });

  describe('护盾系统', () => {
    it('部分舰船有护盾', () => {
      const shipWithShield = getShipHullSpec('frigate_assault');
      expect(shipWithShield?.hasShield).toBe(true);
      expect(shipWithShield?.shieldType).toBeDefined();
    });

    it('部分舰船没有护盾', () => {
      const shipWithoutShield = getShipHullSpec('fighter_scout');
      expect(shipWithoutShield?.hasShield).toBe(false);
    });

    it('护盾类型正确区分', () => {
      const frontShield = getShipHullSpec('frigate_assault');
      const fullShield = getShipHullSpec('cruiser_heavy');

      expect(frontShield?.shieldType).toBe('front');
      expect(fullShield?.shieldType).toBe('full');
    });
  });
});
