import { Container, Graphics, Sprite, Texture } from 'pixi.js'

export interface DamageNumberData {
  id: string
  value: number
  position: { x: number; y: number }
  isCritical: boolean
  timestamp: number
  duration: number
}

export interface DamageNumbersOptions {
  normalColor?: number
  criticalColor?: number
  fontSize?: number
  criticalFontSize?: number
  yOffset?: number
  fadeOutDelay?: number
}

export class DamageNumbers extends Container {
  private damageTexts: Map<string, Container> = new Map()
  private options = {
    normalColor: 0xffffff,
    criticalColor: 0xff4400,
    fontSize: 24,
    criticalFontSize: 36,
    yOffset: -50,
    fadeOutDelay: 500
  }

  private animationFrame: number | null = null

  constructor(options: DamageNumbersOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.visible = true
  }

  show(data: DamageNumberData): void {
    if (this.damageTexts.has(data.id)) {
      this.remove(data.id)
    }

    const container = this.createDamageText(data)
    this.addChild(container)
    this.damageTexts.set(data.id, container)

    this.startAnimation(container, data)
  }

  private createDamageText(data: DamageNumberData): Container {
    const container = new Container()
    container.x = data.position.x
    container.y = data.position.y + this.options.yOffset

    const textSprite = this.createTextSprite(data.value, data.isCritical)
    container.addChild(textSprite)

    if (data.isCritical) {
      const effect = this.createCriticalEffect()
      container.addChildAt(effect, 0)
    }

    return container
  }

  private createTextSprite(value: number, isCritical: boolean): Sprite {
    const canvas = document.createElement('canvas')
    const fontSize = isCritical ? this.options.criticalFontSize : this.options.fontSize
    canvas.width = fontSize * 3
    canvas.height = fontSize * 1.5
    const ctx = canvas.getContext('2d')
    if (!ctx) return Sprite.from(Texture.WHITE)

    const color = isCritical ? '#FF4400' : '#FFFFFF'
    ctx.fillStyle = color
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.fillText(value.toString(), canvas.width / 2, canvas.height / 2)

    const texture = Texture.from(canvas)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)

    return sprite
  }

  private createCriticalEffect(): Graphics {
    const graphics = new Graphics()
    const size = this.options.criticalFontSize * 2

    graphics.setStrokeStyle({
      width: 2,
      color: 0xffaa00,
      alpha: 0.6
    })

    const spikes = 8
    const outerRadius = size / 2
    const innerRadius = size / 3

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const angle = (i * Math.PI) / spikes
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      if (i === 0) {
        graphics.moveTo(x, y)
      } else {
        graphics.lineTo(x, y)
      }
    }

    graphics.closePath()
    graphics.stroke()

    return graphics
  }

  private startAnimation(container: Container, data: DamageNumberData): void {
    const startTime = Date.now()
    const textSprite = container.children[container.children.length - 1] as Sprite
    const effect = container.children[0] as Graphics

    const animate = (): void => {
      const elapsed = Date.now() - startTime

      if (elapsed > data.duration) {
        this.remove(data.id)
        return
      }

      container.y -= 0.5

      if (elapsed > this.options.fadeOutDelay) {
        const fadeProgress = (elapsed - this.options.fadeOutDelay) / (data.duration - this.options.fadeOutDelay)
        const alpha = 1 - fadeProgress
        textSprite.alpha = alpha
        if (effect) {
          effect.alpha = alpha
        }
      }

      if (data.isCritical && effect) {
        effect.scale.set(1 + Math.sin(elapsed * 0.02) * 0.1)
        effect.rotation = Math.sin(elapsed * 0.03) * 0.1
      }

      this.animationFrame = requestAnimationFrame(animate)
    }

    this.animationFrame = requestAnimationFrame(animate)
  }

  remove(id: string): void {
    const container = this.damageTexts.get(id)
    if (container) {
      this.removeChild(container)
      container.destroy()
      this.damageTexts.delete(id)
    }
  }

  clear(): void {
    this.damageTexts.forEach((container) => {
      this.removeChild(container)
      container.destroy()
    })
    this.damageTexts.clear()

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  setDuration(_duration: number): void {
  }

  destroy(): void {
    this.clear()
    super.destroy()
  }
}
