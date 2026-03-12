import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { PlacementPreview } from '@/stores/useMapStore'

export interface PlacementOverlayOptions {
  validColor?: number
  invalidColor?: number
  alpha?: number
  ghostAlpha?: number
  size?: number
}

export class PlacementOverlay extends Container {
  private ghostSprite: Sprite | null = null
  private highlightGraphics: Graphics
  private validGraphics: Graphics
  private currentPreview: PlacementPreview | null = null

  private options = {
    validColor: 0x00ff00,
    invalidColor: 0xff0000,
    alpha: 0.5,
    ghostAlpha: 0.4,
    size: 64
  }

  constructor(options: PlacementOverlayOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.highlightGraphics = new Graphics()
    this.validGraphics = new Graphics()
    this.addChild(this.highlightGraphics)
    this.addChild(this.validGraphics)

    this.visible = false
  }

  setPreview(preview: PlacementPreview | null): void {
    this.currentPreview = preview

    if (!preview) {
      this.visible = false
      this.clearGraphics()
      return
    }

    this.visible = true
    this.updateGraphics()
  }

  private updateGraphics(): void {
    if (!this.currentPreview) return

    this.clearGraphics()

    const { position, valid } = this.currentPreview

    this.position.set(position.x, position.y)

    this.drawGhost()
    this.drawHighlight(valid)
    this.drawValidityIndicator(valid)
  }

  private drawGhost(): void {
    if (this.ghostSprite) {
      this.removeChild(this.ghostSprite)
      this.ghostSprite.destroy()
    }

    const texture = this.createGhostTexture()
    this.ghostSprite = new Sprite(texture)
    this.ghostSprite.anchor.set(0.5)
    this.ghostSprite.alpha = this.options.ghostAlpha
    this.ghostSprite.rotation = (this.currentPreview?.rotation ?? 0) * Math.PI / 180
    this.addChildAt(this.ghostSprite, 0)
  }

  private createGhostTexture(): Texture {
    const canvas = document.createElement('canvas')
    const size = this.options.size
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return Texture.WHITE

    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.5
    ctx.fillRect(8, 8, size - 16, size - 16)

    ctx.strokeStyle = '#AAAAAA'
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, size - 16, size - 16)

    return Texture.from(canvas)
  }

  private drawHighlight(valid: boolean): void {
    const color = valid ? this.options.validColor : this.options.invalidColor
    const size = this.options.size

    this.highlightGraphics.setStrokeStyle({
      width: 3,
      color,
      alpha: this.options.alpha
    })

    this.highlightGraphics.rect(-size / 2 - 4, -size / 2 - 4, size + 8, size + 8)
    this.highlightGraphics.stroke()
  }

  private drawValidityIndicator(valid: boolean): void {
    const size = this.options.size
    const indicatorSize = 16

    this.validGraphics.beginPath()
    this.validGraphics.rect(
      size / 2 - indicatorSize - 4,
      -size / 2 - 4,
      indicatorSize,
      indicatorSize
    )
    this.validGraphics.fill({
      color: valid ? this.options.validColor : this.options.invalidColor,
      alpha: this.options.alpha
    })

    this.validGraphics.setStrokeStyle({
      width: 2,
      color: valid ? this.options.validColor : this.options.invalidColor,
      alpha: 1
    })
    this.validGraphics.stroke()

    if (valid) {
      this.validGraphics.setStrokeStyle({
        width: 2,
        color: 0x000000,
        alpha: 1
      })
      this.validGraphics.moveTo(size / 2 - indicatorSize, -size / 2 + 4)
      this.validGraphics.lineTo(size / 2 - indicatorSize + 4, -size / 2 + 8)
      this.validGraphics.lineTo(size / 2 - indicatorSize + 12, -size / 2)
      this.validGraphics.stroke()
    } else {
      this.validGraphics.setStrokeStyle({
        width: 2,
        color: 0x000000,
        alpha: 1
      })
      this.validGraphics.moveTo(size / 2 - indicatorSize + 2, -size / 2 + 2)
      this.validGraphics.lineTo(size / 2 - indicatorSize + 14, -size / 2 + 14)
      this.validGraphics.moveTo(size / 2 - indicatorSize + 14, -size / 2 + 2)
      this.validGraphics.lineTo(size / 2 - indicatorSize + 2, -size / 2 + 14)
      this.validGraphics.stroke()
    }
  }

  private clearGraphics(): void {
    this.highlightGraphics.clear()
    this.validGraphics.clear()

    if (this.ghostSprite) {
      this.removeChild(this.ghostSprite)
      this.ghostSprite.destroy()
      this.ghostSprite = null
    }
  }

  updatePosition(x: number, y: number): void {
    if (this.currentPreview) {
      this.currentPreview.position = { x, y }
      this.updateGraphics()
    }
  }

  setValid(valid: boolean): void {
    if (this.currentPreview) {
      this.currentPreview.valid = valid
      this.updateGraphics()
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    if (!visible) {
      this.clearGraphics()
    }
  }

  destroy(): void {
    this.clearGraphics()
    this.highlightGraphics.destroy()
    this.validGraphics.destroy()
    super.destroy()
  }
}
