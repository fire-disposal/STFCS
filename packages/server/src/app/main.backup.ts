import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { WSServer } from '../infrastructure/ws/WSServer';
import { RoomManager } from '../infrastructure/ws/RoomManager';
import { MessageHandler } from '../infrastructure/ws/MessageHandler';
import { PlayerService } from '../application/player/PlayerService';
import { ShipService } from '../application/ship/ShipService';
import { createAppRouter, AppRouter } from '../api/routers';
import { config } from '../config';
import type { WSMessage } from '@vt/shared/ws';

export interface ServerOptions {
  httpPort?: number;
  wsPort?: number;
  corsOrigins?: string[];
}

export class Application {
  private _fastify: FastifyInstance;
  private _wsServer?: WSServer;
  private _roomManager: RoomManager;
  private _messageHandler?: MessageHandler;
  private _playerService: PlayerService;
  private _shipService: ShipService;
  private _appRouter?: AppRouter;

  constructor(options: ServerOptions = {}) {
    this._fastify = Fastify({
      logger: {
        level: config.logLevel,
      },
    });

    this._roomManager = new RoomManager(config.maxPlayersPerRoom);
    this._playerService = new PlayerService();
    this._shipService = new ShipService();
  }

  async initialize(): Promise<void> {
    await this._setupCors();
    await this._setupTRPC();
    await this._setupHealthCheck();
    await this._setupErrorHandler();

    this._initializeServices();
    this._initializeWS();
  }

  async start(): Promise<void> {
    const httpPort = config.httpPort;
    await this._fastify.listen({ port: httpPort, host: '0.0.0.0' });
    this._fastify.log.info(`HTTP server listening on port ${httpPort}`);
  }

  async stop(): Promise<void> {
    if (this._wsServer) {
      this._wsServer.close();
    }
    await this._fastify.close();
  }

  get fastify(): FastifyInstance {
    return this._fastify;
  }

  get wsServer(): WSServer | undefined {
    return this._wsServer;
  }

  get roomManager(): RoomManager {
    return this._roomManager;
  }

  get playerService(): PlayerService {
    return this._playerService;
  }

  get shipService(): ShipService {
    return this._shipService;
  }

  get shipRouterDeps() {
    return {
      shipService: this._shipService,
    };
  }

  get playerRouterDeps() {
    return {
      playerService: this._playerService,
    };
  }

  private async _setupCors(): Promise<void> {
    await this._fastify.register(fastifyCors, {
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
  }

  private async _setupTRPC(): Promise<void> {
    this._appRouter = createAppRouter({
      playerService: this._playerService,
      shipService: this._shipService,
    });

    this._fastify.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: this._appRouter,
        createContext: () => ({}),
      },
    });
  }

  private async _setupHealthCheck(): Promise<void> {
    this._fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
      };
    });
  }

  private async _setupErrorHandler(): Promise<void> {
    this._fastify.setErrorHandler((error: any, request, reply) => {
      this._fastify.log.error(error);

      reply.status(error.statusCode ?? 500).send({
        error: {
          code: error.name,
          message: error.message,
          statusCode: error.statusCode ?? 500,
        },
      });
    });
  }

  private _initializeServices(): void {
    this._playerService.setRoomManager(this._roomManager);
    this._shipService.setRoomManager(this._roomManager);
  }

  private _initializeWS(): void {
    this._wsServer = new WSServer({
      port: config.wsPort,
      onConnect: (clientId: string) => {
        this._fastify.log.info(`Client connected: ${clientId}`);
      },
      onDisconnect: (clientId: string) => {
        this._fastify.log.info(`Client disconnected: ${clientId}`);
        this._handleClientDisconnect(clientId);
      },
      onMessage: async (clientId: string, message: WSMessage) => {
        if (this._messageHandler) {
          await this._messageHandler.handleMessage(clientId, message);
        }
      },
    });

    this._roomManager.setWSServer(this._wsServer);
    this._playerService.setWSServer(this._wsServer);
    this._shipService.setWSServer(this._wsServer);

    this._messageHandler = new MessageHandler({
      roomManager: this._roomManager,
      playerService: this._playerService,
      shipService: this._shipService,
    });

    this._fastify.log.info(`WebSocket server listening on port ${config.wsPort}`);
  }

  private async _handleClientDisconnect(clientId: string): Promise<void> {
    const player = this._playerService.getPlayer(clientId);
    if (player) {
      const room = this._roomManager.getPlayerRoom(clientId);
      if (room) {
        await this._playerService.leave(clientId, room.id);
      }
    }
  }
}

export const createApplication = (options: ServerOptions = {}): Application => {
  return new Application(options);
};

export default Application;
