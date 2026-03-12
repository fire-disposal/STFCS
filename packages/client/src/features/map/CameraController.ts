import { Container, FederatedPointerEvent, FederatedWheelEvent, Rectangle } from 'pixi.js'

export interface IMapCamera {
  x: number
  y: number
  zoom: number
  minZoom: number
  maxZoom: number
}

export interface CameraControllerOptions {
  minZoom?: number
  maxZoom?: number
  zoomSpeed?: number
  panSpeed?: number
  bounds?: { x: number; y: number; width: number; height: number }
}

export class CameraController {
  private container: Container
  private camera: IMapCamera
  private isDragging = false
  private dragStart = { x: 0, y: 0 }
  private cameraStart = { x: 0, y: 0 }
  private isSpacePressed = false

  private options = {
    minZoom: 0.5,
    maxZoom: 4,
    zoomSpeed: 0.1,
    panSpeed: 1,
    bounds: { x: 0, y: 0, width: 4096, height: 4096 }
  }

  constructor(container: Container, options: CameraControllerOptions = {}) {
    this.container = container

    this.options = {
      ...this.options,
      ...options
    }

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom
    }

    this.setupInteraction()
    this.setupKeyboard()
  }

  private setupInteraction(): void {
    this.container.eventMode = 'static'
    this.container.hitArea = new Rectangle(0, 0, this.container.width, this.container.height)

    this.container.on('pointerdown', this.onPointerDown.bind(this))
    this.container.on('pointermove', this.onPointerMove.bind(this))
    this.container.on('pointerup', this.onPointerUp.bind(this))
    this.container.on('pointerupoutside', this.onPointerUp.bind(this))
    this.container.on('wheel', this.onWheel.bind(this) as any)
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', this.onKeyDown.bind(this))
    window.addEventListener('keyup', this.onKeyUp.bind(this))
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (e.button === 1 || (e.button === 0 && this.isSpacePressed)) {
      this.isDragging = true
      this.dragStart = { x: e.global.x, y: e.global.y }
      this.cameraStart = { x: this.camera.x, y: this.camera.y }
      this.container.cursor = 'grabbing'
    }
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.isDragging) return

    const dx = (e.global.x - this.dragStart.x) / this.camera.zoom
    const dy = (e.global.y - this.dragStart.y) / this.camera.zoom

    this.setPosition(
      this.cameraStart.x + dx * this.options.panSpeed,
      this.cameraStart.y + dy * this.options.panSpeed
    )
  }

  private onPointerUp(): void {
    this.isDragging = false
    this.container.cursor = 'default'
  }

  private onWheel(e: FederatedWheelEvent): void {
    e.preventDefault()

    const zoomDelta = e.deltaY > 0 ? -this.options.zoomSpeed : this.options.zoomSpeed
    const newZoom = Math.max(
      this.options.minZoom,
      Math.min(this.options.maxZoom, this.camera.zoom + zoomDelta)
    )

    const mouseWorldPos = this.screenToWorld(e.global.x, e.global.y)

    this.setZoom(newZoom, mouseWorldPos)
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isSpacePressed = true
      this.container.cursor = 'grab'
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isSpacePressed = false
      if (!this.isDragging) {
        this.container.cursor = 'default'
      }
    }
  }

  private setPosition(x: number, y: number): void {
    const bounds = this.options.bounds
    const maxX = -(bounds.width * this.camera.zoom - this.container.width) / this.camera.zoom
    const maxY = -(bounds.height * this.camera.zoom - this.container.height) / this.camera.zoom

    this.camera.x = Math.max(bounds.x - maxX / 2, Math.min(maxX / 2, x))
    this.camera.y = Math.max(bounds.y - maxY / 2, Math.min(maxY / 2, y))

    this.updateContainer()
  }

  private setZoom(zoom: number, focusPoint?: { x: number; y: number }): void {
    const oldZoom = this.camera.zoom

    if (focusPoint) {
      const worldX = (focusPoint.x - this.camera.x) / oldZoom
      const worldY = (focusPoint.y - this.camera.y) / oldZoom

      this.camera.zoom = zoom

      this.camera.x = focusPoint.x - worldX * zoom
      this.camera.y = focusPoint.y - worldY * zoom
    } else {
      this.camera.zoom = zoom
    }

    this.updateContainer()
  }

  private updateContainer(): void {
    this.container.scale.set(this.camera.zoom)
    this.container.position.set(this.camera.x, this.camera.y)
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom
    }
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.camera.zoom + this.camera.x,
      y: worldY * this.camera.zoom + this.camera.y
    }
  }

  getCamera(): IMapCamera {
    return { ...this.camera }
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.options.bounds = bounds
  }

  reset(): void {
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom
    }
    this.updateContainer()
  }

  zoomToFit(padding: number = 50): void {
    const bounds = this.options.bounds
    const scaleX = (this.container.width - padding * 2) / bounds.width
    const scaleY = (this.container.height - padding * 2) / bounds.height
    const zoom = Math.min(scaleX, scaleY, this.options.maxZoom)

    this.camera.zoom = zoom
    this.camera.x = (this.container.width - bounds.width * zoom) / 2
    this.camera.y = (this.container.height - bounds.height * zoom) / 2

    this.updateContainer()
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this))
    window.removeEventListener('keyup', this.onKeyUp.bind(this))
    this.container.removeAllListeners()
  }
}

export interface IMapCamera {
  x: number
  y: number
  zoom: number
  minZoom: number
  maxZoom: number
}
