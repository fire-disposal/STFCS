import { Container } from 'pixi.js'
import { useCombatStore } from '@/stores/useCombatStore'
import { DamageNumbers } from './DamageNumbers'
import { ExplosionEffect } from './ExplosionEffect'
import { WeaponRangeDisplay } from './WeaponRangeDisplay'
import { FiringArcOverlay } from './FiringArcOverlay'
import type { ICombatOverlay, CombatState, HitMarker, WeaponArc } from '../ship/types'
import type { ExplosionData } from '@vt/shared'

export interface CombatOverlayOptions {
  autoCleanup?: boolean
  cleanupInterval?: number
}

export class CombatOverlayImpl extends Container implements ICombatOverlay {
  private damageNumbers: DamageNumbers
  private explosionEffect: ExplosionEffect
  private weaponRange: WeaponRangeDisplay
  private firingArc: FiringArcOverlay
  private combatStore = useCombatStore()

  private _visible = true
  private autoCleanup = true
  private cleanupInterval = 1000
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: CombatOverlayOptions = {}) {
    super()
    this.autoCleanup = options.autoCleanup ?? true
    this.cleanupInterval = options.cleanupInterval ?? 1000

    this.damageNumbers = new DamageNumbers()
    this.explosionEffect = new ExplosionEffect()
    this.weaponRange = new WeaponRangeDisplay()
    this.firingArc = new FiringArcOverlay()

    this.addChild(this.damageNumbers)
    this.addChild(this.explosionEffect)
    this.addChild(this.weaponRange)
    this.addChild(this.firingArc)

    if (this.autoCleanup) {
      this.startCleanup()
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.combatStore.cleanup()
    }, this.cleanupInterval)
  }

  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  update(data: CombatState): void {
    data.activeWeapons.forEach(arc => {
      this.showWeaponArc({
        shipId: arc.shipId,
        weaponId: arc.weaponId,
        type: 'arc' as any,
        range: arc.range,
        arcStart: arc.arcStart,
        arcEnd: arc.arcEnd,
        damage: 0,
        valid: arc.active,
        active: arc.active
      })
    })

    data.explosions.forEach(exp => {
      this.showExplosion(exp)
    })
  }

  showHitMarker(hit: HitMarker): void {
    this.combatStore.showDamageNumber(hit.damage, hit.position, hit.damage >= 50)
  }

  showExplosion(explosion: ExplosionData): void {
    this.combatStore.showExplosion(explosion)
    this.explosionEffect.play(explosion)
  }

  showWeaponArc(arc: WeaponArc & { type?: string; damage?: number; valid?: boolean }): void {
    this.combatStore.showWeaponArc(arc as any)

    const arcType = (arc as any).type || 'arc'
    if (arcType === 'arc') {
      this.firingArc.show({
        shipId: arc.shipId,
        weaponId: arc.weaponId,
        arcStart: arc.arcStart,
        arcEnd: arc.arcEnd,
        range: arc.range,
        valid: (arc as any).valid ?? true
      })
    } else {
      this.weaponRange.show({
        shipId: arc.shipId,
        weaponId: arc.weaponId,
        range: arc.range,
        valid: (arc as any).valid ?? true
      })
    }
  }

  hideWeaponArc(weaponId: string): void {
    this.combatStore.hideWeaponArc(weaponId)
    this.firingArc.hide(weaponId)
    this.weaponRange.hide(weaponId)
  }

  hideAllWeaponArcs(): void {
    this.combatStore.hideAllWeaponArcs()
    this.firingArc.hideAll()
    this.weaponRange.hideAll()
  }

  showDamageNumber(damage: number, position: { x: number; y: number }, isCritical: boolean = false): string {
    return this.combatStore.showDamageNumber(damage, position, isCritical)
  }

  clear(): void {
    this.combatStore.clearDamageNumbers()
    this.combatStore.clearExplosions()
    this.combatStore.hideAllWeaponArcs()

    this.damageNumbers.clear()
    this.explosionEffect.clear()
    this.firingArc.hideAll()
    this.weaponRange.hideAll()
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.firingArc.visible = visible
    this.weaponRange.visible = visible
    this.damageNumbers.visible = visible
    this.explosionEffect.visible = visible
  }

  isVisible(): boolean {
    return this._visible
  }

  getState(): CombatState {
    return {
      activeWeapons: this.combatStore.state.activeWeaponArcs as any,
      recentHits: this.combatStore.recentDamageNumbers.map(dn => ({
        id: dn.id,
        position: dn.position,
        quadrant: 'front' as any,
        damage: dn.value,
        timestamp: dn.timestamp,
        duration: dn.duration
      })),
      explosions: this.combatStore.activeExplosions
    }
  }

  setHitMarkerDuration(duration: number): void {
    this.damageNumbers.setDuration(duration)
  }

  setExplosionDuration(duration: number): void {
    this.explosionEffect.setDuration(duration)
  }

  destroy(): void {
    this.stopCleanup()
    this.damageNumbers.destroy()
    this.explosionEffect.destroy()
    this.weaponRange.destroy()
    this.firingArc.destroy()
    super.destroy()
  }
}

export function createCombatOverlay(options?: CombatOverlayOptions): ICombatOverlay {
  return new CombatOverlayImpl(options)
}
