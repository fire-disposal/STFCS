import { Point } from '../../types/geometry';

export type TokenType = 'ship' | 'station' | 'asteroid';

export interface TokenConfig {
  id: string;
  ownerId: string;
  position: Point;
  heading: number;
  type: TokenType;
  size: number;
}

export interface IToken {
  readonly id: string;
  readonly ownerId: string;
  readonly position: Point;
  readonly heading: number;
  readonly type: TokenType;
  readonly size: number;
}

export class TokenEntity implements IToken {
  private readonly _id: string;
  private readonly _ownerId: string;
  private _position: Point;
  private _heading: number;
  private readonly _type: TokenType;
  private readonly _size: number;

  constructor(config: TokenConfig) {
    if (config.size <= 0) {
      throw new Error('Token size must be positive');
    }

    this._id = config.id;
    this._ownerId = config.ownerId;
    this._position = { ...config.position };
    this._heading = ((config.heading % 360) + 360) % 360;
    this._type = config.type;
    this._size = config.size;
  }

  get id(): string {
    return this._id;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get position(): Point {
    return { ...this._position };
  }

  get heading(): number {
    return this._heading;
  }

  get type(): TokenType {
    return this._type;
  }

  get size(): number {
    return this._size;
  }

  move(newPosition: Point, newHeading: number): void {
    this._position = { ...newPosition };
    this._heading = ((newHeading % 360) + 360) % 360;
  }

  containsPoint(point: Point): boolean {
    const dx = point.x - this._position.x;
    const dy = point.y - this._position.y;
    return Math.sqrt(dx * dx + dy * dy) <= this._size;
  }

  overlapsWith(other: TokenEntity): boolean {
    const dx = this._position.x - other._position.x;
    const dy = this._position.y - other._position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this._size + other._size;
  }

  toDTO(): {
    id: string;
    ownerId: string;
    position: Point;
    heading: number;
    type: TokenType;
    size: number;
  } {
    return {
      id: this._id,
      ownerId: this._ownerId,
      position: this._position,
      heading: this._heading,
      type: this._type,
      size: this._size,
    };
  }
}
