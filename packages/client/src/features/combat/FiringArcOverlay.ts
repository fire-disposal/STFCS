import { Container, Graphics } from 'pixi.js'

export interface FiringArcConfig {
  shipId: string
  weaponId: string
  arcStart: number
  arcEnd: number
  range: number
  valid: boolean
}

export interface FiringArcOverlayOptions {
  validColor?: number
  invalidColor?: number
  validAlpha?: number
  invalidAlpha?: number
  arcLineWidth?: number
  showCenterLine?: boolean
}

export class FiringArcOverlay extends Container {
  private arcs: Map<string, Graphics> = new Map()
  private options = {
    validColor: 0x00ff00,
    invalidColor: 0xff0000,
    validAlpha: 0.3,
    invalidAlpha: 0.2,
    arcLineWidth: 3,
    showCenterLine: true
  }

  constructor(options: FiringArcOverlayOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.visible = true
  }

  show(config: FiringArcConfig): void {
    const existing = this.arcs.get(config.weaponId)

    if (existing) {
      this.updateArc(existing, config)
    } else {
      this.createArc(config)
    }
  }

  private createArc(config: FiringArcConfig): void {
    const graphics = new Graphics()
    this.updateArc(graphics, config)
    this.addChild(graphics)
    this.arcs.set(config.weaponId, graphics)
  }

  private updateArc(graphics: Graphics, config: FiringArcConfig): void {
    graphics.clear()

    const color = config.valid ? this.options.validColor : this.options.invalidColor
    const alpha = config.valid ? this.options.validAlpha : this.options.invalidAlpha

    const startRad = (config.arcStart * Math.PI) / 180
    const endRad = (config.arcEnd * Math.PI) / 180

    graphics.beginPath()
    graphics.moveTo(0, 0)
    graphics.arc(0, 0, config.range, startRad, endRad, false)
    graphics.closePath()
    graphics.fill({ color, alpha })

    graphics.setStrokeStyle({
      width: this.options.arcLineWidth,
      color,
      alpha: config.valid ? 0.9 : 0.6
    })

    graphics.moveTo(0, 0)
    graphics.lineTo(Math.cos(startRad) * config.range, Math.sin(startRad) * config.range)
    graphics.stroke()

    graphics.moveTo(0, 0)
    graphics.lineTo(Math.cos(endRad) * config.range, Math.sin(endRad) * config.range)
    graphics.stroke()

    graphics.setStrokeStyle({
      width: 2,
      color,
      alpha: config.valid ? 0.7 : 0.4
    })
    graphics.arc(0, 0, config.range, startRad, endRad, false)
    graphics.stroke()

    if (this.options.showCenterLine) {
      const centerAngle = ((config.arcStart + config.arcEnd) / 2 * Math.PI) / 180
      const lineLength = config.range * 0.9

      graphics.setStrokeStyle({
        width: 1,
        color,
        alpha: 0.4
      })
      graphics.moveTo(0, 0)
      graphics.lineTo(Math.cos(centerAngle) * lineLength, Math.sin(centerAngle) * lineLength)
      graphics.stroke()
    }

    const arcAngle = config.arcEnd - config.arcStart
    if (arcAngle > 10) {
      const labelAngle = ((config.arcStart + config.arcEnd) / 2 * Math.PI) / 180
      const labelDistance = config.range * 0.5

      const labelX = Math.cos(labelAngle) * labelDistance
      const labelY = Math.sin(labelAngle) * labelDistance

      const label = this.createAngleLabel(`${Math.round(arcAngle)}°`)
      label.x = labelX
      label.y = labelY
      graphics.addChild(label)
    }
  }

  private createAngleLabel(text: string): Graphics {
    const graphics = new Graphics()

    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 24
    const ctx = canvas.getContext('2d')
    if (!ctx) return graphics

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(text, 30, 16)

    return graphics
  }

  hide(weaponId: string): void {
    const graphics = this.arcs.get(weaponId)
    if (graphics) {
      this.removeChild(graphics)
      graphics.destroy()
      this.arcs.delete(weaponId)
    }
  }

  hideAll(): void {
    this.arcs.forEach((graphics) => {
      this.removeChild(graphics)
      graphics.destroy()
    })
    this.arcs.clear()
  }

  updateValidity(_weaponId: string, _valid: boolean): void {
  }

  clear(): void {
    this.hideAll()
  }

  destroy(): void {
    this.hideAll()
    super.destroy()
  }
}
