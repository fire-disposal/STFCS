import type { ExplosionData, ArmorQuadrant } from '@vt/shared'

export interface HitMarker {
  id: string
  position: { x: number; y: number }
  quadrant: ArmorQuadrant
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
  explosions: ExplosionData[]
}

export interface ICombatOverlay {
  update(data: CombatState): void
  showHitMarker(hit: HitMarker): void
  showExplosion(explosion: ExplosionData): void
  showWeaponArc(arc: WeaponArc): void
  clear(): void
  setVisible(visible: boolean): void
}

export class CombatOverlay implements ICombatOverlay {
  private state: CombatState = {
    activeWeapons: [],
    recentHits: [],
    explosions: []
  }

  private visible = true

  private hitMarkerDuration = 2000
  private explosionDuration = 1000

  update(data: CombatState): void {
    this.state = data

    const now = Date.now()
    this.state.recentHits = this.state.recentHits.filter(
      hit => now - hit.timestamp < this.hitMarkerDuration
    )
    this.state.explosions = this.state.explosions.filter(
      exp => now - exp.timestamp < this.explosionDuration
    )
  }

  showHitMarker(hit: HitMarker): void {
    const existingIndex = this.state.recentHits.findIndex(h => h.id === hit.id)
    if (existingIndex >= 0) {
      this.state.recentHits[existingIndex] = hit
    } else {
      this.state.recentHits.push(hit)
    }
  }

  showExplosion(explosion: ExplosionData): void {
    const existingIndex = this.state.explosions.findIndex(e => e.id === explosion.id)
    if (existingIndex >= 0) {
      this.state.explosions[existingIndex] = explosion
    } else {
      this.state.explosions.push(explosion)
    }
  }

  showWeaponArc(arc: WeaponArc): void {
    const existingIndex = this.state.activeWeapons.findIndex(w => w.weaponId === arc.weaponId)
    if (existingIndex >= 0) {
      this.state.activeWeapons[existingIndex] = arc
    } else {
      this.state.activeWeapons.push(arc)
    }
  }

  clear(): void {
    this.state = {
      activeWeapons: [],
      recentHits: [],
      explosions: []
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
  }

  isVisible(): boolean {
    return this.visible
  }

  getState(): CombatState {
    return this.state
  }

  setHitMarkerDuration(duration: number): void {
    this.hitMarkerDuration = duration
  }

  setExplosionDuration(duration: number): void {
    this.explosionDuration = duration
  }
}

export function createCombatOverlay(): ICombatOverlay {
  return new CombatOverlay()
}
