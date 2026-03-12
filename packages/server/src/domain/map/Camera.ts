export interface CameraConfig {
  centerX: number;
  centerY: number;
  zoom: number;
  rotation: number;
}

export interface ICamera {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
  readonly rotation: number;
}

export class Camera implements ICamera {
  private _centerX: number;
  private _centerY: number;
  private _zoom: number;
  private _rotation: number;

  constructor(config: CameraConfig) {
    if (config.zoom <= 0) {
      throw new Error('Camera zoom must be positive');
    }

    this._centerX = config.centerX;
    this._centerY = config.centerY;
    this._zoom = config.zoom;
    this._rotation = ((config.rotation % 360) + 360) % 360;
  }

  get centerX(): number {
    return this._centerX;
  }

  get centerY(): number {
    return this._centerY;
  }

  get zoom(): number {
    return this._zoom;
  }

  get rotation(): number {
    return this._rotation;
  }

  pan(deltaX: number, deltaY: number): void {
    this._centerX += deltaX;
    this._centerY += deltaY;
  }

  setCenter(x: number, y: number): void {
    this._centerX = x;
    this._centerY = y;
  }

  zoomIn(factor: number): void {
    const newZoom = this._zoom * factor;
    if (newZoom >= 0.1) {
      this._zoom = newZoom;
    }
  }

  zoomOut(factor: number): void {
    const newZoom = this._zoom / factor;
    if (newZoom >= 0.1) {
      this._zoom = newZoom;
    }
  }

  setZoom(zoom: number): void {
    if (zoom >= 0.1) {
      this._zoom = zoom;
    }
  }

  rotate(delta: number): void {
    this._rotation = ((this._rotation + delta) % 360 + 360) % 360;
  }

  setRotation(rotation: number): void {
    this._rotation = ((rotation % 360) + 360) % 360;
  }

  toDTO(): CameraConfig {
    return {
      centerX: this._centerX,
      centerY: this._centerY,
      zoom: this._zoom,
      rotation: this._rotation,
    };
  }

  clone(): Camera {
    return new Camera(this.toDTO());
  }
}
