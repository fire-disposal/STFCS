import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShipStatus, FluxOverloadState } from '@vt/shared'

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

export interface MovementPathConfig {
  phase1Color: string
  phase2Color: string
  phase3Color: string
  arrowSize: number
  lineWidth: number
}

export const useShipStore = defineStore('ship', () => {
  const ships = ref<Map<string, ShipStatus>>(new Map())
  const selectedShipId = ref<string | null>(null)
  const shipConfigs = ref<Map<string, ShipTokenConfig>>(new Map())

  const shieldConfig = ref<ShieldOverlayConfig>({
    frontColor: '#4A9EFF',
    fullColor: '#88FF88',
    lowEfficiencyColor: '#FF4444',
    normalEfficiencyColor: '#FFFF44',
    highEfficiencyColor: '#44FF44',
    efficiencyThreshold: 0.75
  })

  const movementConfig = ref<MovementPathConfig>({
    phase1Color: '#00FFFF',
    phase2Color: '#FF00FF',
    phase3Color: '#FFFF00',
    arrowSize: 12,
    lineWidth: 3
  })

  const selectedShip = computed(() => {
    if (!selectedShipId.value || !ships.value.has(selectedShipId.value)) {
      return null
    }
    return ships.value.get(selectedShipId.value) || null
  })

  function registerShip(id: string, status: ShipStatus, config?: Partial<ShipTokenConfig>) {
    ships.value.set(id, status)
    if (config) {
      shipConfigs.value.set(id, {
        texture: config.texture,
        width: config.width ?? 64,
        height: config.height ?? 32,
        anchorX: config.anchorX ?? 0.5,
        anchorY: config.anchorY ?? 0.5
      })
    }
  }

  function updateShip(id: string, updates: Partial<ShipStatus>) {
    const ship = ships.value.get(id)
    if (ship) {
      ships.value.set(id, { ...ship, ...updates })
    }
  }

  function removeShip(id: string) {
    ships.value.delete(id)
    shipConfigs.value.delete(id)
    if (selectedShipId.value === id) {
      selectedShipId.value = null
    }
  }

  function selectShip(id: string | null) {
    selectedShipId.value = id
  }

  function updateShieldConfig(config: Partial<ShieldOverlayConfig>) {
    shieldConfig.value = { ...shieldConfig.value, ...config }
  }

  function updateMovementConfig(config: Partial<MovementPathConfig>) {
    movementConfig.value = { ...movementConfig.value, ...config }
  }

  function getFluxOverloadState(flux: { current: number; capacity: number }): FluxOverloadState {
    const ratio = flux.current / flux.capacity
    if (ratio >= 1.0) return 'overloaded'
    if (ratio >= 0.75) return 'venting'
    return 'normal'
  }

  return {
    ships,
    selectedShipId,
    selectedShip,
    shipConfigs,
    shieldConfig,
    movementConfig,
    registerShip,
    updateShip,
    removeShip,
    selectShip,
    updateShieldConfig,
    updateMovementConfig,
    getFluxOverloadState
  }
})
