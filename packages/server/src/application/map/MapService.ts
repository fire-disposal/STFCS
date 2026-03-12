import { GameMap, MapConfig } from '../../domain/map/Map';
import { TokenConfig, TokenType } from '../../domain/map/TokenEntity';
import { CameraConfig } from '../../domain/map/Camera';
import { Point } from '../../types/geometry';

export interface PlaceTokenCommand {
  id: string;
  ownerId: string;
  position: Point;
  heading: number;
  type: TokenType;
  size: number;
}

export interface MoveTokenCommand {
  tokenId: string;
  position: Point;
  heading: number;
}

export interface UpdateCameraCommand {
  centerX?: number;
  centerY?: number;
  zoom?: number;
  rotation?: number;
}

export interface MapServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MapService {
  private _map: GameMap | null = null;

  get map(): GameMap | null {
    return this._map;
  }

  get isInitialized(): boolean {
    return this._map !== null;
  }

  initializeMap(config: MapConfig): MapServiceResult<GameMap> {
    try {
      this._map = new GameMap(config);
      return {
        success: true,
        data: this._map,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize map',
      };
    }
  }

  placeToken(command: PlaceTokenCommand): MapServiceResult<TokenConfig> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    try {
      const token = this._map.placeToken({
        id: command.id,
        ownerId: command.ownerId,
        position: command.position,
        heading: command.heading,
        type: command.type,
        size: command.size,
      });

      return {
        success: true,
        data: token.toDTO(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to place token',
      };
    }
  }

  moveToken(command: MoveTokenCommand): MapServiceResult<{ position: Point; heading: number }> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const success = this._map.moveToken(command.tokenId, command.position, command.heading);

    if (success) {
      return {
        success: true,
        data: {
          position: command.position,
          heading: command.heading,
        },
      };
    }

    return {
      success: false,
      error: 'Failed to move token (out of bounds or collision)',
    };
  }

  removeToken(tokenId: string, reason: string): MapServiceResult<void> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const success = this._map.removeToken(tokenId, reason);

    if (success) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Token not found',
    };
  }

  updateCamera(command: UpdateCameraCommand): MapServiceResult<CameraConfig> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    this._map.updateCamera(command);

    return {
      success: true,
      data: this._map.camera.toDTO(),
    };
  }

  focusCameraOnToken(tokenId: string): MapServiceResult<CameraConfig> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const success = this._map.focusOnToken(tokenId);

    if (success) {
      return {
        success: true,
        data: this._map.camera.toDTO(),
      };
    }

    return {
      success: false,
      error: 'Token not found',
    };
  }

  getToken(tokenId: string): MapServiceResult<TokenConfig> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const token = this._map.getToken(tokenId);

    if (token) {
      return {
        success: true,
        data: token.toDTO(),
      };
    }

    return {
      success: false,
      error: 'Token not found',
    };
  }

  getAllTokens(): MapServiceResult<TokenConfig[]> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const tokens = this._map.getAllTokens().map((t) => t.toDTO());

    return {
      success: true,
      data: tokens,
    };
  }

  getTokensByOwner(ownerId: string): MapServiceResult<TokenConfig[]> {
    if (!this._map) {
      return {
        success: false,
        error: 'Map not initialized',
      };
    }

    const tokens = this._map.getTokensByOwner(ownerId).map((t) => t.toDTO());

    return {
      success: true,
      data: tokens,
    };
  }

  isPositionValid(position: Point): boolean {
    if (!this._map) {
      return false;
    }

    return this._map.isWithinBounds(position);
  }

  checkCollision(position: Point, size: number, excludeTokenId?: string): TokenConfig | null {
    if (!this._map) {
      return null;
    }

    const collision = this._map.checkCollision(position, size, excludeTokenId);
    return collision ? collision.toDTO() : null;
  }
}
