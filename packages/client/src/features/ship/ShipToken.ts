import { Sprite, Container, Texture } from 'pixi.js'
import type { ShipStatus } from '@vt/shared'

export interface ShipTokenOptions {
  texture?: Texture | string
  width?: number
  height?: number
  anchorX?: number
  anchorY?: number
  showHeadingIndicator?: boolean
}

export class ShipToken extends Container {
  private sprite: Sprite
  private headingIndicator?: Sprite
  private readonly _shipId: string

  constructor(shipId: string, options: ShipTokenOptions = {}) {
    super()
    this._shipId = shipId

    const texture = options.texture instanceof Texture 
      ? options.texture 
      : Texture.from(options.texture || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(options.anchorX ?? 0.5, options.anchorY ?? 0.5)

    const width = options.width ?? 64
    const height = options.height ?? 32
    this.sprite.width = width
    this.sprite.height = height

    this.addChild(this.sprite)

    if (options.showHeadingIndicator !== false) {
      this.createHeadingIndicator(height)
    }
  }

  private createHeadingIndicator(height: number): void {
    const indicatorGraphics = this.createHeadingTexture()
    this.headingIndicator = new Sprite(indicatorGraphics)
    this.headingIndicator.anchor.set(0.5, 0.5)
    this.headingIndicator.position.set(0, -height / 2 - 10)
    this.addChild(this.headingIndicator)
  }

  private createHeadingTexture(): Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 20
    canvas.height = 30
    const ctx = canvas.getContext('2d')
    if (!ctx) return Texture.WHITE

    ctx.fillStyle = '#FF6600'
    ctx.beginPath()
    ctx.moveTo(10, 0)
    ctx.lineTo(0, 30)
    ctx.lineTo(20, 30)
    ctx.closePath()
    ctx.fill()

    return Texture.from(canvas)
  }

  update(status: ShipStatus): void {
    this.position.set(status.position.x, status.position.y)

    const headingRad = (status.heading * Math.PI) / 180
    this.rotation = headingRad

    this.sprite.alpha = status.disabled ? 0.5 : 1.0

    this.updateHeadingIndicator(status.disabled)
  }

  private updateHeadingIndicator(disabled: boolean): void {
    if (this.headingIndicator) {
      this.headingIndicator.alpha = disabled ? 0.3 : 0.8
    }
  }

  setTexture(texture: Texture | string): void {
    const newTexture = texture instanceof Texture ? texture : Texture.from(texture)
    this.sprite.texture = newTexture
  }

  get shipId(): string {
    return this._shipId
  }

  destroy(): void {
    if (this.headingIndicator) {
      this.headingIndicator.destroy({ texture: true })
    }
    this.sprite.destroy({ texture: true })
    super.destroy()
  }
}
