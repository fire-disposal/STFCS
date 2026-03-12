import { describe, it, expect } from 'vitest';
import { Shield } from '../Shield';

describe('Shield', () => {
  const baseConfig = {
    type: 'FRONT' as const,
    radius: 100,
    centerOffset: { x: 0, y: 50 },
    coverageAngle: 120,
    efficiency: 0.5,
    maintenanceCost: 10,
  };

  describe('constructor', () => {
    it('should create shield with valid config', () => {
      const shield = new Shield(baseConfig);
      expect(shield.type).toBe('FRONT');
      expect(shield.radius).toBe(100);
      expect(shield.centerOffset).toEqual({ x: 0, y: 50 });
      expect(shield.coverageAngle).toBe(120);
      expect(shield.efficiency).toBe(0.5);
      expect(shield.maintenanceCost).toBe(10);
      expect(shield.isActive).toBe(false);
    });

    it('should create shield with initial active state', () => {
      const shield = new Shield(baseConfig, true);
      expect(shield.isActive).toBe(true);
    });

    it('should throw error for invalid radius', () => {
      expect(() => new Shield({ ...baseConfig, radius: 0 })).toThrow();
    });

    it('should throw error for invalid efficiency', () => {
      expect(() => new Shield({ ...baseConfig, efficiency: 0 })).toThrow();
      expect(() => new Shield({ ...baseConfig, efficiency: 1.5 })).toThrow();
    });

    it('should throw error for invalid coverage angle', () => {
      expect(() => new Shield({ ...baseConfig, coverageAngle: 0 })).toThrow();
      expect(() => new Shield({ ...baseConfig, coverageAngle: 400 })).toThrow();
    });

    it('should throw error for negative maintenance cost', () => {
      expect(() => new Shield({ ...baseConfig, maintenanceCost: -1 })).toThrow();
    });
  });

  describe('activate/deactivate', () => {
    it('should activate shield', () => {
      const shield = new Shield(baseConfig);
      shield.activate();
      expect(shield.isActive).toBe(true);
    });

    it('should deactivate shield', () => {
      const shield = new Shield(baseConfig, true);
      shield.deactivate();
      expect(shield.isActive).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle shield from inactive to active', () => {
      const shield = new Shield(baseConfig);
      shield.toggle();
      expect(shield.isActive).toBe(true);
    });

    it('should toggle shield from active to inactive', () => {
      const shield = new Shield(baseConfig, true);
      shield.toggle();
      expect(shield.isActive).toBe(false);
    });
  });

  describe('calculateFluxCost', () => {
    it('should calculate flux cost based on efficiency', () => {
      const shield = new Shield(baseConfig);
      expect(shield.calculateFluxCost(100)).toBe(50);
    });

    it('should handle zero damage', () => {
      const shield = new Shield(baseConfig);
      expect(shield.calculateFluxCost(0)).toBe(0);
    });
  });

  describe('coversAngle', () => {
    it('should cover angles within coverage range', () => {
      const shield = new Shield({ ...baseConfig, coverageAngle: 90 });
      expect(shield.coversAngle(90)).toBe(true);
      expect(shield.coversAngle(45)).toBe(true);
      expect(shield.coversAngle(135)).toBe(true);
    });

    it('should not cover angles outside coverage range', () => {
      const shield = new Shield({ ...baseConfig, coverageAngle: 90 });
      expect(shield.coversAngle(0)).toBe(false);
      expect(shield.coversAngle(180)).toBe(false);
    });
  });

  describe('copy', () => {
    it('should create independent copy', () => {
      const original = new Shield(baseConfig, true);
      const copy = original.copy();

      expect(copy.type).toBe(original.type);
      expect(copy.radius).toBe(original.radius);
      expect(copy.isActive).toBe(original.isActive);

      copy.deactivate();
      expect(original.isActive).toBe(true);
      expect(copy.isActive).toBe(false);
    });
  });
});
