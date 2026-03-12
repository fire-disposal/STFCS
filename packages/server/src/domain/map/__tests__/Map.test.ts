import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../Map';
import { TokenEntity } from '../TokenEntity';
import { Camera } from '../Camera';

describe('GameMap', () => {
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap({
      id: 'test-map',
      width: 2048,
      height: 2048,
      name: 'Test Map',
    });
  });

  it('should initialize with correct dimensions', () => {
    expect(map.id).toBe('test-map');
    expect(map.width).toBe(2048);
    expect(map.height).toBe(2048);
    expect(map.name).toBe('Test Map');
    expect(map.getTokenCount()).toBe(0);
  });

  it('should throw error for invalid dimensions', () => {
    expect(() => new Map({ id: 'bad', width: 0, height: 2048, name: 'Bad' })).toThrow();
    expect(() => new Map({ id: 'bad', width: 2048, height: -1, name: 'Bad' })).toThrow();
  });

  it('should place token within bounds', () => {
    const token = map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    expect(token.id).toBe('token-1');
    expect(token.position.x).toBe(100);
    expect(token.position.y).toBe(100);
    expect(map.getTokenCount()).toBe(1);
  });

  it('should reject token placement outside bounds', () => {
    expect(() =>
      map.placeToken({
        id: 'token-1',
        ownerId: 'player-1',
        position: { x: 3000, y: 100 },
        heading: 0,
        type: 'ship',
        size: 10,
      })
    ).toThrow();
  });

  it('should detect collision between tokens', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 50,
    });

    expect(() =>
      map.placeToken({
        id: 'token-2',
        ownerId: 'player-2',
        position: { x: 120, y: 100 },
        heading: 0,
        type: 'ship',
        size: 50,
      })
    ).toThrow();
  });

  it('should move token successfully', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = map.moveToken('token-1', { x: 200, y: 200 }, 45);
    expect(result).toBe(true);

    const token = map.getToken('token-1');
    expect(token?.position.x).toBe(200);
    expect(token?.position.y).toBe(200);
    expect(token?.heading).toBe(45);
  });

  it('should reject movement outside bounds', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = map.moveToken('token-1', { x: 3000, y: 100 }, 0);
    expect(result).toBe(false);
  });

  it('should remove token', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    expect(map.getTokenCount()).toBe(1);
    const removed = map.removeToken('token-1', 'test');
    expect(removed).toBe(true);
    expect(map.getTokenCount()).toBe(0);
  });

  it('should update camera', () => {
    map.updateCamera({ centerX: 500, centerY: 500, zoom: 2 });
    
    expect(map.camera.centerX).toBe(500);
    expect(map.camera.centerY).toBe(500);
    expect(map.camera.zoom).toBe(2);
  });

  it('should focus camera on token', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 800, y: 600 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const result = map.focusOnToken('token-1');
    expect(result).toBe(true);
    expect(map.camera.centerX).toBe(800);
    expect(map.camera.centerY).toBe(600);
  });

  it('should emit events', () => {
    map.placeToken({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 10,
    });

    const events = map.events;
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'MAP_INITIALIZED')).toBe(true);
    expect(events.some(e => e.type === 'TOKEN_PLACED')).toBe(true);
  });
});

describe('TokenEntity', () => {
  it('should create token with correct properties', () => {
    const token = new TokenEntity({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 45,
      type: 'ship',
      size: 20,
    });

    expect(token.id).toBe('token-1');
    expect(token.ownerId).toBe('player-1');
    expect(token.type).toBe('ship');
    expect(token.size).toBe(20);
  });

  it('should check if point is contained', () => {
    const token = new TokenEntity({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 50,
    });

    expect(token.containsPoint({ x: 110, y: 100 })).toBe(true);
    expect(token.containsPoint({ x: 200, y: 100 })).toBe(false);
  });

  it('should detect overlap with another token', () => {
    const token1 = new TokenEntity({
      id: 'token-1',
      ownerId: 'player-1',
      position: { x: 100, y: 100 },
      heading: 0,
      type: 'ship',
      size: 50,
    });

    const token2 = new TokenEntity({
      id: 'token-2',
      ownerId: 'player-2',
      position: { x: 120, y: 100 },
      heading: 0,
      type: 'ship',
      size: 50,
    });

    expect(token1.overlapsWith(token2)).toBe(true);
  });
});

describe('Camera', () => {
  it('should create camera with default values', () => {
    const camera = new Camera({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0,
    });

    expect(camera.centerX).toBe(0);
    expect(camera.centerY).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.rotation).toBe(0);
  });

  it('should pan camera', () => {
    const camera = new Camera({
      centerX: 100,
      centerY: 100,
      zoom: 1,
      rotation: 0,
    });

    camera.pan(50, 50);
    expect(camera.centerX).toBe(150);
    expect(camera.centerY).toBe(150);
  });

  it('should zoom in and out', () => {
    const camera = new Camera({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0,
    });

    camera.zoomIn(2);
    expect(camera.zoom).toBe(2);

    camera.zoomOut(2);
    expect(camera.zoom).toBe(1);
  });

  it('should not zoom below minimum', () => {
    const camera = new Camera({
      centerX: 0,
      centerY: 0,
      zoom: 0.5,
      rotation: 0,
    });

    camera.zoomOut(10);
    expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('should rotate camera', () => {
    const camera = new Camera({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0,
    });

    camera.rotate(45);
    expect(camera.rotation).toBe(45);

    camera.rotate(360);
    expect(camera.rotation).toBe(45);
  });
});
