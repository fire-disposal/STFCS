/**
 * 统一 Zod Schema 和类型定义 (Single Source of Truth)
 *
 * 原则：
 * 1. 所有类型从 Zod schema 推导
 * 2. 避免重复定义
 * 3. 保持类型名称一致性
 */

import { z } from 'zod';

// ==================== 协议版本 ====================
export const PROTOCOL_VERSION = '1.0.0' as const;

// ==================== 基础类型 Schema ====================
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// ==================== 玩家相关 Schema ====================
export const PlayerInfoSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  joinedAt: z.number(),
  isActive: z.boolean(),
  isDMMode: z.boolean(),
});

export const PlayerGameStateSchema = z.object({
  currentShipId: z.string().nullable(),
  hasActivatedFluxVenting: z.boolean(),
  readyForNextPhase: z.boolean(),
  selectedWeapons: z.array(z.string()),
});

// ==================== 舰船相关 Schema ====================
export const ArmorQuadrantSchema = z.enum([
  'FRONT_TOP',
  'FRONT_BOTTOM',
  'LEFT_TOP',
  'LEFT_BOTTOM',
  'RIGHT_TOP',
  'RIGHT_BOTTOM',
]);

export const ArmorStateSchema = z.object({
  quadrants: z.record(ArmorQuadrantSchema, z.number().min(0)),
  maxArmor: z.number().min(0),
  maxQuadArmor: z.number().min(0),
});

export const FluxTypeSchema = z.enum(['soft', 'hard']);

export const FluxStateSchema = z.object({
  current: z.number().min(0),
  capacity: z.number().min(0),
  dissipation: z.number().min(0),
  softFlux: z.number().min(0),
  hardFlux: z.number().min(0),
});

export const FluxOverloadStateSchema = z.enum(['normal', 'venting', 'overloaded']);

export const ShieldSpecSchema = z.object({
  type: z.enum(['front', 'full']),
  radius: z.number().min(0),
  centerOffset: PointSchema,
  coverageAngle: z.number().min(0).max(360),
  efficiency: z.number().min(0).max(1),
  maintenanceCost: z.number().min(0),
  active: z.boolean(),
  current: z.number().min(0),
  max: z.number().min(0),
});

export const ShipStatusSchema = z.object({
  id: z.string(),
  hull: z.object({
    current: z.number().min(0),
    max: z.number().min(0),
  }),
  armor: ArmorStateSchema,
  flux: FluxStateSchema,
  fluxState: FluxOverloadStateSchema,
  shield: ShieldSpecSchema,
  position: PointSchema,
  heading: z.number(),
  speed: z.number().min(0),
  maneuverability: z.number().min(0),
  disabled: z.boolean(),
  owner: z.string().optional(),
  actionsPerTurn: z.number().min(0),
  remainingActions: z.number().min(0),
});

export const ShipMovementPhaseSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const ShipMovementTypeSchema = z.enum(['straight', 'strafe', 'rotate']);

export const ShipMovementSchema = z.object({
  shipId: z.string(),
  phase: ShipMovementPhaseSchema,
  type: ShipMovementTypeSchema,
  distance: z.number().optional(),
  angle: z.number().optional(),
  newX: z.number(),
  newY: z.number(),
  newHeading: z.number(),
  timestamp: z.number(),
});

// ==================== 武器相关 Schema ====================
export const WeaponTypeSchema = z.enum(['ballistic', 'energy', 'missile']);
export const WeaponMountTypeSchema = z.enum(['fixed', 'turret']);

export const WeaponSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: WeaponTypeSchema,
  damage: z.number().min(0),
  range: z.number().min(0),
  arc: z.number().min(0).max(360),
  cooldown: z.number().min(0),
  fluxCost: z.number().min(0),
});

export const WeaponMountSchema = z.object({
  id: z.string(),
  weaponId: z.string(),
  mountType: WeaponMountTypeSchema,
  position: PointSchema,
  facing: z.number(),
  arcMin: z.number(),
  arcMax: z.number(),
});

export const AttackCommandSchema = z.object({
  sourceShipId: z.string(),
  targetShipId: z.string(),
  weaponMountId: z.string(),
  timestamp: z.number(),
});

// ==================== 战斗相关 Schema ====================
export const ExplosionDataSchema = z.object({
  id: z.string(),
  position: PointSchema,
  radius: z.number().min(0),
  damage: z.number().min(0),
  sourceShipId: z.string().optional(),
  targetShipId: z.string().optional(),
  hitQuadrant: ArmorQuadrantSchema.optional(),
  timestamp: z.number(),
});

