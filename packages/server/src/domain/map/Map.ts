import { Point } from '../../types/geometry';
import { TokenEntity, TokenConfig } from './TokenEntity';
import { Camera, CameraConfig } from './Camera';
import { MapEvent } from './events';

export interface MapConfig {
  id: string;
  width: number;
  height: number;
  name: string;
  initialCamera?: CameraConfig;
}

export interface IMap {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly name: string;
  readonly camera: Camera;
  getTokenCount(): number;
  getToken(tokenId: string): TokenEntity | undefined;
  getAllTokens(): TokenEntity[];
}

export class GameMap implements IMap {
  private readonly _id: string;
  private readonly _width: number;
  private readonly _height: number;
  private readonly _name: string;
  private readonly _tokens: Map<string, TokenEntity>;
  private _camera: Camera;
  private readonly _events: MapEvent[];

  constructor(config: MapConfig) {
    if (config.width <= 0 || config.height <= 0) {
      throw new Error('Map dimensions must be positive');
    }

    this._id = config.id;
    this._width = config.width;
    this._height = config.height;
    this._name = config.name;
    this._tokens = new Map();
    this._camera = config.initialCamera
      ? new Camera(config.initialCamera)
      : new Camera({ centerX: config.width / 2, centerY: config.height / 2, zoom: 1, rotation: 0 });
    this._events = [];

    this._events.push({
      type: 'MAP_INITIALIZED',
      timestamp: Date.now(),
      mapId: this._id,
      width: this._width,
      height: this._height,
    });
  }

  get id(): string {
    return this._id;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get name(): string {
    return this._name;
  }

  get camera(): Camera {
    return this._camera;
  }

  get events(): MapEvent[] {
    return [...this._events];
  }

  getTokenCount(): number {
    return this._tokens.size;
  }

  getToken(tokenId: string): TokenEntity | undefined {
    return this._tokens.get(tokenId);
  }

  getAllTokens(): TokenEntity[] {
    return Array.from(this._tokens.values());
  }

  getTokensByOwner(ownerId: string): TokenEntity[] {
    return Array.from(this._tokens.values()).filter(
      (token) => token.ownerId === ownerId
    );
  }

  isWithinBounds(position: Point): boolean {
    return position.x >= 0 && position.x <= this._width &&
           position.y >= 0 && position.y <= this._height;
  }

  checkCollision(position: Point, size: number, excludeTokenId?: string): TokenEntity | null {
    const tempToken = {
      position,
      size,
      overlapsWith: (other: TokenEntity) => {
        const dx = position.x - other.position.x;
        const dy = position.y - other.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < size + other.size;
      },
    };

    for (const token of this._tokens.values()) {
      if (excludeTokenId && token.id === excludeTokenId) {
        continue;
      }
      if (tempToken.overlapsWith(token)) {
        return token;
      }
    }
    return null;
  }

  placeToken(config: TokenConfig): TokenEntity {
    if (!this.isWithinBounds(config.position)) {
      throw new Error(`Token position (${config.position.x}, ${config.position.y}) is outside map bounds`);
    }

    const collision = this.checkCollision(config.position, config.size);
    if (collision) {
      throw new Error(`Token placement would collide with token ${collision.id}`);
    }

    const token = new TokenEntity(config);
    this._tokens.set(token.id, token);

    this._events.push({
      type: 'TOKEN_PLACED',
      timestamp: Date.now(),
      tokenId: token.id,
      ownerId: token.ownerId,
      position: token.position,
      heading: token.heading,
      tokenType: token.type,
    });

    return token;
  }

  moveToken(tokenId: string, newPosition: Point, newHeading: number): boolean {
    const token = this._tokens.get(tokenId);
    if (!token) {
      return false;
    }

    if (!this.isWithinBounds(newPosition)) {
      return false;
    }

    const collision = this.checkCollision(newPosition, token.size, tokenId);
    if (collision) {
      return false;
    }

    const oldPosition = token.position;
    const oldHeading = token.heading;

    token.move(newPosition, newHeading);

    this._events.push({
      type: 'TOKEN_MOVED',
      timestamp: Date.now(),
      tokenId: token.id,
      previousPosition: oldPosition,
      newPosition: token.position,
      previousHeading: oldHeading,
      newHeading: token.heading,
    });

    return true;
  }

  removeToken(tokenId: string, reason: string): boolean {
    const token = this._tokens.get(tokenId);
    if (!token) {
      return false;
    }

    this._tokens.delete(tokenId);

    this._events.push({
      type: 'TOKEN_REMOVED',
      timestamp: Date.now(),
      tokenId,
      reason,
    });

    return true;
  }

  updateCamera(config: Partial<CameraConfig>): void {
    const current = this._camera.toDTO();
    const updated = { ...current, ...config };
    this._camera = new Camera(updated);

    this._events.push({
      type: 'CAMERA_UPDATED',
      timestamp: Date.now(),
      centerX: this._camera.centerX,
      centerY: this._camera.centerY,
      zoom: this._camera.zoom,
      rotation: this._camera.rotation,
    });
  }

  focusOnToken(tokenId: string): boolean {
    const token = this._tokens.get(tokenId);
    if (!token) {
      return false;
    }

    this._camera.setCenter(token.position.x, token.position.y);

    this._events.push({
      type: 'CAMERA_UPDATED',
      timestamp: Date.now(),
      centerX: this._camera.centerX,
      centerY: this._camera.centerY,
      zoom: this._camera.zoom,
      rotation: this._camera.rotation,
    });

    return true;
  }

  clearEvents(): void {
    this._events.length = 0;
  }

  toDTO(): {
    id: string;
    width: number;
    height: number;
    name: string;
    tokens: ReturnType<TokenEntity['toDTO']>[];
    camera: ReturnType<Camera['toDTO']>;
  } {
    return {
      id: this._id,
      width: this._width,
      height: this._height,
      name: this._name,
      tokens: Array.from(this._tokens.values()).map((t) => t.toDTO()),
      camera: this._camera.toDTO(),
    };
  }
}
