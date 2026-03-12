export interface ShipTokenOptions {
  texture?: any
  width?: number
  height?: number
  anchorX?: number
  anchorY?: number
  showHeadingIndicator?: boolean
}

export interface ShipTokenConfig {
  texture?: string
  width: number
  height: number
  anchorX: number
  anchorY: number
}

export interface ShieldOverlayConfig {
  frontColor: string
  fullColor: string
  lowEfficiencyColor: string
  normalEfficiencyColor: string
  highEfficiencyColor: string
  efficiencyThreshold: number
}

export interface ShieldOverlayOptions {
  frontColor?: string
  fullColor?: string
  lowEfficiencyColor?: string
  normalEfficiencyColor?: string
  highEfficiencyColor?: string
  efficiencyThreshold?: number
  opacity?: number
}

export interface MovementPathConfig {
  phase1Color: string
  phase2Color: string
  phase3Color: string
  arrowSize: number
  lineWidth: number
}

export interface MovementPathOptions {
  phase1Color?: string
  phase2Color?: string
  phase3Color?: string
  arrowSize?: number
  lineWidth?: number
  opacity?: number
}

export interface MovementPhase {
  phase: 1 | 2 | 3
  type: 'straight' | 'strafe' | 'rotate'
  distance?: number
  angle?: number
  startX: number
  startY: number
  endX: number
  endY: number
  startHeading: number
  endHeading: number
}

export interface HitMarker {
  id: string
  position: { x: number; y: number }
  quadrant: string
  damage: number
  timestamp: number
  duration: number
}

export interface WeaponArc {
  shipId: string
  weaponId: string
  arcStart: number
  arcEnd: number
  range: number
  active: boolean
}

export interface CombatState {
  activeWeapons: WeaponArc[]
  recentHits: HitMarker[]
  explosions: any[]
}

export interface ICombatOverlay {
  update(data: CombatState): void
  showHitMarker(hit: HitMarker): void
  showExplosion(explosion: any): void
  showWeaponArc(arc: WeaponArc): void
  clear(): void
  setVisible(visible: boolean): void
}
