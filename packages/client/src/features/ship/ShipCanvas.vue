<template>
  <div class="ship-canvas-container">
    <canvas ref="canvasRef"></canvas>
    <div class="ship-ui-layer">
      <slot name="ui"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Application, Container } from 'pixi.js'
import { useShipStore } from '@/stores/useShipStore'
import { ShipToken } from './ShipToken'
import { ShieldOverlay } from './ShieldOverlay'
import type { ICombatOverlay } from './CombatOverlay'

interface Props {
  width?: number
  height?: number
  backgroundColor?: number
  showShields?: boolean
  showMovementPaths?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 1920,
  height: 1080,
  backgroundColor: 0x1a1a2e,
  showShields: true,
  showMovementPaths: true
})

const emit = defineEmits<{
  shipClick: [shipId: string]
  shipRightClick: [shipId: string, x: number, y: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const shipStore = useShipStore()

let app: Application | null = null

const shipContainer = new Container()
const shipTokens = new Map<string, ShipToken>()
const shieldOverlays = new Map<string, ShieldOverlay>()

let combatOverlay: ICombatOverlay | null = null

async function initPixi(): Promise<void> {
  if (!canvasRef.value) return

  app = new Application()

  await app.init({
    canvas: canvasRef.value,
    width: props.width,
    height: props.height,
    backgroundColor: props.backgroundColor,
    antialias: true,
    resolution: window.devicePixelRatio || 1
  })

  app.stage.addChild(shipContainer)

  setupInteraction()
}

function setupInteraction(): void {
  if (!app) return

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  app.stage.on('pointertap', (e) => {
    const hit = e.target
    if (hit && 'shipId' in hit) {
      emit('shipClick', (hit as any).shipId)
    }
  })

  app.stage.on('pointerright', (e) => {
    const hit = e.target
    const shipId = hit && 'shipId' in hit ? (hit as any).shipId : null
    emit('shipRightClick', shipId ?? '', e.global.x, e.global.y)
  })
}

function createShipToken(shipId: string): void {
  const ship = shipStore.ships.get(shipId)
  const config = shipStore.shipConfigs.get(shipId)

  if (!ship) return

  const token = new ShipToken(shipId, {
    width: config?.width,
    height: config?.height,
    anchorX: config?.anchorX,
    anchorY: config?.anchorY
  })

  token.update(ship)
  shipContainer.addChild(token)
  shipTokens.set(shipId, token)

  if (props.showShields) {
    createShieldOverlay(shipId)
  }
}

function createShieldOverlay(shipId: string): void {
  const ship = shipStore.ships.get(shipId)
  if (!ship) return

  const overlay = new ShieldOverlay({
    frontColor: shipStore.shieldConfig.frontColor,
    fullColor: shipStore.shieldConfig.fullColor,
    lowEfficiencyColor: shipStore.shieldConfig.lowEfficiencyColor,
    normalEfficiencyColor: shipStore.shieldConfig.normalEfficiencyColor,
    highEfficiencyColor: shipStore.shieldConfig.highEfficiencyColor,
    efficiencyThreshold: shipStore.shieldConfig.efficiencyThreshold
  })

  overlay.update(ship.shield, ship.heading)
  shipContainer.addChild(overlay)
  shieldOverlays.set(shipId, overlay)
}

function updateShipToken(shipId: string): void {
  const ship = shipStore.ships.get(shipId)
  const token = shipTokens.get(shipId)
  const shield = shieldOverlays.get(shipId)

  if (ship && token) {
    token.update(ship)
  }

  if (ship && shield) {
    shield.update(ship.shield, ship.heading)
  }
}

function removeShipToken(shipId: string): void {
  const token = shipTokens.get(shipId)
  const shield = shieldOverlays.get(shipId)

  if (token) {
    shipContainer.removeChild(token)
    token.destroy()
    shipTokens.delete(shipId)
  }

  if (shield) {
    shipContainer.removeChild(shield)
    shield.destroy()
    shieldOverlays.delete(shipId)
  }
}

function updateCombatOverlay(combatData: any): void {
  if (combatOverlay) {
    combatOverlay.update(combatData)
  }
}

watch(() => Array.from(shipStore.ships.keys()), (newShips, oldShips) => {
  const added = newShips.filter(id => !oldShips?.includes(id))
  const removed = oldShips?.filter(id => !newShips.includes(id)) || []
  const updated = newShips.filter(id => !added.includes(id))

  added.forEach((id: string) => createShipToken(id))
  removed.forEach((id: string) => removeShipToken(id))
  updated.forEach((id: string) => updateShipToken(id))
}, { deep: true })

function registerCombatOverlay(overlay: ICombatOverlay): void {
  combatOverlay = overlay
}

function getCombatOverlay(): ICombatOverlay | null {
  return combatOverlay
}

onMounted(async () => {
  await initPixi()

  shipStore.ships.forEach((_, shipId: string) => {
    createShipToken(shipId)
  })
})

onBeforeUnmount(() => {
  app?.destroy(true)
  shipTokens.forEach(token => token.destroy())
  shieldOverlays.forEach(overlay => overlay.destroy())
})

defineExpose({
  registerCombatOverlay,
  getCombatOverlay,
  updateCombatOverlay
})
</script>

<style scoped>
.ship-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.ship-canvas-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.ship-ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.ship-ui-layer > * {
  pointer-events: auto;
}
</style>
