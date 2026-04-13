export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export type ServerGamePhase = 'DEPLOYMENT' | 'PLAYER_TURN' | 'DM_TURN' | 'END_PHASE';

export interface Transform {
  x: number;
  y: number;
  heading: number;
}

export interface WeaponSlot {
  weaponId: string;
  type: 'kinetic' | 'high_explosive' | 'energy' | 'fragmentation';
  cooldown: number;
  damage: number;
  range: number;
  arc: number;
  angle: number;
}

export interface PlayerState {
  sessionId: string;
  shortId: number;
  role: 'dm' | 'player';
  name: string;
  nickname?: string;
  avatar?: string;
  isReady: boolean;
  connected: boolean;
  pingMs: number;
  jitterMs: number;
  connectionQuality: ConnectionQuality;
  [key: string]: unknown;
}

export interface ShipState {
  id: string;
  ownerId: string;
  faction: 'player' | 'dm';
  hullType: string;
  transform: Transform;
  hullCurrent: number;
  hullMax: number;
  armorCurrent: number[];
  armorMax: number[];
  fluxMax: number;
  fluxDissipation: number;
  fluxHard: number;
  fluxSoft: number;
  isShieldUp: boolean;
  shieldOrientation: number;
  shieldArc: number;
  isOverloaded: boolean;
  overloadTime: number;
  maxSpeed: number;
  maxTurnRate: number;
  acceleration: number;
  movePhaseAX: number;
  movePhaseAStrafe: number;
  movePhaseBX: number;
  movePhaseBStrafe: number;
  turnAngle: number;
  weapons: Map<string, WeaponSlot>;
  hasMoved: boolean;
  hasFired: boolean;
  [key: string]: unknown;
}

export interface GameRoomState {
  currentPhase: ServerGamePhase;
  turnCount: number;
  players: Map<string, PlayerState>;
  ships: Map<string, ShipState>;
  activeFaction: 'player' | 'dm';
  mapWidth: number;
  mapHeight: number;
  [key: string]: unknown;
}
