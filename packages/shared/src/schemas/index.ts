import { z } from 'zod';
import { WS_MESSAGE_TYPES } from '../ws';

export const playerInfoSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  joinedAt: z.number(),
});

export const armorQuadrantSchema = z.enum([
  'front_left',
  'front_right',
  'left',
  'right',
  'rear_left',
  'rear_right',
]);

export const armorStateSchema = z.object({
  quadrants: z.record(armorQuadrantSchema, z.number().min(0)),
  maxArmor: z.number().min(0),
});

export const fluxTypeSchema = z.enum(['soft', 'hard']);

export const fluxStateSchema = z.object({
  current: z.number().min(0),
  capacity: z.number().min(0),
  dissipation: z.number().min(0),
  softFlux: z.number().min(0),
  hardFlux: z.number().min(0),
});

export const fluxOverloadStateSchema = z.enum(['normal', 'venting', 'overloaded']);

export const shieldSpecSchema = z.object({
  type: z.enum(['front', 'full']),
  radius: z.number().min(0),
  centerOffset: z.object({
    x: z.number(),
    y: z.number(),
  }),
  coverageAngle: z.number().min(0).max(360),
  efficiency: z.number().min(0).max(1),
  maintenanceCost: z.number().min(0),
  active: z.boolean(),
});

export const shipStatusSchema = z.object({
  id: z.string(),
  hull: z.object({
    current: z.number().min(0),
    max: z.number().min(0),
  }),
  armor: armorStateSchema,
  flux: fluxStateSchema,
  fluxState: fluxOverloadStateSchema,
  shield: shieldSpecSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  heading: z.number(),
  speed: z.number().min(0),
  maneuverability: z.number().min(0),
  disabled: z.boolean(),
});

const phaseSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const shipMovementSchema = z.object({
  shipId: z.string(),
  phase: phaseSchema,
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
  newX: z.number(),
  newY: z.number(),
  newHeading: z.number(),
  timestamp: z.number(),
});

export const explosionDataSchema = z.object({
  id: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  radius: z.number().min(0),
  damage: z.number().min(0),
  sourceShipId: z.string().optional(),
  targetShipId: z.string().optional(),
  hitQuadrant: armorQuadrantSchema.optional(),
  timestamp: z.number(),
});

export const mapConfigSchema = z.object({
  id: z.string(),
  width: z.number().min(1),
  height: z.number().min(1),
  name: z.string().min(1),
});

export const tokenTypeSchema = z.enum(['ship', 'station', 'asteroid']);

export const tokenInfoSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  heading: z.number(),
  type: tokenTypeSchema,
  size: z.number().min(0),
});

export const cameraStateSchema = z.object({
  centerX: z.number(),
  centerY: z.number(),
  zoom: z.number().min(0.1),
  rotation: z.number(),
});

export const combatResultSchema = z.object({
  hit: z.boolean(),
  damage: z.number().min(0),
  shieldAbsorbed: z.number().min(0),
  armorReduced: z.number().min(0),
  hullDamage: z.number().min(0),
  hitQuadrant: armorQuadrantSchema.optional(),
  softFluxGenerated: z.number().min(0),
  hardFluxGenerated: z.number().min(0),
  sourceShipId: z.string(),
  targetShipId: z.string(),
  timestamp: z.number(),
});

export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.PLAYER_JOINED),
    payload: playerInfoSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.PLAYER_LEFT),
    payload: z.object({
      playerId: z.string(),
      reason: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.SHIP_MOVED),
    payload: shipMovementSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE),
    payload: shipStatusSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.EXPLOSION),
    payload: explosionDataSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.SHIELD_UPDATE),
    payload: z.object({
      shipId: z.string(),
      active: z.boolean(),
      type: z.enum(['front', 'full']),
      coverageAngle: z.number().min(0).max(360),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.FLUX_STATE),
    payload: z.object({
      shipId: z.string(),
      fluxState: fluxOverloadStateSchema,
      currentFlux: z.number().min(0),
      softFlux: z.number().min(0),
      hardFlux: z.number().min(0),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.COMBAT_EVENT),
    payload: z.object({
      sourceShipId: z.string(),
      targetShipId: z.string(),
      weaponId: z.string(),
      hit: z.boolean(),
      damage: z.number().min(0).optional(),
      hitQuadrant: z.string().optional(),
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.MAP_INITIALIZED),
    payload: mapConfigSchema.extend({
      tokens: z.array(tokenInfoSchema),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.TOKEN_PLACED),
    payload: tokenInfoSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.TOKEN_MOVED),
    payload: z.object({
      tokenId: z.string(),
      previousPosition: z.object({ x: z.number(), y: z.number() }),
      newPosition: z.object({ x: z.number(), y: z.number() }),
      previousHeading: z.number(),
      newHeading: z.number(),
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.CAMERA_UPDATED),
    payload: cameraStateSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.WEAPON_FIRED),
    payload: z.object({
      sourceShipId: z.string(),
      targetShipId: z.string(),
      weaponId: z.string(),
      mountId: z.string(),
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.DAMAGE_DEALT),
    payload: combatResultSchema,
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.ERROR),
    payload: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);

export const movementCommandSchema = z.object({
  shipId: z.string(),
  phase: phaseSchema,
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

export const combatEventSchema = z.object({
  sourceShipId: z.string(),
  targetShipId: z.string(),
  weaponId: z.string(),
  hit: z.boolean(),
  damage: z.number().min(0).optional(),
  hitQuadrant: armorQuadrantSchema.optional(),
});

export const weaponTypeSchema = z.enum(['ballistic', 'energy', 'missile']);
export const weaponMountTypeSchema = z.enum(['fixed', 'turret']);

export const weaponSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: weaponTypeSchema,
  damage: z.number().min(0),
  range: z.number().min(0),
  arc: z.number().min(0).max(360),
  cooldown: z.number().min(0),
  fluxCost: z.number().min(0),
});

export const weaponMountSchema = z.object({
  id: z.string(),
  weaponId: z.string(),
  mountType: weaponMountTypeSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  facing: z.number(),
  arcMin: z.number(),
  arcMax: z.number(),
});

export const attackCommandSchema = z.object({
  sourceShipId: z.string(),
  targetShipId: z.string(),
  weaponMountId: z.string(),
  timestamp: z.number(),
});
