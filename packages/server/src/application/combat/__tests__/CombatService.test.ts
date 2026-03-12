import { describe, it, expect, beforeEach } from 'vitest';
import { CombatService } from '../CombatService';
import { Weapon } from '../../../domain/weapon/Weapon';
import { Ship } from '../../../domain/ship/Ship';

describe('CombatService', () => {
  let service: CombatService;
  let ships: Map<string, Ship>;
  let damageApplied: Map<string, number>;
  let fluxApplied: Map<string, { soft: number; hard: number }>;

  beforeEach(() => {
    ships = new Map();
    damageApplied = new Map();
    fluxApplied = new Map();

    const sourceShip = new Ship({
      id: 'source',
      initialPosition: { x: 0, y: 0 },
      initialHeading: 0,
      speed: 100,
      maneuverability: 30,
      armor: {
        FRONT_TOP: { maxValue: 50, initialValue: 50 },
        FRONT_BOTTOM: { maxValue: 50, initialValue: 50 },
        LEFT_TOP: { maxValue: 50, initialValue: 50 },
        LEFT_BOTTOM: { maxValue: 50, initialValue: 50 },
        RIGHT_TOP: { maxValue: 50, initialValue: 50 },
        RIGHT_BOTTOM: { maxValue: 50, initialValue: 50 },
      },
      flux: {
        capacity: 100,
        dissipation: 10,
        initialSoftFlux: 0,
        initialHardFlux: 0,
      },
    });

    const targetShip = new Ship({
      id: 'target',
      initialPosition: { x: 0, y: -100 },
      initialHeading: 0,
      speed: 100,
      maneuverability: 30,
      armor: {
        FRONT_TOP: { maxValue: 50, initialValue: 50 },
        FRONT_BOTTOM: { maxValue: 50, initialValue: 50 },
        LEFT_TOP: { maxValue: 50, initialValue: 50 },
        LEFT_BOTTOM: { maxValue: 50, initialValue: 50 },
        RIGHT_TOP: { maxValue: 50, initialValue: 50 },
        RIGHT_BOTTOM: { maxValue: 50, initialValue: 50 },
      },
      flux: {
        capacity: 100,
        dissipation: 10,
        initialSoftFlux: 0,
        initialHardFlux: 0,
      },
    });

    ships.set('source', sourceShip);
    ships.set('target', targetShip);

    service = new CombatService({
      getShip: (shipId: string) => ships.get(shipId) || null,
      applyDamageToShip: (shipId: string, result) => {
        const current = damageApplied.get(shipId) || 0;
        damageApplied.set(shipId, current + result.hullDamage);
      },
      addFluxToShip: (shipId: string, softFlux: number, hardFlux: number) => {
        const current = fluxApplied.get(shipId) || { soft: 0, hard: 0 };
        fluxApplied.set(shipId, {
          soft: current.soft + softFlux,
          hard: current.hard + hardFlux,
        });
      },
    });

    const weapon = new Weapon({
      id: 'weapon-1',
      name: 'Test Cannon',
      type: 'ballistic',
      damage: 50,
      range: 500,
      arc: 60,
      cooldown: 1000,
      fluxCost: 10,
    });

    service.registerWeapon(weapon);
    service.registerWeaponMount({
      id: 'mount-1',
      weapon,
      mountType: 'fixed',
      position: { x: 0, y: 0 },
      facing: 0,
    });
  });

  it('should register weapon and mount', () => {
    const weapon = service.getWeapon('weapon-1');
    expect(weapon).toBeDefined();
    expect(weapon?.name).toBe('Test Cannon');

    const mount = service.getWeaponMount('mount-1');
    expect(mount).toBeDefined();
    expect(mount?.weapon.id).toBe('weapon-1');
  });

  it('should validate attack can proceed', () => {
    const validation = service.canAttack('source', 'target', 'mount-1');
    expect(validation.canAttack).toBe(true);
  });

  it('should reject attack for missing source ship', () => {
    const validation = service.canAttack('nonexistent', 'target', 'mount-1');
    expect(validation.canAttack).toBe(false);
    expect(validation.reason).toBe('Source ship not found');
  });

  it('should reject attack for missing target ship', () => {
    const validation = service.canAttack('source', 'nonexistent', 'mount-1');
    expect(validation.canAttack).toBe(false);
    expect(validation.reason).toBe('Target ship not found');
  });

  it('should execute successful attack', () => {
    const result = service.executeAttack({
      sourceShipId: 'source',
      targetShipId: 'target',
      weaponMountId: 'mount-1',
      timestamp: Date.now(),
    });

    expect(result.hit).toBe(true);
    expect(result.damageResult.damage).toBe(50);
    expect(result.damageResult.softFluxGenerated).toBe(10);
    expect(damageApplied.get('target')).toBeGreaterThan(0);
    expect(fluxApplied.get('source')?.soft).toBe(10);
  });

  it('should return miss for out of range attack', () => {
    const farTarget = new Ship({
      id: 'far',
      initialPosition: { x: 0, y: 1000 },
      initialHeading: 180,
      speed: 100,
      maneuverability: 30,
      armor: {
        FRONT_TOP: { maxValue: 50, initialValue: 50 },
        FRONT_BOTTOM: { maxValue: 50, initialValue: 50 },
        LEFT_TOP: { maxValue: 50, initialValue: 50 },
        LEFT_BOTTOM: { maxValue: 50, initialValue: 50 },
        RIGHT_TOP: { maxValue: 50, initialValue: 50 },
        RIGHT_BOTTOM: { maxValue: 50, initialValue: 50 },
      },
      flux: {
        capacity: 100,
        dissipation: 10,
        initialSoftFlux: 0,
        initialHardFlux: 0,
      },
    });

    ships.set('far', farTarget);

    const result = service.executeAttack({
      sourceShipId: 'source',
      targetShipId: 'far',
      weaponMountId: 'mount-1',
      timestamp: Date.now(),
    });

    expect(result.hit).toBe(false);
    expect(result.damageResult.damage).toBe(0);
  });

  it('should get engageable targets', () => {
    const targets = service.getEngageableTargets('source', ['target']);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.some(t => t.shipId === 'target')).toBe(true);
  });

  it('should calculate line of sight', () => {
    const hasLos = service.calculateLineOfSight(
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      []
    );
    expect(hasLos).toBe(true);
  });
});