export const CombatResultSchema = z.object({
  hit: z.boolean(),
  damage: z.number().min(0).optional(),
  shieldAbsorbed: z.number().min(0),
  armorReduced: z.number().min(0),
  hullDamage: z.number().min(0),
  hitQuadrant: ArmorQuadrantSchema.optional(),
  softFluxGenerated: z.number().min(0),
  hardFluxGenerated: z.number().min(0),
  sourceShipId: z.string(),
  targetShipId: z.string(),
  timestamp: z.number(),
});

// ==================== 地图与 Token Schema ====================
export const MapConfigSchema = z.object({
  id: z.string(),
  width: z.number().min(1),
  height: z.number().min(1),
  name: z.string().min(1),
});

export const TokenTypeSchema = z.enum(['ship', 'station', 'asteroid']);

// 阵营 ID Schema（提前定义，供 TokenInfoSchema 使用）
export const FactionIdSchema = z.string().min(1);

export const UnitTurnStateSchema = z.enum([
  'waiting',
  'active',
  'moved',
  'acted',
  'ended',
]);

export const TokenInfoSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  position: PointSchema,
  heading: z.number(),
  type: TokenTypeSchema,
  size: z.number().min(0),
  scale: z.number(),
  assetUrl: z.string().optional(),
  turnState: UnitTurnStateSchema,
  maxMovement: z.number(),
  remainingMovement: z.number(),
  actionsPerTurn: z.number(),
  remainingActions: z.number(),
  layer: z.number(),
  collisionRadius: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  // 阵营归属（可选，默认从 ownerId 继承）
  faction: FactionIdSchema.optional(),
  // 控制玩家ID（用于多玩家模式，区分哪个玩家可以操作此Token）
  controllingPlayerId: z.string().optional(),
  // 是否为敌方单位（DM控制）
  isEnemy: z.boolean().optional(),
});


export const StarNodeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  position: PointSchema,
  spectralType: z.string().min(1).max(8).default('G'),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  updatedAt: z.number(),
});

export const PlanetNodeSchema = z.object({
  id: z.string(),
  starId: z.string(),
  name: z.string().min(1),
  orbitIndex: z.number().int().min(1),
  kind: z.enum(['terrestrial', 'gas_giant', 'ice_giant', 'dwarf', 'station']).default('terrestrial'),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  updatedAt: z.number(),
});

export const StarSystemSchema = z.object({
  starId: z.string(),
  planets: z.record(z.string(), PlanetNodeSchema),
  updatedAt: z.number(),
});

export const StarMapSchema = z.object({
  stars: z.record(z.string(), StarNodeSchema),
  systems: z.record(z.string(), StarSystemSchema),
});

export const MapSnapshotSchema = z.object({
  version: z.string(),
  savedAt: z.number(),
  map: MapConfigSchema,
  tokens: z.array(TokenInfoSchema),
  starMap: StarMapSchema,
});

// ==================== 相机相关 Schema ====================
export const CameraStateSchema = z.object({
  centerX: z.number(),
  centerY: z.number(),
  zoom: z.number().min(0.1),
  rotation: z.number(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
});

export const PlayerCameraSchema = CameraStateSchema.extend({
  playerId: z.string(),
  playerName: z.string(),
  timestamp: z.number(),
});

export const CameraUpdateCommandSchema = z.object({
  centerX: z.number().optional(),
  centerY: z.number().optional(),
  zoom: z.number().optional(),
  rotation: z.number().optional(),
});

export const CameraConfigSchema = z.object({
  centerX: z.number(),
  centerY: z.number(),
  zoom: z.number(),
  rotation: z.number(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
});

// ==================== 阵营系统 Schema ====================
export const FactionDefinitionSchema = z.object({
  id: FactionIdSchema,
  name: z.string().min(1),
  nameLocalized: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1),
  description: z.string(),
});

export const PlayerFactionInfoSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  faction: FactionIdSchema,
  hasEndedTurn: z.boolean(),
  endedAt: z.number().optional(),
});

// ==================== 阵营回合系统 Schema ====================
export const FactionTurnPhaseSchema = z.enum(['action', 'transition']);

export const TurnHistoryEntrySchema = z.object({
  roundNumber: z.number().int().min(1),
  faction: FactionIdSchema,
  startedAt: z.number(),
  endedAt: z.number().optional(),
  endedPlayers: z.array(z.string()),
});

