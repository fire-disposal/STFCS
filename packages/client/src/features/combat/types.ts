export interface CombatEffect {
  id: string
  type: 'explosion' | 'hit' | 'miss' | 'shield'
  position: { x: number; y: number }
  duration: number
  data?: Record<string, unknown>
}

export interface DamageDisplay {
  value: number
  position: { x: number; y: number }
  isCritical: boolean
  style: DamageStyle
}

export interface DamageStyle {
  color: number
  fontSize: number
  yOffset: number
  duration: number
}

export interface WeaponArcDisplay {
  weaponId: string
  shipId: string
  type: 'arc' | 'circle'
  range: number
  arcStart?: number
  arcEnd?: number
  valid: boolean
}

export interface CombatOverlayAPI {
  showExplosion(position: { x: number; y: number }, radius: number): void
  showDamage(value: number, position: { x: number; y: number }, isCritical: boolean): void
  showWeaponArc(arc: WeaponArcDisplay): void
  hideWeaponArc(weaponId: string): void
  clear(): void
}
