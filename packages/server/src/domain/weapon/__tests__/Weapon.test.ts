import { describe, it, expect, beforeEach } from 'vitest';
import { Weapon } from '../Weapon';
import { WeaponMountEntity } from '../WeaponMount';
import { DamageCalculator } from '../DamageCalculator';
import { Ship } from '../../ship/Ship';

describe('Weapon', () => {
  let weapon: Weapon;

  beforeEach(() => {
    weapon = new Weapon({
      id: 'weapon-1',
      name: 'Test Cannon',
      type: 'ballistic',
      damage: 50,
      range: 500,
      arc: 60,
      cooldown: 1000,
      fluxCost: 10,
    });
  });

  it('should create weapon with correct properties', () => {
    expect(weapon.id).toBe('weapon-1');
    expect(weapon.name).toBe('Test Cannon');
    expect(weapon.type).toBe('ballistic');
    expect(weapon.damage).toBe(50);
    expect(weapon.range).toBe(500);
    expect(weapon.arc).toBe(60);
    expect(weapon.fluxCost).toBe(10);
  });

  it('should throw for invalid damage', () => {
    expect(() => new Weapon({
      id: 'bad',
      name: 'Bad',
      type: 'ballistic',
      damage: -1,
      range: 100,
      arc: 60,
      cooldown: 0,
      fluxCost: 0,
    })).toThrow();
  });

  it('should throw for invalid range', () => {
    expect(() => new Weapon({
      id: 'bad',
      name: 'Bad',
      type: 'ballistic',
      damage: 10,
      range: 0,
      arc: 60,
      cooldown: 0,
      fluxCost: 0,
    })).toThrow();
  });

  it('should check if target is within range', () => {
    expect(weapon.isWithinRange(100)).toBe(true);
    expect(weapon.isWithinRange(500)).toBe(true);
    expect(weapon.isWithinRange(600)).toBe(false);
    expect(weapon.isWithinRange(0)).toBe(false);
  });

  it('should check if target is in arc', () => {
    expect(weapon.isTargetInArc(0, 0)).toBe(true);
    expect(weapon.isTargetInArc(0, 30)).toBe(true);
    expect(weapon.isTargetInArc(0, -30)).toBe(true);
    expect(weapon.isTargetInArc(0, 45)).toBe(false);
  });

  it('should handle arc wraparound', () => {
    expect(weapon.isTargetInArc(350, 10)).toBe(true);
    expect(weapon.isTargetInArc(10, 350)).toBe(true);
  });
});

describe('WeaponMountEntity', () => {
  let weapon: Weapon;
  let mount: WeaponMountEntity;

  beforeEach(() => {
    weapon = new Weapon({
      id: 'weapon-1',
      name: 'Test Cannon',
      type: 'ballistic',
      damage: 50,
      range: 500,
      arc: 60,
      cooldown: 1000,
      fluxCost: 10,
    });

    mount = new WeaponMountEntity({
      id: 'mount-1',
      weapon,
      mountType: 'fixed',
      position: { x: 0, y: 0 },
      facing: 0,
    });
  });

  it('should create mount with correct properties', () => {
    expect(mount.id).toBe('mount-1');
    expect(mount.weapon.id).toBe('weapon-1');
    expect(mount.mountType).toBe('fixed');
    expect(mount.facing).toBe(0);
  });

  it('should not rotate fixed mount', () => {
    const initialFacing = mount.facing;
    mount.rotate(45);
    expect(mount.facing).toBe(initialFacing);
  });

  it('should rotate turret mount', () => {
    const turret = new WeaponMountEntity({
      id: 'turret-1',
      weapon,
      mountType: 'turret',
      position: { x: 0, y: 0 },
      facing: 0,
    });

    turret.rotate(45);
    expect(turret.facing).toBe(45);
  });

  it('should check if target is in arc', () => {
    const shipPos = { x: 0, y: 0 };
    const targetInArc = { x: 0, y: -100 };
    const targetOutOfArc = { x: 100, y: 0 };

    expect(mount.isTargetInArc(targetInArc, shipPos)).toBe(true);
    expect(mount.isTargetInArc(targetOutOfArc, shipPos)).toBe(false);
  });
});

describe('DamageCalculator', () => {
  it('should calculate distance correctly', () => {
    const dist = DamageCalculator.calculateDistance(
      { x: 0, y: 0 },
      { x: 3, y: 4 }
    );
    expect(dist).toBe(5);
  });

  it('should calculate angle correctly', () => {
    const angle = DamageCalculator.calculateAngle(
      { x: 0, y: 0 },
      { x: 0, y: -100 }
    );
    expect(angle).toBeCloseTo(0, 5);
  });

  it('should check if angle is in arc', () => {
    expect(DamageCalculator.isAngleInArc(0, 60, 0)).toBe(true);
    expect(DamageCalculator.isAngleInArc(0, 60, 30)).toBe(true);
    expect(DamageCalculator.isAngleInArc(0, 60, 45)).toBe(false);
  });

  it('should calculate damage with shield absorption', () => {
    const weapon = new Weapon({
      id: 'weapon-1',
      name: 'Test',
      type: 'ballistic',
      damage: 100,
      range: 1000,
      arc: 360,
      cooldown: 0,
      fluxCost: 10,
    });

    const sourceShip = new Ship({
      id: 'source',
      initialPosition: { x: 0, y: -100 },
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

    const targetShip = new Ship({
      id: 'target',
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
      shield: {
        type: 'front',
        radius: 100,
        centerOffset: { x: 0, y: 0 },
        coverageAngle: 120,
        efficiency: 0.5,
        maintenanceCost: 5,
      },
    });

    targetShip.enableShield();

    const result = DamageCalculator.calculateDamage({
      weapon,
      sourceShip,
      targetShip,
      hitPosition: { x: 0, y: 0 },
    });

    expect(result.hit).toBe(true);
    expect(result.damage).toBe(100);
    expect(result.shieldAbsorbed).toBeGreaterThan(0);
    expect(result.hardFluxGenerated).toBeGreaterThan(0);
    expect(result.softFluxGenerated).toBe(10);
  });

  it('should return miss for out of range target', () => {
    const weapon = new Weapon({
      id: 'weapon-1',
      name: 'Test',
      type: 'ballistic',
      damage: 100,
      range: 50,
      arc: 60,
      cooldown: 0,
      fluxCost: 10,
    });

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
      initialPosition: { x: 0, y: 200 },
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

    const result = DamageCalculator.calculateDamage({
      weapon,
      sourceShip,
      targetShip,
      hitPosition: { x: 0, y: 200 },
    });

    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
  });
});
