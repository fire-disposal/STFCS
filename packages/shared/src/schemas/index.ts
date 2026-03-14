import { z } from 'zod';
import { WS_MESSAGE_TYPES } from '../ws';

export const playerInfoSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  joinedAt: z.number(),
});

export const armorQuadrantSchema = z.enum([
  "FRONT_TOP",
  "FRONT_BOTTOM",
  "LEFT_TOP",
  "LEFT_BOTTOM",
  "RIGHT_TOP",
  "RIGHT_BOTTOM",
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

// WebSocket Request-Response Schemas
export const requestOperationSchema = z.enum([
  'player.join',
  'player.leave',
  'player.list',
  'ship.move',
  'ship.toggleShield',
  'ship.vent',
  'ship.getStatus',
]);

// Operation-specific request payload schemas
export const playerJoinRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  roomId: z.string().optional(),
});

export const playerLeaveRequestSchema = z.object({
  playerId: z.string(),
  roomId: z.string(),
});

export const playerListRequestSchema = z.object({
  roomId: z.string(),
});

export const shipMoveRequestSchema = z.object({
  shipId: z.string(),
  phase: phaseSchema,
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

export const shipToggleShieldRequestSchema = z.object({
  shipId: z.string(),
});

export const shipVentRequestSchema = z.object({
  shipId: z.string(),
});

export const shipGetStatusRequestSchema = z.object({
  shipId: z.string(),
});

// Union type for request payload based on operation
export const requestPayloadSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('player.join'),
    data: playerJoinRequestSchema,
  }),
  z.object({
    operation: z.literal('player.leave'),
    data: playerLeaveRequestSchema,
  }),
  z.object({
    operation: z.literal('player.list'),
    data: playerListRequestSchema,
  }),
  z.object({
    operation: z.literal('ship.move'),
    data: shipMoveRequestSchema,
  }),
  z.object({
    operation: z.literal('ship.toggleShield'),
    data: shipToggleShieldRequestSchema,
  }),
  z.object({
    operation: z.literal('ship.vent'),
    data: shipVentRequestSchema,
  }),
  z.object({
    operation: z.literal('ship.getStatus'),
    data: shipGetStatusRequestSchema,
  }),
]);

export const errorResponseSchema = z.object({
  success: z.literal(false),
  operation: requestOperationSchema,
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  timestamp: z.number(),
});

export const successResponseSchema = z.object({
  success: z.literal(true),
  operation: requestOperationSchema,
  data: z.unknown(),
  timestamp: z.number(),
});

export const responsePayloadSchema = z.discriminatedUnion('success', [
  successResponseSchema,
  errorResponseSchema,
]);

export const requestMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.REQUEST),
  payload: z.object({
    requestId: z.string(),
  }).and(requestPayloadSchema),
});

export const responseMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.RESPONSE),
  payload: z.object({
    requestId: z.string(),
  }).and(responsePayloadSchema),
});

export const pingMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PING),
  payload: z.object({
    timestamp: z.number(),
  }),
});

export const pongMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PONG),
  payload: z.object({
    timestamp: z.number(),
  }),
});

export const roomUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.ROOM_UPDATE),
  payload: z.object({
    roomId: z.string(),
    players: z.array(z.object({
      id: z.string(),
      name: z.string(),
      isReady: z.boolean(),
      currentShipId: z.string().nullable(),
    })),
  }),
});

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
    type: z.literal(WS_MESSAGE_TYPES.DRAWING_ADD),
    payload: z.object({
      playerId: z.string(),
      element: z.object({
        type: z.enum(['path', 'line', 'arrow', 'rect', 'circle']),
        color: z.string(),
        lineWidth: z.number(),
        path: z.string().optional(),
        x1: z.number().optional(),
        y1: z.number().optional(),
        x2: z.number().optional(),
        y2: z.number().optional(),
        cx: z.number().optional(),
        cy: z.number().optional(),
        radius: z.number().optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.DRAWING_CLEAR),
    payload: z.object({
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.DRAWING_SYNC),
    payload: z.object({
      elements: z.array(z.object({
        type: z.enum(['path', 'line', 'arrow', 'rect', 'circle']),
        color: z.string(),
        lineWidth: z.number(),
        path: z.string().optional(),
        x1: z.number().optional(),
        y1: z.number().optional(),
        x2: z.number().optional(),
        y2: z.number().optional(),
        cx: z.number().optional(),
        cy: z.number().optional(),
        radius: z.number().optional(),
      })),
    }),
  }),
  z.object({
    type: z.literal(WS_MESSAGE_TYPES.CHAT_MESSAGE),
    payload: z.object({
      senderId: z.string(),
      senderName: z.string(),
      content: z.string(),
      timestamp: z.number(),
    }),
  }),
  pingMessageSchema,
  pongMessageSchema,
  roomUpdateMessageSchema,
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



// Extended wsMessageSchema that includes REQUEST and RESPONSE types
export const wsMessageSchemaExtended = z.discriminatedUnion('type', [
  ...wsMessageSchema.options,
  requestMessageSchema,
  responseMessageSchema,
]);
