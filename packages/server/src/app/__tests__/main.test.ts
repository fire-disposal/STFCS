import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application, createApplication } from '../main';

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    app = createApplication({
      httpPort: 3099,
      wsPort: 3100,
    });
  });

  afterEach(async () => {
    await app.stop();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(app.initialize()).resolves.not.toThrow();
    });

    it('should create services', async () => {
      await app.initialize();

      expect(app.playerService).toBeDefined();
      expect(app.shipService).toBeDefined();
      expect(app.roomManager).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start and stop server', async () => {
      await app.initialize();
      await app.start();

      expect(app.fastify.server.listening).toBe(true);

      await app.stop();
      expect(app.fastify.server.listening).toBe(false);
    });
  });

  describe('health check', () => {
    it('should respond to health check', async () => {
      await app.initialize();
      await app.start();

      const response = await app.fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.uptime).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should allow configured origins', async () => {
      await app.initialize();
      await app.start();

      const response = await app.fastify.inject({
        method: 'OPTIONS',
        url: '/trpc/player.join',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });
});

describe('createApplication', () => {
  it('should create application instance', () => {
    const app = createApplication();
    expect(app).toBeInstanceOf(Application);
  });
});
