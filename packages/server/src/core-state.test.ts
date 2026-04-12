import { describe, expect, it } from 'vitest';
import { ClientCommand, PROTOCOL_VERSION, type GameRoomState, type PlayerState, type ShipState } from '@vt/contracts';
import {
  PRESET_SHIPS,
  PRESET_WEAPONS,
  angleDifference,
  calculateThreePhaseMove,
  distance,
  getAvailableShips,
  getAvailableWeapons,
  getShipHullSpec,
  getWeaponSpec,
  validateThreePhaseMove,
} from '@vt/rules';

describe('core contracts and rules', () => {
  it('keeps protocol and command constants stable', () => {
    expect(PROTOCOL_VERSION).toBe('1.0.0');
    expect(ClientCommand.CMD_MOVE_TOKEN).toBe('CMD_MOVE_TOKEN');
    expect(ClientCommand.CMD_NEXT_PHASE).toBe('CMD_NEXT_PHASE');
  });

  it('computes movement plans within bounds', () => {
    const plan = {
      phaseAForward: 40,
      phaseAStrafe: 10,
      turnAngle: 15,
      phaseBForward: 20,
      phaseBStrafe: -5,
    };

    const validation = validateThreePhaseMove(0, 0, 0, plan, 30, 45);
    expect(validation.valid).toBe(true);
    expect(validation.finalPosition).toBeDefined();
    expect(validation.finalHeading).toBe(15);

    const result = calculateThreePhaseMove(0, 0, 0, plan);
    expect(result.heading).toBe(15);
    expect(result.x).toBeCloseTo(validation.finalPosition?.x ?? 0);
    expect(result.y).toBeCloseTo(validation.finalPosition?.y ?? 0);
    expect(distance(0, 0, result.x, result.y)).toBeGreaterThan(0);
    expect(angleDifference(350, 10)).toBe(20);
  });

  it('rejects out-of-range movement plans', () => {
    const invalidPlan = {
      phaseAForward: 999,
      phaseAStrafe: 0,
      turnAngle: 0,
      phaseBForward: 0,
      phaseBStrafe: 0,
    };

    const validation = validateThreePhaseMove(0, 0, 0, invalidPlan, 30, 45);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Phase A forward distance');
  });

  it('exposes weapon and hull presets through the rules package', () => {
    expect(PRESET_WEAPONS.autocannon).toBeDefined();
    expect(PRESET_SHIPS.frigate_assault).toBeDefined();
    expect(getWeaponSpec('autocannon')?.id).toBe('autocannon');
    expect(getShipHullSpec('frigate_assault')?.id).toBe('frigate_assault');
    expect(getAvailableWeapons().length).toBeGreaterThan(0);
    expect(getAvailableShips().length).toBeGreaterThan(0);
  });

  it('models game room state with map-like collections', () => {
    const player: PlayerState = {
      sessionId: 'session-1',
      shortId: 123456,
      role: 'dm',
      name: 'Commander',
      isReady: false,
      connected: true,
      pingMs: 33,
      jitterMs: 2,
      connectionQuality: 'excellent',
    };

    const ship: ShipState = {
      id: 'ship-1',
      ownerId: 'session-1',
      faction: 'dm',
      hullType: 'frigate',
      transform: { x: 12, y: 24, heading: 90 },
      hullCurrent: 100,
      hullMax: 100,
      armorCurrent: [10, 10, 10, 10, 10, 10],
      armorMax: [10, 10, 10, 10, 10, 10],
      fluxMax: 100,
      fluxDissipation: 10,
      fluxHard: 0,
      fluxSoft: 0,
      isShieldUp: false,
      shieldOrientation: 0,
      shieldArc: 120,
      isOverloaded: false,
      overloadTime: 0,
      maxSpeed: 30,
      maxTurnRate: 45,
      acceleration: 10,
      movePhaseAX: 0,
      movePhaseAStrafe: 0,
      movePhaseBX: 0,
      movePhaseBStrafe: 0,
      turnAngle: 0,
      weapons: new Map(),
      hasMoved: false,
      hasFired: false,
    };

    const roomState: GameRoomState = {
      currentPhase: 'DEPLOYMENT',
      turnCount: 1,
      players: new Map([[player.sessionId, player]]),
      ships: new Map([[ship.id, ship]]),
      activeFaction: 'player',
      mapWidth: 2000,
      mapHeight: 2000,
    };

    expect(roomState.players.size).toBe(1);
    expect(roomState.players.get('session-1')?.name).toBe('Commander');
    expect(roomState.ships.get('ship-1')?.transform.heading).toBe(90);
    expect(roomState.ships.get('ship-1')?.weapons.size).toBe(0);
  });
});
