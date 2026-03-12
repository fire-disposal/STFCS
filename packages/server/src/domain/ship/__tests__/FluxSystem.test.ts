import { describe, it, expect } from 'vitest';
import { FluxSystem } from '../FluxSystem';
import { FluxStateValues } from '../FluxState';

describe('FluxSystem', () => {
  describe('constructor', () => {
    it('should create flux system with valid config', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10 });
      expect(flux.capacity).toBe(100);
      expect(flux.dissipation).toBe(10);
      expect(flux.softFlux).toBe(0);
      expect(flux.hardFlux).toBe(0);
      expect(flux.current).toBe(0);
      expect(flux.state).toBe(FluxStateValues.NORMAL);
    });

    it('should create flux system with initial values', () => {
      const flux = new FluxSystem({
        capacity: 100,
        dissipation: 10,
        initialSoftFlux: 30,
        initialHardFlux: 20,
      });
      expect(flux.softFlux).toBe(30);
      expect(flux.hardFlux).toBe(20);
      expect(flux.current).toBe(50);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new FluxSystem({ capacity: 0, dissipation: 10 })).toThrow();
    });

    it('should throw error for negative dissipation', () => {
      expect(() => new FluxSystem({ capacity: 100, dissipation: -1 })).toThrow();
    });
  });

  describe('addSoftFlux', () => {
    it('should add soft flux', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10 });
      flux.addSoftFlux(30);
      expect(flux.softFlux).toBe(30);
      expect(flux.current).toBe(30);
    });

    it('should clamp flux to capacity', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 80 });
      flux.addSoftFlux(50);
      expect(flux.current).toBe(100);
    });

    it('should trigger overload at capacity', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 99 });
      flux.addSoftFlux(1);
      expect(flux.state).toBe(FluxStateValues.OVERLOADED);
    });

    it('should throw error for negative flux', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10 });
      expect(() => flux.addSoftFlux(-10)).toThrow();
    });
  });

  describe('addHardFlux', () => {
    it('should add hard flux', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10 });
      flux.addHardFlux(40);
      expect(flux.hardFlux).toBe(40);
      expect(flux.current).toBe(40);
    });

    it('should clamp flux to capacity', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialHardFlux: 80 });
      flux.addHardFlux(50);
      expect(flux.current).toBe(100);
    });
  });

  describe('vent', () => {
    it('should set venting state', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10 });
      flux.vent();
      expect(flux.state).toBe(FluxStateValues.VENTING);
    });

    it('should not vent when overloaded', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 100 });
      flux.vent();
      expect(flux.state).toBe(FluxStateValues.OVERLOADED);
    });
  });

  describe('endVent', () => {
    it('should clear soft flux and return to normal', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 50 });
      flux.vent();
      flux.endVent();
      expect(flux.softFlux).toBe(0);
      expect(flux.state).toBe(FluxStateValues.NORMAL);
    });

    it('should not end vent if not venting', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 50 });
      flux.endVent();
      expect(flux.softFlux).toBe(50);
      expect(flux.state).toBe(FluxStateValues.NORMAL);
    });
  });

  describe('endOverload', () => {
    it('should set flux to 50% and clear hard flux', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 10, initialSoftFlux: 60, initialHardFlux: 40 });
      flux.triggerOverload();
      flux.endOverload();
      expect(flux.softFlux).toBe(50);
      expect(flux.hardFlux).toBe(0);
      expect(flux.state).toBe(FluxStateValues.NORMAL);
    });
  });

  describe('dissipate', () => {
    it('should reduce soft flux by dissipation', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 20, initialSoftFlux: 50 });
      flux.dissipate();
      expect(flux.softFlux).toBe(30);
    });

    it('should not reduce below 0', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 20, initialSoftFlux: 10 });
      flux.dissipate();
      expect(flux.softFlux).toBe(0);
    });

    it('should not dissipate when venting', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 20, initialSoftFlux: 50 });
      flux.vent();
      flux.dissipate();
      expect(flux.softFlux).toBe(50);
    });

    it('should not dissipate when overloaded', () => {
      const flux = new FluxSystem({ capacity: 100, dissipation: 20, initialSoftFlux: 100 });
      flux.dissipate();
      expect(flux.softFlux).toBe(100);
    });
  });

  describe('copy', () => {
    it('should create independent copy', () => {
      const original = new FluxSystem({
        capacity: 100,
        dissipation: 10,
        initialSoftFlux: 30,
        initialHardFlux: 20,
      });
      const copy = original.copy();

      expect(copy.capacity).toBe(original.capacity);
      expect(copy.softFlux).toBe(original.softFlux);
      expect(copy.hardFlux).toBe(original.hardFlux);

      copy.addSoftFlux(10);
      expect(original.softFlux).toBe(30);
      expect(copy.softFlux).toBe(40);
    });
  });
});
