import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import type { MapConfig, MapTile } from '@/stores/useMapStore'

export interface TerrainLayerOptions {
  tileSize?: number
  gridColor?: number
  gridAlpha?: number
  backgroundColor?: number
  showGrid?: boolean
}

export class TerrainLayer extends Container {
  private gridGraphics: Graphics
  private backgroundSprite: TilingSprite | null = null
  private tileSprites: Map<string, Sprite> = new Map()
  private config: MapConfig
  private showGrid = true

  private options = {
    tileSize: 64,
    gridColor: 0x1a1a3e,
    gridAlpha: 0.3,
    backgroundColor: 0x0a0a1a,
    showGrid: true
  }

  constructor(config: MapConfig, options: TerrainLayerOptions = {}) {
    super()
    this.config = config

    this.options = {
      ...this.options,
      ...options
    }

    this.gridGraphics = new Graphics()
    this.addChild(this.gridGraphics)

    this.showGrid = this.options.showGrid !== false

    this.createBackground()
    this.drawGrid()
  }

  private createBackground(): void {
    const canvas = document.createElement('canvas')
    canvas.width = this.config.width
    canvas.height = this.config.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = this.colorToCss(this.options.backgroundColor)
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = Texture.from(canvas)
    this.backgroundSprite = new TilingSprite(texture, this.config.width, this.config.height)
    this.backgroundSprite.x = 0
    this.backgroundSprite.y = 0
    this.addChildAt(this.backgroundSprite, 0)
  }

  private drawGrid(): void {
    this.gridGraphics.clear()

    if (!this.showGrid) return

    const { tileSize, gridColor, gridAlpha } = this.options
    const { width, height } = this.config

    this.gridGraphics.setStrokeStyle({
      width: 1,
      color: gridColor,
      alpha: gridAlpha
    })

    for (let x = 0; x <= width; x += tileSize) {
      this.gridGraphics.moveTo(x, 0)
      this.gridGraphics.lineTo(x, height)
    }

    for (let y = 0; y <= height; y += tileSize) {
      this.gridGraphics.moveTo(0, y)
      this.gridGraphics.lineTo(width, y)
    }

    this.gridGraphics.stroke()
  }

  private colorToCss(color: number): string {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    return `rgb(${r}, ${g}, ${b})`
  }

  addTile(tile: MapTile): void {
    if (!tile.texture) return

    const key = `${tile.x}_${tile.y}`
    if (this.tileSprites.has(key)) return

    const sprite = Sprite.from(tile.texture)
    sprite.x = tile.x * this.options.tileSize
    sprite.y = tile.y * this.options.tileSize
    this.addChild(sprite)
    this.tileSprites.set(key, sprite)
  }

  removeTile(x: number, y: number): void {
    const key = `${x}_${y}`
    const sprite = this.tileSprites.get(key)
    if (sprite) {
      this.removeChild(sprite)
      sprite.destroy()
      this.tileSprites.delete(key)
    }
  }

  clearTiles(): void {
    this.tileSprites.forEach(sprite => {
      this.removeChild(sprite)
      sprite.destroy()
    })
    this.tileSprites.clear()
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show
    this.drawGrid()
  }

  updateConfig(config: Partial<MapConfig>): void {
    this.config = { ...this.config, ...config }
    this.drawGrid()
  }

  resize(width: number, height: number): void {
    this.config.width = width
    this.config.height = height

    if (this.backgroundSprite) {
      this.backgroundSprite.width = width
      this.backgroundSprite.height = height
    }

    this.drawGrid()
  }

  destroy(): void {
    this.clearTiles()
    if (this.backgroundSprite) {
      this.backgroundSprite.destroy()
      this.backgroundSprite = null
    }
    this.gridGraphics.destroy()
    super.destroy()
  }
}
