export interface IMapCamera {
  x: number
  y: number
  zoom: number
  minZoom: number
  maxZoom: number
}

export interface MapLayer {
  visible: boolean
  zIndex: number
  update(delta: number): void
  destroy(): void
}

export interface TokenClickEvent {
  tokenId: string
  position: { x: number; y: number }
  button: 'left' | 'right' | 'middle'
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

export interface PlacementConfig {
  tokenType: string
  rotation: number
  snapToGrid: boolean
  gridSize: number
}
