/**
 * 新版服务端入口
 *
 * 使用声明式房间框架
 */

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import type { WebSocket } from 'ws';
import { RoomManager, GameRoom, RoomWSHandler } from '../room';

// ==================== 配置 ====================

const config = {
  httpPort: parseInt(process.env.PORT || '3000'),
  wsPort: parseInt(process.env.WS_PORT || '3001'),
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  maxPlayersPerRoom: 8,
};

// ==================== Application ====================

export class Application {
  private _fastify = Fastify({ logger: true });
  private _roomManager: RoomManager;
  private _wsHandler: RoomWSHandler;

  constructor() {
    this._roomManager = new RoomManager(config.maxPlayersPerRoom);
    this._roomManager.registerRoomType('game', GameRoom);
    
    this._wsHandler = new RoomWSHandler({
      roomManager: this._roomManager,
      wsServer: {
        sendTo: (clientId, message) => {
          // WebSocket 发送由 RoomWSHandler 内部处理
        },
      },
    });
  }

  async initialize(): Promise<void> {
    // CORS
    await this._fastify.register(fastifyCors, {
      origin: config.corsOrigins,
    });

    // WebSocket
    await this._fastify.register(fastifyWebsocket);

    // 静态文件
    try {
      const publicDir = path.resolve(process.cwd(), 'packages/server/dist/public');
      this._fastify.register(fastifyStatic, {
        root: publicDir,
        prefix: '/',
        index: 'index.html',
      });

      // SPA fallback
      this._fastify.setNotFoundHandler((request, reply) => {
        reply.sendFile('index.html');
      });
    } catch {
      this._fastify.log.info('No static client files found');
    }

    // WebSocket 路由
    this._fastify.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        const clientId = this._generateClientId();
        
        // 处理连接
        this._wsHandler.handleConnect(clientId, connection as unknown as WebSocket);
        
        // 发送连接确认
        (connection as unknown as WebSocket).send(JSON.stringify({
          type: 'CONNECTED',
          clientId,
          timestamp: Date.now(),
        }));
      });
    });

    // REST API
    this._setupRoutes();
  }

  private _setupRoutes(): void {
    // 健康检查
    this._fastify.get('/api/health', async () => ({
      status: 'ok',
      timestamp: Date.now(),
    }));

    // 房间列表
    this._fastify.get('/api/rooms', async () => ({
      rooms: this._roomManager.listRooms(),
    }));

    // 创建房间
    this._fastify.post('/api/rooms', async (request, reply) => {
      const body = request.body as {
        roomId?: string;
        name?: string;
        playerId: string;
      };

      const roomId = body.roomId || this._generateRoomId();
      const room = this._wsHandler.createRoom(roomId, body.playerId, body.name);

      return {
        roomId: room.roomId,
        success: true,
      };
    });

    // 获取房间状态
    this._fastify.get('/api/rooms/:roomId', async (request, reply) => {
      const { roomId } = request.params as { roomId: string };
      const state = this._wsHandler.getRoomState(roomId);

      if (!state) {
        reply.code(404);
        return { error: 'Room not found' };
      }

      return { state };
    });

    // 测试场景（开发用）
    if (process.env.NODE_ENV !== 'production') {
      this._fastify.post('/api/test-scenario', async (request) => {
        const { playerId } = request.body as { playerId: string };
        // TODO: 创建测试场景
        return { success: true };
      });
    }
  }

  async start(): Promise<void> {
    try {
      await this._fastify.listen({ port: config.httpPort, host: '0.0.0.0' });
      this._fastify.log.info(`Server listening on port ${config.httpPort}`);
    } catch (err) {
      this._fastify.log.error(err);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this._fastify.close();
  }

  private _generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private _generateRoomId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}

// ==================== 启动 ====================

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new Application();
  app.initialize().then(() => app.start());
}

export { config };