import { describe, it, expect } from 'vitest';
import { ArmorQuadrant } from '../ArmorQuadrant';

describe('ArmorQuadrant', () => {
  describe('constructor', () => {
    it('should create armor quadrant with max value', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100);
      expect(quadrant.value).toBe(100);
      expect(quadrant.maxValue).toBe(100);
      expect(quadrant.type).toBe('FRONT_TOP');
    });

    it('should create armor quadrant with custom initial value', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 50);
      expect(quadrant.value).toBe(50);
      expect(quadrant.maxValue).toBe(100);
    });

    it('should clamp initial value to valid range', () => {
      const quadrant1 = new ArmorQuadrant('FRONT_TOP', 100, -10);
      expect(quadrant1.value).toBe(0);

      const quadrant2 = new ArmorQuadrant('FRONT_TOP', 100, 150);
      expect(quadrant2.value).toBe(100);
    });

    it('should throw error for invalid max value', () => {
      expect(() => new ArmorQuadrant('FRONT_TOP', 0)).toThrow();
      expect(() => new ArmorQuadrant('FRONT_TOP', -10)).toThrow();
    });
  });

  describe('damageReduction', () => {
    it('should return 1 when at full armor', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100);
      expect(quadrant.damageReduction).toBe(1);
    });

    it('should return 0.5 when at half armor', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 50);
      expect(quadrant.damageReduction).toBe(0.5);
    });

    it('should return 0 when destroyed', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 0);
      expect(quadrant.damageReduction).toBe(0);
    });
  });

  describe('takeDamage', () => {
    it('should reduce armor value', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 80);
      const dealt = quadrant.takeDamage(30);
      expect(quadrant.value).toBe(50);
      expect(dealt).toBe(30);
    });

    it('should not reduce below 0', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 30);
      const dealt = quadrant.takeDamage(50);
      expect(quadrant.value).toBe(0);
      expect(dealt).toBe(30);
    });

    it('should throw error for negative damage', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100);
      expect(() => quadrant.takeDamage(-10)).toThrow();
    });
  });

  describe('repair', () => {
    it('should increase armor value', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 50);
      const repaired = quadrant.repair(30);
      expect(quadrant.value).toBe(80);
      expect(repaired).toBe(30);
    });

    it('should not exceed max value', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 80);
      const repaired = quadrant.repair(50);
      expect(quadrant.value).toBe(100);
      expect(repaired).toBe(20);
    });

    it('should throw error for negative repair', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100);
      expect(() => quadrant.repair(-10)).toThrow();
    });
  });

  describe('isDestroyed', () => {
    it('should return false when armor > 0', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 1);
      expect(quadrant.isDestroyed()).toBe(false);
    });

    it('should return true when armor = 0', () => {
      const quadrant = new ArmorQuadrant('FRONT_TOP', 100, 0);
      expect(quadrant.isDestroyed()).toBe(true);
    });
  });

  describe('copy', () => {
    it('should create independent copy', () => {
      const original = new ArmorQuadrant('FRONT_TOP', 100, 60);
      const copy = original.copy();

      expect(copy.type).toBe(original.type);
      expect(copy.value).toBe(original.value);
      expect(copy.maxValue).toBe(original.maxValue);

      copy.takeDamage(20);
      expect(original.value).toBe(60);
      expect(copy.value).toBe(40);
    });
  });
});
