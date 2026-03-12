import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface MapTile {
  x: number
  y: number
  type: 'space' | 'asteroid' | 'nebula' | 'planet' | 'station'
  passable: boolean
  texture?: string
}

export interface MapToken {
  id: string
  type: 'ship' | 'asteroid' | 'station' | 'planet'
  position: { x: number; y: number }
  rotation: number
  scale: number
  ownerId?: string
  data?: Record<string, unknown>
}

export interface MapConfig {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  backgroundColor: number
  gridColor: number
  showGrid: boolean
}

export interface PlacementPreview {
  tokenType: string
  position: { x: number; y: number }
  rotation: number
  valid: boolean
}

export const useMapStore = defineStore('map', () => {
  const config = ref<MapConfig>({
    width: 4096,
    height: 4096,
    tileWidth: 64,
    tileHeight: 64,
    backgroundColor: 0x0a0a1a,
    gridColor: 0x1a1a3e,
    showGrid: true
  })

  const tokens = ref<Map<string, MapToken>>(new Map())
  const selectedTokenId = ref<string | null>(null)
  const placementMode = ref(false)
  const placementPreview = ref<PlacementPreview | null>(null)

  const camera = ref({
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.5,
    maxZoom: 4
  })

  const bounds = computed(() => ({
    x: 0,
    y: 0,
    width: config.value.width,
    height: config.value.height
  }))

  const selectedToken = computed(() => {
    if (!selectedTokenId.value || !tokens.value.has(selectedTokenId.value)) {
      return null
    }
    return tokens.value.get(selectedTokenId.value) || null
  })

  function initializeMap(cfg: Partial<MapConfig>): void {
    config.value = { ...config.value, ...cfg }
  }

  function addToken(token: MapToken): void {
    tokens.value.set(token.id, token)
  }

  function updateToken(id: string, updates: Partial<MapToken>): void {
    const token = tokens.value.get(id)
    if (token) {
      tokens.value.set(id, { ...token, ...updates })
    }
  }

  function removeToken(id: string): void {
    tokens.value.delete(id)
    if (selectedTokenId.value === id) {
      selectedTokenId.value = null
    }
  }

  function selectToken(id: string | null): void {
    selectedTokenId.value = id
  }

  function setPlacementMode(active: boolean): void {
    placementMode.value = active
    if (!active) {
      placementPreview.value = null
    }
  }

  function updatePlacementPreview(preview: PlacementPreview | null): void {
    placementPreview.value = preview
  }

  function updateCamera(updates: Partial<typeof camera.value>): void {
    const newZoom = Math.max(
      camera.value.minZoom,
      Math.min(camera.value.maxZoom, updates.zoom ?? camera.value.zoom)
    )

    camera.value = {
      ...camera.value,
      ...updates,
      zoom: newZoom
    }

    camera.value.x = Math.max(
      -(config.value.width * newZoom - window.innerWidth) / newZoom,
      Math.min(0, camera.value.x)
    )
    camera.value.y = Math.max(
      -(config.value.height * newZoom - window.innerHeight) / newZoom,
      Math.min(0, camera.value.y)
    )
  }

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - camera.value.x) / camera.value.zoom,
      y: (screenY - camera.value.y) / camera.value.zoom
    }
  }

  function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * camera.value.zoom + camera.value.x,
      y: worldY * camera.value.zoom + camera.value.y
    }
  }

  function resetCamera(): void {
    camera.value = {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.5,
      maxZoom: 4
    }
  }

  function toggleGrid(): void {
    config.value.showGrid = !config.value.showGrid
  }

  function getTileAt(x: number, y: number): MapTile | null {
    const tileX = Math.floor(x / config.value.tileWidth)
    const tileY = Math.floor(y / config.value.tileHeight)

    for (const tile of tokens.value.values()) {
      if (
        tile.type === 'asteroid' ||
        tile.type === 'planet' ||
        tile.type === 'station'
      ) {
        const tileStartX = tile.position.x
        const tileStartY = tile.position.y
        const tileEndX = tileStartX + 64 * tile.scale
        const tileEndY = tileStartY + 64 * tile.scale

        if (x >= tileStartX && x <= tileEndX && y >= tileStartY && y <= tileEndY) {
          return {
            x: tileX,
            y: tileY,
            type: tile.type === 'asteroid' ? 'asteroid' : 'space',
            passable: false
          }
        }
      }
    }

    return {
      x: tileX,
      y: tileY,
      type: 'space',
      passable: true
    }
  }

  return {
    config,
    tokens,
    selectedTokenId,
    selectedToken,
    placementMode,
    placementPreview,
    camera,
    bounds,
    initializeMap,
    addToken,
    updateToken,
    removeToken,
    selectToken,
    setPlacementMode,
    updatePlacementPreview,
    updateCamera,
    screenToWorld,
    worldToScreen,
    resetCamera,
    toggleGrid,
    getTileAt
  }
})
