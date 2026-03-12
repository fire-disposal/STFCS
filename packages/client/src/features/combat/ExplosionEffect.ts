import { Container, Sprite, Texture, Ticker } from 'pixi.js'
import type { ExplosionData } from '@vt/shared'

export interface Particle {
  sprite: Sprite
  velocity: { x: number; y: number }
  life: number
  maxLife: number
  size: number
  startSize: number
  endSize: number
  rotation: number
  rotationSpeed: number
}

export interface ExplosionEffectOptions {
  particleCount?: number
  baseSize?: number
  spread?: number
  speed?: number
  duration?: number
  colors?: number[]
}

export class ExplosionEffect extends Container {
  private explosions: Map<string, {
    particles: Particle[]
    shockwave: Sprite
    flash: Sprite
    startTime: number
    duration: number
  }> = new Map()

  private options = {
    particleCount: 30,
    baseSize: 40,
    spread: 360,
    speed: 5,
    duration: 1000,
    colors: [0xff4400, 0xff8800, 0xffaa00, 0xffff00, 0xffffff]
  }

  private ticker: Ticker

  constructor(options: ExplosionEffectOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.ticker = new Ticker()
    this.ticker.add(this.update.bind(this))
    this.ticker.start()

    this.visible = true
  }

  play(explosion: ExplosionData): void {
    if (this.explosions.has(explosion.id)) {
      this.remove(explosion.id)
    }

    const particles = this.createParticles(explosion)
    const shockwave = this.createShockwave()
    const flash = this.createFlash()

    this.addChild(flash)
    this.addChild(shockwave)
    particles.forEach(p => this.addChild(p.sprite))

    this.explosions.set(explosion.id, {
      particles,
      shockwave,
      flash,
      startTime: Date.now(),
      duration: this.options.duration
    })
  }

  private createParticles(explosion: ExplosionData): Particle[] {
    const particles: Particle[] = []
    const spreadRad = (this.options.spread * Math.PI) / 180

    for (let i = 0; i < this.options.particleCount; i++) {
      const angle = Math.random() * spreadRad - spreadRad / 2
      const speed = (Math.random() * 0.5 + 0.5) * this.options.speed
      const size = (Math.random() * 0.5 + 0.5) * this.options.baseSize
      const colorIndex = Math.floor(Math.random() * this.options.colors.length)
      const color = this.options.colors[colorIndex] ?? 0xff4400
      const life = Math.random() * 300 + 300
      const maxLife = life

      const canvas = document.createElement('canvas')
      canvas.width = size * 2
      canvas.height = size * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      const gradient = ctx.createRadialGradient(size, size, 0, size, size, size)
      const r = (color >> 16) & 0xff
      const g = (color >> 8) & 0xff
      const b = color & 0xff
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const texture = Texture.from(canvas)
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.x = explosion.position.x
      sprite.y = explosion.position.y

      const particle: Particle = {
        sprite,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        life,
        maxLife,
        size,
        startSize: size,
        endSize: size * 0.2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1
      }

      particles.push(particle)
    }

    return particles
  }

  private createShockwave(): Sprite {
    const canvas = document.createElement('canvas')
    const size = this.options.baseSize * 4
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return Sprite.from(Texture.WHITE)

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0)')
    gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = Texture.from(canvas)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.scale.set(0.1)
    sprite.alpha = 0.8

    return sprite
  }

  private createFlash(): Sprite {
    const canvas = document.createElement('canvas')
    const size = this.options.baseSize * 6
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return Sprite.from(Texture.WHITE)

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.3, 'rgba(255, 255, 200, 0.5)')
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = Texture.from(canvas)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.alpha = 0.9

    return sprite
  }

  private update(): void {
    const now = Date.now()

    this.explosions.forEach((explosion, id) => {
      const elapsed = now - explosion.startTime
      const progress = Math.min(1, elapsed / explosion.duration)

      explosion.flash.alpha = 1 - progress * 3
      explosion.flash.scale.set(1 + progress * 2)

      explosion.shockwave.alpha = 0.8 * (1 - progress)
      explosion.shockwave.scale.set(0.1 + progress * 3)

      explosion.particles.forEach(particle => {
        const particleProgress = 1 - particle.life / particle.maxLife

        particle.sprite.x += particle.velocity.x
        particle.sprite.y += particle.velocity.y
        particle.life -= 16

        const sizeProgress = Math.min(1, particleProgress * 2)
        const currentSize = particle.startSize + (particle.endSize - particle.startSize) * sizeProgress
        particle.sprite.scale.set(currentSize / particle.startSize)
        particle.sprite.alpha = Math.sin(particleProgress * Math.PI)
        particle.sprite.rotation += particle.rotationSpeed
      })

      if (progress >= 1) {
        this.remove(id)
      }
    })
  }

  remove(id: string): void {
    const explosion = this.explosions.get(id)
    if (explosion) {
      explosion.particles.forEach(p => {
        this.removeChild(p.sprite)
        p.sprite.destroy()
      })
      this.removeChild(explosion.shockwave)
      this.removeChild(explosion.flash)
      explosion.shockwave.destroy()
      explosion.flash.destroy()
      this.explosions.delete(id)
    }
  }

  clear(): void {
    this.explosions.forEach((_, id) => this.remove(id))
  }

  setDuration(duration: number): void {
    this.options.duration = duration
  }

  destroy(): void {
    this.ticker.stop()
    this.ticker.destroy()
    this.clear()
    super.destroy()
  }
}
