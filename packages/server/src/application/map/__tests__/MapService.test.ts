import { describe, it, expect, beforeEach } from 'vitest';
import { MapService } from '../MapService';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    service = new MapService();
  });

  it('should initialize map', () => {
    const result = service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('test-map');
    expect(service.isInitialized).toBe(true);
  });

  it('should fail to place token before map initialization', () => {
    const result = service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Map not initialized');
  });

  it('should place token after map initialization', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    const result = service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('token-1');
  });

  it('should move token', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = service.moveToken({
      tokenId: 'token-1',
      position: { x: 200, y: 200 },
      heading: 45,
    });

    expect(result.success).toBe(true);
    expect(result.data?.position.x).toBe(200);
    expect(result.data?.heading).toBe(45);
  });

  it('should update camera', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    const result = service.updateCamera({
      centerX: 500,
      centerY: 500,
      zoom: 2,
    });

    expect(result.success).toBe(true);
    expect(result.data?.centerX).toBe(500);
    expect(result.data?.zoom).toBe(2);
  });

  it('should get token by id', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = service.getToken('token-1');
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('token-1');
  });

  it('should get all tokens', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    service.placeToken({
      id: 'token-2',
      ownerId: 'player-2',
      position: { x: 500, y: 500 },
      heading: 90,
      type: 'station',
      size: 20,
    });

    const result = service.getAllTokens();
    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  it('should get tokens by owner', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    service.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    service.placeToken({
      id: 'token-2',
      ownerId: 'player-1',
      position: { x: 200, y: 200 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    service.placeToken({
      id: 'token-3',
      ownerId: 'player-2',
      position: { x: 300, y: 300 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = service.getTokensByOwner('player-1');
    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  it('should check position validity', () => {
    service.initializeMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });

    expect(service.isPositionValid({ x: 100, y: 100 })).toBe(true);
    expect(service.isPositionValid({ x: 3000, y: 100 })).toBe(false);
  });
});