export const FactionTurnStateSchema = z.object({
  roundNumber: z.number().int().min(1),
  currentFaction: FactionIdSchema,
  factionOrder: z.array(FactionIdSchema),
  currentFactionIndex: z.number().int().min(0),
  phase: FactionTurnPhaseSchema,
  playerEndStatus: z.record(FactionIdSchema, z.array(PlayerFactionInfoSchema)),
  debounceStartTime: z.number().optional(),
  history: z.array(TurnHistoryEntrySchema),
});

export const FactionTurnInitParamsSchema = z.object({
  factions: z.array(FactionIdSchema).min(1),
  players: z.array(PlayerFactionInfoSchema),
  roundNumber: z.number().int().min(1).optional(),
});

// ==================== 类型推导 (从 Schema 推导) ====================
export type Point = z.infer<typeof PointSchema>;
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
export type PlayerGameState = z.infer<typeof PlayerGameStateSchema>;
export type ArmorQuadrant = z.infer<typeof ArmorQuadrantSchema>;
export type ArmorState = z.infer<typeof ArmorStateSchema>;
export type FluxType = z.infer<typeof FluxTypeSchema>;
export type FluxState = z.infer<typeof FluxStateSchema>;
export type FluxOverloadState = z.infer<typeof FluxOverloadStateSchema>;
export type ShieldSpec = z.infer<typeof ShieldSpecSchema>;
export type ShipStatus = z.infer<typeof ShipStatusSchema>;
export type ShipMovement = z.infer<typeof ShipMovementSchema>;
export type WeaponType = z.infer<typeof WeaponTypeSchema>;
export type WeaponMountType = z.infer<typeof WeaponMountTypeSchema>;
export type WeaponSpec = z.infer<typeof WeaponSpecSchema>;
export type WeaponMount = z.infer<typeof WeaponMountSchema>;
export type AttackCommand = z.infer<typeof AttackCommandSchema>;
export type ExplosionData = z.infer<typeof ExplosionDataSchema>;
export type CombatResult = z.infer<typeof CombatResultSchema>;
export type MapConfig = z.infer<typeof MapConfigSchema>;
export type TokenType = z.infer<typeof TokenTypeSchema>;
export type UnitTurnState = z.infer<typeof UnitTurnStateSchema>;
export type TokenInfo = z.infer<typeof TokenInfoSchema>;
export type StarNode = z.infer<typeof StarNodeSchema>;
export type PlanetNode = z.infer<typeof PlanetNodeSchema>;
export type StarSystem = z.infer<typeof StarSystemSchema>;
export type StarMap = z.infer<typeof StarMapSchema>;
export type MapSnapshot = z.infer<typeof MapSnapshotSchema>;
export type CameraState = z.infer<typeof CameraStateSchema>;
export type PlayerCamera = z.infer<typeof PlayerCameraSchema>;
export type CameraUpdateCommand = z.infer<typeof CameraUpdateCommandSchema>;
export type CameraConfig = z.infer<typeof CameraConfigSchema>;
// 阵营系统类型
export type FactionId = z.infer<typeof FactionIdSchema>;
export type FactionDefinition = z.infer<typeof FactionDefinitionSchema>;
export type PlayerFactionInfo = z.infer<typeof PlayerFactionInfoSchema>;
export type FactionTurnPhase = z.infer<typeof FactionTurnPhaseSchema>;
export type TurnHistoryEntry = z.infer<typeof TurnHistoryEntrySchema>;
export type FactionTurnState = z.infer<typeof FactionTurnStateSchema>;
export type FactionTurnInitParams = z.infer<typeof FactionTurnInitParamsSchema>;

// ==================== 房间系统 Schema ====================
export const RoomPhaseSchema = z.enum(['lobby', 'deployment', 'playing', 'paused', 'ended']);

export const RoomInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().nullable(),
  maxPlayers: z.number().min(2).max(16),
  isPrivate: z.boolean(),
  hasPassword: z.boolean(),
  phase: RoomPhaseSchema,
  playerCount: z.number().min(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const RoomStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().nullable(),
  maxPlayers: z.number().min(2).max(16),
  isPrivate: z.boolean(),
  phase: RoomPhaseSchema,
  players: z.array(PlayerInfoSchema),
  dm: z.object({
    isDMMode: z.boolean(),
    players: z.array(z.object({
      id: z.string(),
      name: z.string(),
      isDMMode: z.boolean(),
    })),
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type RoomPhase = z.infer<typeof RoomPhaseSchema>;
export type RoomInfo = z.infer<typeof RoomInfoSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
