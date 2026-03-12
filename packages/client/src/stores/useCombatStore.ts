import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExplosionData } from '@vt/shared'

export interface DamageNumber {
  id: string
  value: number
  position: { x: number; y: number }
  isCritical: boolean
  timestamp: number
  duration: number
}

export interface WeaponArc {
  id: string
  shipId: string
  weaponId: string
  type: 'arc' | 'circle'
  range: number
  arcStart: number
  arcEnd: number
  damage: number
  valid: boolean
}

export interface CombatLogEntry {
  id: string
  timestamp: number
  sourceShipId: string
  targetShipId: string
  weaponId: string
  hit: boolean
  damage?: number
  hitQuadrant?: string
  isCritical: boolean
}

export interface CombatState {
  activeWeaponArcs: WeaponArc[]
  damageNumbers: DamageNumber[]
  explosions: ExplosionData[]
  combatLog: CombatLogEntry[]
}

export const useCombatStore = defineStore('combat', () => {
  const state = ref<CombatState>({
    activeWeaponArcs: [],
    damageNumbers: [],
    explosions: [],
    combatLog: []
  })

  const selectedWeaponId = ref<string | null>(null)
  const isAttacking = ref(false)
  const damageNumberDuration = 2000
  const explosionDuration = 1000

  const recentDamageNumbers = computed(() => {
    const now = Date.now()
    return state.value.damageNumbers.filter(
      dn => now - dn.timestamp < damageNumberDuration
    )
  })

  const activeExplosions = computed(() => {
    const now = Date.now()
    return state.value.explosions.filter(
      exp => now - exp.timestamp < explosionDuration
    )
  })

  function showWeaponArc(arc: WeaponArc): void {
    const existingIndex = state.value.activeWeaponArcs.findIndex(a => a.id === arc.id)
    if (existingIndex >= 0) {
      state.value.activeWeaponArcs[existingIndex] = arc
    } else {
      state.value.activeWeaponArcs.push(arc)
    }
  }

  function hideWeaponArc(arcId: string): void {
    state.value.activeWeaponArcs = state.value.activeWeaponArcs.filter(a => a.id !== arcId)
  }

  function hideAllWeaponArcs(): void {
    state.value.activeWeaponArcs = []
  }

  function showDamageNumber(damage: number, position: { x: number; y: number }, isCritical: boolean = false): string {
    const id = `damage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const damageNumber: DamageNumber = {
      id,
      value: damage,
      position: { ...position },
      isCritical,
      timestamp: Date.now(),
      duration: damageNumberDuration
    }
    state.value.damageNumbers.push(damageNumber)
    return id
  }

  function showExplosion(explosion: ExplosionData): void {
    state.value.explosions.push(explosion)
  }

  function addCombatLog(entry: Omit<CombatLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: CombatLogEntry = {
      ...entry,
      id: `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    state.value.combatLog.unshift(logEntry)

    if (state.value.combatLog.length > 100) {
      state.value.combatLog = state.value.combatLog.slice(0, 100)
    }
  }

  function handleCombatEvent(
    sourceShipId: string,
    targetShipId: string,
    weaponId: string,
    hit: boolean,
    damage?: number,
    hitQuadrant?: string,
    position?: { x: number; y: number }
  ): void {
    addCombatLog({
      sourceShipId,
      targetShipId,
      weaponId,
      hit,
      damage,
      hitQuadrant,
      isCritical: damage ? damage >= 50 : false
    })

    if (hit && damage !== undefined && position) {
      showDamageNumber(damage, position, damage >= 50)
    }
  }

  function setSelectedWeapon(weaponId: string | null): void {
    selectedWeaponId.value = weaponId
  }

  function setAttacking(attacking: boolean): void {
    isAttacking.value = attacking
  }

  function clearDamageNumbers(): void {
    state.value.damageNumbers = []
  }

  function clearExplosions(): void {
    state.value.explosions = []
  }

  function cleanup(): void {
    const now = Date.now()
    state.value.damageNumbers = state.value.damageNumbers.filter(
      dn => now - dn.timestamp < damageNumberDuration
    )
    state.value.explosions = state.value.explosions.filter(
      exp => now - exp.timestamp < explosionDuration
    )
  }

  return {
    state,
    selectedWeaponId,
    isAttacking,
    recentDamageNumbers,
    activeExplosions,
    showWeaponArc,
    hideWeaponArc,
    hideAllWeaponArcs,
    showDamageNumber,
    showExplosion,
    addCombatLog,
    handleCombatEvent,
    setSelectedWeapon,
    setAttacking,
    clearDamageNumbers,
    clearExplosions,
    cleanup
  }
})
