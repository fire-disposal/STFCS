import { Container, Graphics, Text, TextStyle } from 'pixi.js'

export interface MovementPhase {
  phase: 1 | 2 | 3
  type: 'straight' | 'strafe' | 'rotate'
  distance?: number
  angle?: number
  startX: number
  startY: number
  endX: number
  endY: number
  startHeading: number
  endHeading: number
}

export interface MovementPathOptions {
  phase1Color?: string
  phase2Color?: string
  phase3Color?: string
  arrowSize?: number
  lineWidth?: number
  opacity?: number
}

export class MovementPath extends Container {
  private phaseLayers: Container[] = []
  private config = {
    phase1Color: '#00FFFF',
    phase2Color: '#FF00FF',
    phase3Color: '#FFFF00',
    arrowSize: 12,
    lineWidth: 3,
    opacity: 0.8
  }

  constructor(options: MovementPathOptions = {}) {
    super()

    if (options.phase1Color) this.config.phase1Color = options.phase1Color
    if (options.phase2Color) this.config.phase2Color = options.phase2Color
    if (options.phase3Color) this.config.phase3Color = options.phase3Color
    if (options.arrowSize !== undefined) this.config.arrowSize = options.arrowSize
    if (options.lineWidth !== undefined) this.config.lineWidth = options.lineWidth
    if (options.opacity !== undefined) this.config.opacity = options.opacity

    // 创建三个阶段的图层
    for (let i = 0; i < 3; i++) {
      const layer = new Container()
      this.phaseLayers.push(layer)
      this.addChild(layer)
    }
  }

  update(phases: MovementPhase[]): void {
    // 清空所有图层
    this.phaseLayers.forEach(layer => {
      layer.removeChildren()
    })

    // 绘制每个阶段
    phases.forEach((phase, index) => {
      if (index >= 3) return
      this.drawPhase(phase, index)
    })
  }

  private drawPhase(phase: MovementPhase, layerIndex: number): void {
    const layer = this.phaseLayers[layerIndex]
    if (!layer) return

    const color = this.getPhaseColor(phase.phase)
    const alpha = this.config.opacity

    this.drawPath(layer, phase, color, alpha)
    this.drawArrow(layer, phase, color, alpha)
    this.drawLabel(layer, phase, color, alpha)
  }

  private drawPath(layer: Container, phase: MovementPhase, color: string, alpha: number): void {
    const graphics = new Graphics()
    
    // 绘制主路径线
    graphics.setStrokeStyle({
      width: this.config.lineWidth,
      color: this.parseColor(color),
      alpha
    })
    graphics.moveTo(phase.startX, phase.startY)
    graphics.lineTo(phase.endX, phase.endY)
    graphics.stroke()

    layer.addChild(graphics)

    // 如果是旋转类型，绘制圆弧
    if (phase.type === 'rotate') {
      this.drawArc(layer, phase, color, alpha)
    }
  }

  private drawArc(layer: Container, phase: MovementPhase, color: string, alpha: number): void {
    const graphics = new Graphics()
    const radius = 20

    // 转换为弧度
    const startAngleRad = (phase.startHeading * Math.PI) / 180
    const endAngleRad = (phase.endHeading * Math.PI) / 180

    graphics.setStrokeStyle({
      width: 2,
      color: this.parseColor(color),
      alpha
    })

    // 绘制圆弧
    graphics.arc(phase.startX, phase.startY, radius, startAngleRad, endAngleRad, false)
    graphics.stroke()

    layer.addChild(graphics)
  }

  private drawArrow(layer: Container, phase: MovementPhase, color: string, alpha: number): void {
    const dx = phase.endX - phase.startX
    const dy = phase.endY - phase.startY
    const length = Math.sqrt(dx * dx + dy * dy)

    if (length < 5) return

    const angle = Math.atan2(dy, dx)
    const arrowSize = this.config.arrowSize

    const graphics = new Graphics()
    const colorNum = this.parseColor(color)

    // 绘制箭头（三角形）
    graphics.setFillStyle({ color: colorNum, alpha })
    graphics.moveTo(phase.endX, phase.endY)
    graphics.lineTo(
      phase.endX - arrowSize * Math.cos(angle - Math.PI / 6),
      phase.endY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    graphics.lineTo(
      phase.endX - arrowSize * Math.cos(angle + Math.PI / 6),
      phase.endY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    graphics.closePath()
    graphics.fill()

    // 箭头边框
    graphics.setStrokeStyle({
      width: 2,
      color: colorNum,
      alpha
    })
    graphics.moveTo(phase.endX, phase.endY)
    graphics.lineTo(
      phase.endX - arrowSize * Math.cos(angle - Math.PI / 6),
      phase.endY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    graphics.lineTo(
      phase.endX - arrowSize * Math.cos(angle + Math.PI / 6),
      phase.endY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    graphics.closePath()
    graphics.stroke()

    layer.addChild(graphics)
  }

  private drawLabel(layer: Container, phase: MovementPhase, color: string, alpha: number): void {
    const midX = (phase.startX + phase.endX) / 2
    const midY = (phase.startY + phase.endY) / 2 - 15

    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: color,
      align: 'center'
    })

    const text = new Text({
      text: `P${phase.phase}`,
      style
    })

    text.x = midX
    text.y = midY
    text.anchor.set(0.5, 0.5)
    text.alpha = alpha

    layer.addChild(text)
  }

  private getPhaseColor(phase: 1 | 2 | 3): string {
    switch (phase) {
      case 1: return this.config.phase1Color
      case 2: return this.config.phase2Color
      case 3: return this.config.phase3Color
      default: return this.config.phase1Color
    }
  }

  private parseColor(color: string): number {
    // 将十六进制颜色字符串转换为数字
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16)
    }
    return 0xFFFFFF
  }

  clear(): void {
    this.phaseLayers.forEach(layer => {
      layer.removeChildren()
    })
  }

  destroy(): void {
    this.phaseLayers.forEach(layer => {
      layer.destroy({ children: true })
    })
    this.phaseLayers = []
    super.destroy()
  }
}
