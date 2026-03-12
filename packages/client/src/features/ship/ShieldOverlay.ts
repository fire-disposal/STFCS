import { Graphics, Container } from 'pixi.js'
import type { ShieldSpec } from '@vt/shared'

export interface ShieldOverlayOptions {
  frontColor?: string
  fullColor?: string
  lowEfficiencyColor?: string
  normalEfficiencyColor?: string
  highEfficiencyColor?: string
  efficiencyThreshold?: number
  opacity?: number
}

export class ShieldOverlay extends Container {
  private graphics: Graphics
  private currentRadius: number = 0
  private currentAngle: number = 0
  private currentType: 'front' | 'full' = 'full'
  private efficiency: number = 1.0

  private colors = {
    front: '#4A9EFF',
    full: '#88FF88',
    lowEfficiency: '#FF4444',
    normalEfficiency: '#FFFF44',
    highEfficiency: '#44FF44'
  }

  private efficiencyThreshold = 0.75
  private opacity = 0.3

  constructor(options: ShieldOverlayOptions = {}) {
    super()
    this.graphics = new Graphics()
    this.addChild(this.graphics)

    if (options.frontColor) this.colors.front = options.frontColor
    if (options.fullColor) this.colors.full = options.fullColor
    if (options.lowEfficiencyColor) this.colors.lowEfficiency = options.lowEfficiencyColor
    if (options.normalEfficiencyColor) this.colors.normalEfficiency = options.normalEfficiencyColor
    if (options.highEfficiencyColor) this.colors.highEfficiency = options.highEfficiencyColor
    if (options.efficiencyThreshold !== undefined) this.efficiencyThreshold = options.efficiencyThreshold
    if (options.opacity !== undefined) this.opacity = options.opacity
  }

  update(spec: ShieldSpec, shipHeading: number): void {
    if (!spec.active) {
      this.graphics.clear()
      return
    }

    const headingRad = (shipHeading * Math.PI) / 180

    const radiusChanged = spec.radius !== this.currentRadius
    const angleChanged = spec.coverageAngle !== this.currentAngle
    const typeChanged = spec.type !== this.currentType
    const efficiencyChanged = Math.abs(spec.efficiency - this.efficiency) > 0.01

    if (radiusChanged || angleChanged || typeChanged || efficiencyChanged) {
      this.currentRadius = spec.radius
      this.currentAngle = spec.coverageAngle
      this.currentType = spec.type
      this.efficiency = spec.efficiency

      this.drawShield(spec, headingRad)
    } else {
      const offsetChanged = spec.centerOffset.x !== 0 || spec.centerOffset.y !== 0
      if (offsetChanged) {
        this.drawShield(spec, headingRad)
      }
    }

    this.position.set(
      spec.centerOffset.x * Math.cos(headingRad) - spec.centerOffset.y * Math.sin(headingRad),
      spec.centerOffset.x * Math.sin(headingRad) + spec.centerOffset.y * Math.cos(headingRad)
    )
  }

  private drawShield(spec: ShieldSpec, headingRad: number): void {
    this.graphics.clear()

    const color = this.getEfficiencyColor(spec.efficiency)
    const baseColor = spec.type === 'front' ? this.colors.front : this.colors.full

    this.graphics.setStrokeStyle({ width: 2, color: baseColor, alpha: 0.8 })
    this.graphics.setFillStyle({ color, alpha: this.opacity })

    if (spec.type === 'full') {
      this.drawFullShield(spec.radius)
    } else {
      this.drawFrontShield(spec.radius, spec.coverageAngle, headingRad)
    }
  }

  private drawFullShield(radius: number): void {
    this.graphics.circle(0, 0, radius)
    this.graphics.fill()
    this.graphics.stroke()
  }

  private drawFrontShield(radius: number, coverageAngle: number, headingRad: number): void {
    const halfAngle = (coverageAngle * Math.PI) / 360
    const startAngle = headingRad - halfAngle
    const endAngle = headingRad + halfAngle

    this.graphics.moveTo(0, 0)
    this.graphics.arc(0, 0, radius, startAngle, endAngle, false)
    this.graphics.closePath()
    this.graphics.fill()
    this.graphics.stroke()
  }

  private getEfficiencyColor(efficiency: number): string {
    if (efficiency >= this.efficiencyThreshold) {
      return this.colors.highEfficiency
    } else if (efficiency >= this.efficiencyThreshold * 0.5) {
      return this.colors.normalEfficiency
    } else {
      return this.colors.lowEfficiency
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity))
  }

  destroy(): void {
    this.graphics.destroy()
    super.destroy()
  }
}
