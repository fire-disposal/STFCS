import { Container, Graphics } from 'pixi.js'

export interface WeaponRangeConfig {
  shipId: string
  weaponId: string
  range: number
  valid: boolean
}

export interface WeaponRangeDisplayOptions {
  validColor?: number
  invalidColor?: number
  validAlpha?: number
  invalidAlpha?: number
  lineWidth?: number
}

export class WeaponRangeDisplay extends Container {
  private ranges: Map<string, Graphics> = new Map()
  private options = {
    validColor: 0x00ff00,
    invalidColor: 0xff0000,
    validAlpha: 0.3,
    invalidAlpha: 0.3,
    lineWidth: 2
  }

  constructor(options: WeaponRangeDisplayOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.visible = true
  }

  show(config: WeaponRangeConfig): void {
    const existing = this.ranges.get(config.weaponId)

    if (existing) {
      this.updateRange(existing, config)
    } else {
      this.createRange(config)
    }
  }

  private createRange(config: WeaponRangeConfig): void {
    const graphics = new Graphics()
    this.updateRange(graphics, config)
    this.addChild(graphics)
    this.ranges.set(config.weaponId, graphics)
  }

  private updateRange(graphics: Graphics, config: WeaponRangeConfig): void {
    graphics.clear()

    const color = config.valid ? this.options.validColor : this.options.invalidColor
    const alpha = config.valid ? this.options.validAlpha : this.options.invalidAlpha

    graphics.beginPath()
    graphics.circle(0, 0, config.range)
    graphics.fill({ color, alpha })

    graphics.setStrokeStyle({
      width: this.options.lineWidth,
      color,
      alpha: config.valid ? 0.8 : 0.5
    })
    graphics.arc(0, 0, config.range, 0, Math.PI * 2)
    graphics.stroke()

    const segments = 8
    for (let i = 0; i < segments; i++) {
      const angle = (i * Math.PI * 2) / segments
      const innerRadius = config.range - 10
      const outerRadius = config.range

      graphics.setStrokeStyle({
        width: 2,
        color,
        alpha: 0.5
      })
      graphics.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius)
      graphics.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius)
      graphics.stroke()
    }

    const rangeText = this.createRangeLabel(config.range)
    if (graphics.children.length > 0) {
      graphics.removeChildAt(0)
    }
    graphics.addChild(rangeText)
  }

  private createRangeLabel(range: number): Graphics {
    const graphics = new Graphics()

    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 30
    const ctx = canvas.getContext('2d')
    if (!ctx) return graphics

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${range}m`, 50, 20)

    return graphics
  }

  hide(weaponId: string): void {
    const graphics = this.ranges.get(weaponId)
    if (graphics) {
      this.removeChild(graphics)
      graphics.destroy()
      this.ranges.delete(weaponId)
    }
  }

  hideAll(): void {
    this.ranges.forEach((graphics) => {
      this.removeChild(graphics)
      graphics.destroy()
    })
    this.ranges.clear()
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
