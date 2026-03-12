<template>
  <div ref="containerRef" class="map-canvas-container">
    <canvas ref="canvasRef"></canvas>
    <div class="map-ui-overlay">
      <slot name="overlay"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { Application, Container } from 'pixi.js'
import { useMapStore } from '@/stores/useMapStore'
import { CameraController } from './CameraController'
import { TerrainLayer } from './TerrainLayer'
import { TokenLayer } from './TokenLayer'
import { PlacementOverlay } from './PlacementOverlay'

interface Props {
  width?: number
  height?: number
  backgroundColor?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 1920,
  height: 1080,
  backgroundColor: 0x0a0a1a
})

const emit = defineEmits<{
  tokenClick: [tokenId: string]
  tokenRightClick: [tokenId: string | null, x: number, y: number]
  placementConfirm: [x: number, y: number, rotation: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const mapStore = useMapStore()

let app: Application | null = null
let cameraController: CameraController | null = null
let terrainLayer: TerrainLayer | null = null
let tokenLayer: TokenLayer | null = null
let placementOverlay: PlacementOverlay | null = null
let syncInterval: NodeJS.Timeout | null = null

const worldContainer = new Container()
const uiContainer = new Container()

async function initPixi(): Promise<void> {
  if (!canvasRef.value || !containerRef.value) return

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight

  app = new Application()

  await app.init({
    canvas: canvasRef.value,
    width: containerWidth,
    height: containerHeight,
    backgroundColor: props.backgroundColor,
    antialias: true,
    resolution: window.devicePixelRatio || 1
  })

  app.stage.addChild(worldContainer)
  app.stage.addChild(uiContainer)

  initLayers()
  initCamera()
  setupInteraction()
  
  setupResizeObserver()
}

function setupResizeObserver(): void {
  if (!app || !containerRef.value) return

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      app!.renderer.resize(width, height)
    }
  })
  
  resizeObserver.observe(containerRef.value)
}

function initLayers(): void {
  terrainLayer = new TerrainLayer(mapStore.config, {
    showGrid: mapStore.config.showGrid
  })
  worldContainer.addChild(terrainLayer)

  tokenLayer = new TokenLayer()
  worldContainer.addChild(tokenLayer)

  placementOverlay = new PlacementOverlay()
  uiContainer.addChild(placementOverlay)
}

function initCamera(): void {
  cameraController = new CameraController(worldContainer, {
    minZoom: mapStore.camera.minZoom,
    maxZoom: mapStore.camera.maxZoom,
    bounds: {
      x: 0,
      y: 0,
      width: mapStore.config.width,
      height: mapStore.config.height
    }
  })
}

function setupInteraction(): void {
  if (!app || !tokenLayer) return

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  app.stage.on('pointerdown', (e) => {
    if (e.button === 2) {
      const worldPos = cameraController!.screenToWorld(e.global.x, e.global.y)
      emit('tokenRightClick', null, worldPos.x, worldPos.y)
    }
  })

  app.stage.on('pointerright', (e) => {
    const worldPos = cameraController!.screenToWorld(e.global.x, e.global.y)
    const rotation = placementOverlay ? (placementOverlay as any).currentPreview?.rotation ?? 0 : 0

    if (mapStore.placementMode) {
      emit('placementConfirm', worldPos.x, worldPos.y, rotation)
    } else {
      emit('tokenRightClick', null, worldPos.x, worldPos.y)
    }
  })
}

function syncTokens(): void {
  if (!tokenLayer) return

  const existingTokens = tokenLayer.getAllTokens()
  const storeTokens = mapStore.tokens

  storeTokens.forEach((token, id) => {
    if (!existingTokens.has(id)) {
      tokenLayer!.addToken(token)
    } else {
      tokenLayer!.updateToken(token)
    }
  })

  existingTokens.forEach((_, id) => {
    if (!storeTokens.has(id)) {
      tokenLayer!.removeToken(id)
    }
  })

  tokenLayer.selectToken(mapStore.selectedTokenId)
}

function syncPlacement(): void {
  if (!placementOverlay) return
  placementOverlay.setPreview(mapStore.placementPreview)
}

function syncCamera(): void {
  if (!cameraController) return

  const cam = cameraController.getCamera()
  if (
    cam.x !== mapStore.camera.x ||
    cam.y !== mapStore.camera.y ||
    cam.zoom !== mapStore.camera.zoom
  ) {
    mapStore.updateCamera({
      x: cam.x,
      y: cam.y,
      zoom: cam.zoom
    })
  }
}

watch(() => Array.from(mapStore.tokens.keys()), syncTokens, { deep: true })
watch(() => mapStore.selectedTokenId, syncTokens)
watch(() => mapStore.placementPreview, syncPlacement, { deep: true })

function handleKeyDown(e: KeyboardEvent): void {
  // 检查事件目标是否为输入元素，避免在输入框中输入时触发快捷键
  if (e.target instanceof HTMLInputElement || 
      e.target instanceof HTMLTextAreaElement || 
      e.target instanceof HTMLSelectElement) {
    return
  }
  
  if (e.code === 'Escape' && mapStore.placementMode) {
    mapStore.setPlacementMode(false)
  }

  if (e.code === 'KeyG' && !e.repeat) {
    mapStore.toggleGrid()
    terrainLayer?.setShowGrid(mapStore.config.showGrid)
  }

  if (e.code === 'Digit0') {
    cameraController?.reset()
  }
}

function handleWheel(e: WheelEvent): void {
  if (!cameraController) return

  const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.max(
    mapStore.camera.minZoom,
    Math.min(mapStore.camera.maxZoom, mapStore.camera.zoom + zoomDelta)
  )

  mapStore.updateCamera({ zoom: newZoom })
}

onMounted(async () => {
  await initPixi()

  mapStore.tokens.forEach(token => {
    tokenLayer?.addToken(token)
  })

  tokenLayer?.selectToken(mapStore.selectedTokenId)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('wheel', handleWheel, { passive: false })

  syncInterval = setInterval(syncCamera, 100)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('wheel', handleWheel)
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  app?.destroy(true)
  cameraController?.destroy()
  terrainLayer?.destroy()
  tokenLayer?.destroy()
  placementOverlay?.destroy()
})

defineExpose({
  getTokenLayer: () => tokenLayer,
  getCameraController: () => cameraController,
  getPlacementOverlay: () => placementOverlay
})
</script>

<style scoped>
.map-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-canvas-container canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.map-ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.map-ui-overlay > * {
  pointer-events: auto;
}
</style>
