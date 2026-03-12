import { Container, Sprite, Texture, Graphics, Rectangle } from 'pixi.js'
import type { MapToken } from '@/stores/useMapStore'

export interface TokenLayerOptions {
  defaultTokenSize?: number
  highlightColor?: number
  highlightAlpha?: number
  selectionColor?: number
  selectionAlpha?: number
}

export class TokenLayer extends Container {
  private tokens: Map<string, Container> = new Map()
  private highlights: Map<string, Graphics> = new Map()
  private selectedTokenId: string | null = null

  private options = {
    defaultTokenSize: 64,
    highlightColor: 0x00ff00,
    highlightAlpha: 0.5,
    selectionColor: 0xffff00,
    selectionAlpha: 0.7
  }

  constructor(options: TokenLayerOptions = {}) {
    super()
    this.options = {
      ...this.options,
      ...options
    }

    this.eventMode = 'static'
    this.hitArea = new Rectangle(0, 0, 4096, 4096)
  }

  addToken(token: MapToken): Container {
    const existing = this.tokens.get(token.id)
    if (existing) {
      this.updateToken(token)
      return existing
    }

    const container = new Container()
    container.eventMode = 'static'
    container.cursor = 'pointer'

    const sprite = this.createTokenSprite(token)
    container.addChild(sprite)

    const highlight = this.createHighlight()
    container.addChild(highlight)
    highlight.visible = false

    this.updateTokenPosition(container, token)

    container.on('pointerover', () => {
      if (this.selectedTokenId !== token.id) {
        highlight.visible = true
      }
    })

    container.on('pointerout', () => {
      if (this.selectedTokenId !== token.id) {
        highlight.visible = false
      }
    })

    container.on('pointerdown', (e) => {
      e.stopPropagation()
      this.selectToken(token.id)
    })

    this.addChild(container)
    this.tokens.set(token.id, container)
    this.highlights.set(token.id, highlight)

    return container
  }

  private createTokenSprite(token: MapToken): Sprite {
    const texture = this.getTokenTexture(token)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.width = this.options.defaultTokenSize * token.scale
    sprite.height = this.options.defaultTokenSize * token.scale
    return sprite
  }

  private getTokenTexture(token: MapToken): Texture {
    const canvas = document.createElement('canvas')
    const size = 64
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return Texture.WHITE

    const colors: Record<string, string> = {
      ship: '#4A9EFF',
      asteroid: '#888888',
      station: '#FFAA00',
      planet: '#44AA44'
    }

    ctx.fillStyle = colors[token.type] || '#FFFFFF'

    if (token.type === 'ship') {
      ctx.beginPath()
      ctx.moveTo(size / 2, 0)
      ctx.lineTo(0, size)
      ctx.lineTo(size, size)
      ctx.closePath()
      ctx.fill()
    } else if (token.type === 'asteroid') {
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#666666'
      ctx.beginPath()
      ctx.arc(size / 2 - 8, size / 2 - 8, 8, 0, Math.PI * 2)
      ctx.fill()
    } else if (token.type === 'station') {
      ctx.fillRect(8, 8, size - 16, size - 16)
      ctx.strokeStyle = '#FFDD00'
      ctx.lineWidth = 2
      ctx.strokeRect(8, 8, size - 16, size - 16)
    } else if (token.type === 'planet') {
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
      ctx.fill()
    }

    return Texture.from(canvas)
  }

  private createHighlight(): Graphics {
    const graphics = new Graphics()
    graphics.setStrokeStyle({
      width: 3,
      color: this.options.highlightColor,
      alpha: this.options.highlightAlpha
    })
    graphics.rect(-40, -40, 80, 80)
    graphics.stroke()
    return graphics
  }

  updateToken(token: MapToken): void {
    const container = this.tokens.get(token.id)
    if (!container) return

    this.updateTokenPosition(container, token)

    const sprite = container.children[0] as Sprite
    if (sprite) {
      sprite.width = this.options.defaultTokenSize * token.scale
      sprite.height = this.options.defaultTokenSize * token.scale
      sprite.rotation = (token.rotation * Math.PI) / 180
    }
  }

  private updateTokenPosition(container: Container, token: MapToken): void {
    container.x = token.position.x
    container.y = token.position.y
  }

  removeToken(tokenId: string): void {
    const container = this.tokens.get(tokenId)
    if (container) {
      this.removeChild(container)
      container.destroy()
      this.tokens.delete(tokenId)
      this.highlights.delete(tokenId)
    }

    if (this.selectedTokenId === tokenId) {
      this.selectedTokenId = null
    }
  }

  selectToken(tokenId: string | null): void {
    const prevHighlight = this.highlights.get(this.selectedTokenId ?? '')
    if (prevHighlight) {
      prevHighlight.visible = false
    }

    this.selectedTokenId = tokenId

    const newHighlight = this.highlights.get(tokenId ?? '')
    if (newHighlight) {
      newHighlight.visible = true
      newHighlight.setStrokeStyle({
        width: 4,
        color: this.options.selectionColor,
        alpha: this.options.selectionAlpha
      })
      newHighlight.stroke()
    }
  }

  getToken(tokenId: string): Container | null {
    return this.tokens.get(tokenId) || null
  }

  getAllTokens(): Map<string, Container> {
    return new Map(this.tokens)
  }

  clear(): void {
    this.tokens.forEach(container => {
      this.removeChild(container)
      container.destroy()
    })
    this.tokens.clear()
    this.highlights.clear()
    this.selectedTokenId = null
  }

  destroy(): void {
    this.clear()
    super.destroy()
  }
}
