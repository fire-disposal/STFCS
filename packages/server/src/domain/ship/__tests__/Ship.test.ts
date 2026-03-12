import { describe, it, expect } from 'vitest';
import { Ship } from '../Ship';
import { ShipStatusValues } from '../ShipStatus';
import type { ShipConfig } from '../types';

const createShipConfig = (overrides?: Partial<ShipConfig>): ShipConfig => ({
  id: 'ship-1',
  initialPosition: { x: 0, y: 0 },
  initialHeading: 0,
  speed: 5,
  maneuverability: 45,
  armor: {
    FRONT_TOP: { maxValue: 100 },
    FRONT_BOTTOM: { maxValue: 100 },
    LEFT_TOP: { maxValue: 80 },
    LEFT_BOTTOM: { maxValue: 80 },
    RIGHT_TOP: { maxValue: 80 },
    RIGHT_BOTTOM: { maxValue: 80 },
  },
  flux: {
    capacity: 100,
    dissipation: 10,
  },
  ...overrides,
});

describe('Ship', () => {
  describe('constructor', () => {
    it('should create ship with valid config', () => {
      const config = createShipConfig();
      const ship = new Ship(config);

      expect(ship.id).toBe('ship-1');
      expect(ship.position).toEqual({ x: 0, y: 0 });
      expect(ship.heading).toBe(0);
      expect(ship.speed).toBe(5);
      expect(ship.maneuverability).toBe(45);
      expect(ship.status).toBe(ShipStatusValues.NORMAL);
    });

    it('should throw error for invalid speed', () => {
      expect(() => new Ship(createShipConfig({ speed: 0 }))).toThrow();
    });

    it('should throw error for invalid maneuverability', () => {
      expect(() => new Ship(createShipConfig({ maneuverability: -10 }))).toThrow();
    });

    it('should normalize heading to 0-360 range', () => {
      const ship = new Ship(createShipConfig({ initialHeading: 450 }));
      expect(ship.heading).toBe(90);
    });
  });

  describe('getHull', () => {
    it('should return sum of all armor quadrants', () => {
      const ship = new Ship(createShipConfig());
      expect(ship.getHull()).toBe(520);
    });
  });

  describe('shield operations', () => {
    it('should enable shield', () => {
      const ship = new Ship(createShipConfig({
        shield: {
          type: 'FRONT',
          radius: 100,
          centerOffset: { x: 0, y: 50 },
          coverageAngle: 120,
          efficiency: 0.5,
          maintenanceCost: 10,
        },
      }));

      ship.enableShield();
      expect(ship.shield?.isActive).toBe(true);
    });

    it('should disable shield', () => {
      const ship = new Ship(createShipConfig({
        shield: {
          type: 'FRONT',
          radius: 100,
          centerOffset: { x: 0, y: 50 },
          coverageAngle: 120,
          efficiency: 0.5,
          maintenanceCost: 10,
        },
      }));

      ship.enableShield();
      ship.disableShield();
      expect(ship.shield?.isActive).toBe(false);
    });

    it('should toggle shield', () => {
      const ship = new Ship(createShipConfig({
        shield: {
          type: 'FRONT',
          radius: 100,
          centerOffset: { x: 0, y: 50 },
          coverageAngle: 120,
          efficiency: 0.5,
          maintenanceCost: 10,
        },
      }));

      ship.toggleShield();
      expect(ship.shield?.isActive).toBe(true);

      ship.toggleShield();
      expect(ship.shield?.isActive).toBe(false);
    });

    it('should pay shield maintenance cost', () => {
      const ship = new Ship(createShipConfig({
        shield: {
          type: 'FRONT',
          radius: 100,
          centerOffset: { x: 0, y: 50 },
          coverageAngle: 120,
          efficiency: 0.5,
          maintenanceCost: 15,
        },
      }));

      ship.enableShield();
      ship.payShieldMaintenance();
      expect(ship.flux.softFlux).toBe(15);
    });
  });

  describe('validateMovement', () => {
    it('should validate forward movement in phase 1', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 10, y: 0 }, 0, 1);
      expect(result.isValid).toBe(true);
    });

    it('should reject forward movement exceeding limit', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 11, y: 0 }, 0, 1);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum distance');
    });

    it('should validate strafe movement in phase 1', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 0, y: 5 }, 0, 1);
      expect(result.isValid).toBe(true);
    });

    it('should reject strafe movement exceeding limit', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 0, y: 6 }, 0, 1);
      expect(result.isValid).toBe(false);
    });

    it('should reject combined forward and strafe', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 5, y: 3 }, 0, 1);
      expect(result.isValid).toBe(false);
    });

    it('should validate rotation in phase 2', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 0, y: 0 }, 30, 2);
      expect(result.isValid).toBe(true);
    });

    it('should reject rotation exceeding limit', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 0, y: 0 }, 50, 2);
      expect(result.isValid).toBe(false);
    });

    it('should reject movement during phase 2', () => {
      const ship = new Ship(createShipConfig());
      const result = ship.validateMovement({ x: 5, y: 0 }, 0, 2);
      expect(result.isValid).toBe(false);
    });

    it('should reject movement when overloaded', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 100 } }));
      const result = ship.validateMovement({ x: 5, y: 0 }, 0, 1);
      expect(result.isValid).toBe(false);
    });

    it('should reject movement when venting', () => {
      const ship = new Ship(createShipConfig());
      ship.beginVent();
      const result = ship.validateMovement({ x: 5, y: 0 }, 0, 1);
      expect(result.isValid).toBe(false);
    });
  });

  describe('move', () => {
    it('should move ship in phase 1', () => {
      const ship = new Ship(createShipConfig());
      const success = ship.move({ x: 5, y: 0 }, 0, 1);
      expect(success).toBe(true);
      expect(ship.position).toEqual({ x: 5, y: 0 });
      expect(ship.heading).toBe(0);
    });

    it('should rotate ship in phase 2', () => {
      const ship = new Ship(createShipConfig());
      const success = ship.move({ x: 0, y: 0 }, 30, 2);
      expect(success).toBe(true);
      expect(ship.position).toEqual({ x: 0, y: 0 });
      expect(ship.heading).toBe(30);
    });

    it('should emit ShipMoved event', () => {
      const ship = new Ship(createShipConfig());
      ship.move({ x: 5, y: 0 }, 0, 1);
      expect(ship.events.length).toBe(1);
      expect(ship.events[0].type).toBe('SHIP_MOVED');
    });

    it('should reject invalid movement', () => {
      const ship = new Ship(createShipConfig());
      const success = ship.move({ x: 20, y: 0 }, 0, 1);
      expect(success).toBe(false);
      expect(ship.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('flux state management', () => {
    it('should begin vent', () => {
      const ship = new Ship(createShipConfig());
      const success = ship.beginVent();
      expect(success).toBe(true);
      expect(ship.status).toBe(ShipStatusValues.VENTING);
    });

    it('should not begin vent when overloaded', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 100 } }));
      const success = ship.beginVent();
      expect(success).toBe(false);
    });

    it('should end vent and clear flux', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 50 } }));
      ship.beginVent();
      ship.endVent();
      expect(ship.status).toBe(ShipStatusValues.NORMAL);
      expect(ship.flux.softFlux).toBe(0);
    });

    it('should trigger overload', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 100 } }));
      expect(ship.status).toBe(ShipStatusValues.OVERLOADED);
    });

    it('should end overload and set flux to 50%', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 100 } }));
      ship.endOverload();
      expect(ship.status).toBe(ShipStatusValues.NORMAL);
      expect(ship.flux.current).toBe(50);
    });
  });

  describe('turn management', () => {
    it('should dissipate flux at start of turn', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 20, initialSoftFlux: 50 } }));
      ship.startTurn();
      expect(ship.flux.softFlux).toBe(30);
    });

    it('should trigger overload at end of turn if at capacity', () => {
      const ship = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 100 } }));
      ship.endTurn();
      expect(ship.status).toBe(ShipStatusValues.OVERLOADED);
    });
  });

  describe('copy', () => {
    it('should create independent copy', () => {
      const original = new Ship(createShipConfig({ flux: { capacity: 100, dissipation: 10, initialSoftFlux: 50 } }));
      const copy = original.copy();

      expect(copy.id).toBe(original.id);
      expect(copy.position).toEqual(original.position);
      expect(copy.flux.softFlux).toBe(original.flux.softFlux);

      copy.move({ x: 10, y: 0 }, 0, 1);
      expect(original.position.x).toBe(0);
      expect(copy.position.x).toBe(10);
    });
  });

  describe('events', () => {
    it('should clear events', () => {
      const ship = new Ship(createShipConfig());
      ship.move({ x: 5, y: 0 }, 0, 1);
      expect(ship.events.length).toBe(1);
      ship.clearEvents();
      expect(ship.events.length).toBe(0);
    });

    it('should emit ShieldToggled event', () => {
      const ship = new Ship(createShipConfig({
        shield: {
          type: 'FRONT',
          radius: 100,
          centerOffset: { x: 0, y: 50 },
          coverageAngle: 120,
          efficiency: 0.5,
          maintenanceCost: 10,
        },
      }));

      ship.toggleShield();
      expect(ship.events.some(e => e.type === 'SHIELD_TOGGLED')).toBe(true);
    });
  });
});
