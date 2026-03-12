import { describe, it, expect, beforeEach } from 'vitest';
import { ShipService } from '../ShipService';

describe('ShipService', () => {
  let service: ShipService;

  const createTestShipConfig = (id: string) => ({
    id,
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
    shield: {
      type: 'FRONT' as const,
      radius: 100,
      centerOffset: { x: 0, y: 50 },
      coverageAngle: 120,
      efficiency: 0.5,
      maintenanceCost: 10,
    },
  });

  beforeEach(() => {
    service = new ShipService();
  });

  describe('createShip', () => {
    it('should create a new ship', () => {
      const config = createTestShipConfig('ship-1');
      const ship = service.createShip(config);

      expect(ship).toBeDefined();
      expect(ship.id).toBe('ship-1');
    });

    it('should store ship in internal map', () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const retrieved = service.getShip('ship-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('ship-1');
    });

    it('should return undefined for non-existent ship', () => {
      const retrieved = service.getShip('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('moveShip', () => {
    it('should move ship successfully', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result = await service.moveShip('ship-1', {
        shipId: 'ship-1',
        phase: 1,
        type: 'straight',
        distance: 5,
      });

      expect(result.success).toBe(true);
    });

    it('should fail to move non-existent ship', async () => {
      const result = await service.moveShip('non-existent', {
        shipId: 'non-existent',
        phase: 1,
        type: 'straight',
        distance: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ship not found');
    });

    it('should reject movement exceeding speed limit', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result = await service.moveShip('ship-1', {
        shipId: 'ship-1',
        phase: 1,
        type: 'straight',
        distance: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum distance');
    });

    it('should rotate ship in phase 2', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result = await service.moveShip('ship-1', {
        shipId: 'ship-1',
        phase: 2,
        type: 'rotate',
        angle: 30,
      });

      expect(result.success).toBe(true);

      const ship = service.getShip('ship-1');
      expect(ship?.heading).toBe(30);
    });
  });

  describe('toggleShield', () => {
    it('should toggle shield on/off', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result1 = await service.toggleShield('ship-1');
      expect(result1).toBe(true);

      const status1 = service.getShipStatus('ship-1');
      expect(status1?.shield.active).toBe(true);

      const result2 = await service.toggleShield('ship-1');
      expect(result2).toBe(true);

      const status2 = service.getShipStatus('ship-1');
      expect(status2?.shield.active).toBe(false);
    });

    it('should fail for ship without shield', async () => {
      const config = {
        ...createTestShipConfig('ship-1'),
        shield: undefined,
      };
      service.createShip(config);

      const result = await service.toggleShield('ship-1');
      expect(result).toBe(false);
    });

    it('should fail for non-existent ship', async () => {
      const result = await service.toggleShield('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('enableShield', () => {
    it('should enable shield', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result = await service.enableShield('ship-1');
      expect(result).toBe(true);

      const status = service.getShipStatus('ship-1');
      expect(status?.shield.active).toBe(true);
    });
  });

  describe('disableShield', () => {
    it('should disable shield', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      await service.enableShield('ship-1');
      const result = await service.disableShield('ship-1');

      expect(result).toBe(true);

      const status = service.getShipStatus('ship-1');
      expect(status?.shield.active).toBe(false);
    });
  });

  describe('ventShip', () => {
    it('should start venting', async () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const result = await service.ventShip('ship-1');
      expect(result).toBe(true);
    });

    it('should fail for non-existent ship', async () => {
      const result = await service.ventShip('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getShipStatus', () => {
    it('should return ship status', () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const status = service.getShipStatus('ship-1');

      expect(status).toBeDefined();
      expect(status?.id).toBe('ship-1');
      expect(status?.position).toEqual({ x: 0, y: 0 });
      expect(status?.heading).toBe(0);
    });

    it('should return undefined for non-existent ship', () => {
      const status = service.getShipStatus('non-existent');
      expect(status).toBeUndefined();
    });

    it('should include flux state', () => {
      const config = createTestShipConfig('ship-1');
      service.createShip(config);

      const status = service.getShipStatus('ship-1');

      expect(status?.flux).toBeDefined();
      expect(status?.flux.current).toBe(0);
      expect(status?.flux.capacity).toBe(100);
    });
  });
});
