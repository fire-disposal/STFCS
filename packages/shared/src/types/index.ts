export interface PlayerInfo {
  id: string;
  name: string;
  joinedAt: number;
}

export type ArmorQuadrant = 'front_left' | 'front_right' | 'left' | 'right' | 'rear_left' | 'rear_right';

export interface ArmorState {
  quadrants: Record<ArmorQuadrant, number>;
  maxArmor: number;
}

export type FluxType = 'soft' | 'hard';

export interface FluxState {
  current: number;
  capacity: number;
  dissipation: number;
  softFlux: number;
  hardFlux: number;
}

export type FluxOverloadState = 'normal' | 'venting' | 'overloaded';

export interface ShieldSpec {
  type: 'front' | 'full';
  radius: number;
  centerOffset: { x: number; y: number };
  coverageAngle: number;
  efficiency: number;
  maintenanceCost: number;
  active: boolean;
}

export interface ShipStatus {
  id: string;
  hull: { current: number; max: number };
  armor: ArmorState;
  flux: FluxState;
  fluxState: FluxOverloadState;
  shield: ShieldSpec;
  position: { x: number; y: number };
  heading: number;
  speed: number;
  maneuverability: number;
  disabled: boolean;
}

export interface ShipMovement {
  shipId: string;
  phase: 1 | 2 | 3;
  type: 'straight' | 'strafe' | 'rotate';
  distance?: number;
  angle?: number;
  newX: number;
  newY: number;
  newHeading: number;
  timestamp: number;
}

export interface ExplosionData {
  id: string;
  position: { x: number; y: number };
  radius: number;
  damage: number;
  sourceShipId?: string;
  targetShipId?: string;
  hitQuadrant?: ArmorQuadrant;
  timestamp: number;
}

export interface MapConfig {
  id: string;
  width: number;
  height: number;
  name: string;
}

export interface TokenInfo {
  id: string;
  ownerId: string;
  position: { x: number; y: number };
  heading: number;
  type: 'ship' | 'station' | 'asteroid';
  size: number;
}

export interface CameraState {
  centerX: number;
  centerY: number;
  zoom: number;
  rotation: number;
}

export type WeaponType = 'ballistic' | 'energy' | 'missile';
export type WeaponMountType = 'fixed' | 'turret';

export interface WeaponSpec {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  range: number;
  arc: number;
  cooldown: number;
  fluxCost: number;
}

export interface WeaponMount {
  id: string;
  weaponId: string;
  mountType: WeaponMountType;
  position: { x: number; y: number };
  facing: number;
  arcMin: number;
  arcMax: number;
}

export interface AttackCommand {
  sourceShipId: string;
  targetShipId: string;
  weaponMountId: string;
  timestamp: number;
}

export interface CombatResult {
  hit: boolean;
  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  hitQuadrant?: ArmorQuadrant;
  softFluxGenerated: number;
  hardFluxGenerated: number;
  sourceShipId: string;
  targetShipId: string;
  timestamp: number;
}
