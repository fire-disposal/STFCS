/**
 * 服务端入口 - 模块化组织
 */

import express from "express";
import { createServer } from "http";
import { Server, ServerOptions } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import cors from "cors";

// 房间
import { BattleRoom } from "./rooms/BattleRoom";

// 认证
import { userStore } from "./services/authService";
import type { LoginRequest, RegisterRequest } from "./types/auth";

// ==================== 配置 ====================

const PORT = process.env.PORT || process.env.WS_PORT || 2567;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || '*';

console.log(`[Server] Configuration: PORT=${PORT}, CORS=${CORS_ORIGINS}`);

// ==================== Express 设置 ====================

const app = express();
app.use(cors({
  origin: CORS_ORIGINS === '*' ? true : CORS_ORIGINS,
  credentials: true,
}));
app.use(express.json());

const startedAt = Date.now();

// ==================== 认证路由 ====================

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const body: RegisterRequest = req.body;
    const result = await userStore.register(body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] Register error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const body: LoginRequest = req.body;
    const result = await userStore.login(body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证 token
app.get('/api/auth/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ valid: false, message: '缺少 token' });
    }
    
    const result = await userStore.validateToken(token);
    res.json(result);
  } catch (error) {
    console.error('[API] Validate error:', error);
    res.status(500).json({ valid: false, message: '服务器错误' });
  }
});

// 登出
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await userStore.logout(token);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Logout error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户列表（仅用于调试）
app.get('/api/users', async (req, res) => {
  try {
    const users = userStore.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('[API] Get users error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ==================== HTTP 服务器 ====================

const server = createServer(app);

// ==================== Colyseus 设置 ====================

const colyseusOptions: ServerOptions = {
  transport: new WebSocketTransport({
    server,
    pingInterval: 3000,
  }),
  greet: false,
};

const gameServer = new Server(colyseusOptions);

// ==================== 房间注册 ====================

// 启用实时房间列表，让客户端可以获取实时房间信息
gameServer.define("battle", BattleRoom).enableRealtimeListing();

console.log('[Server] Battle room registered with realtime listing');

// ==================== HTTP 路由 ====================

app.use("/colyseus", monitor());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
});

// Colyseus 匹配端点（用于获取房间列表）
app.get("/matchmake", (req, res) => {
  try {
    // Colyseus 标准方式获取房间列表
    // @ts-ignore - 访问 Colyseus 内部房间列表
    const rooms = Array.from(gameServer['~rooms'].values());
    console.log('[Server] getAvailableRooms:', rooms.length, 'rooms found');
    
    res.json(rooms.map((room: any) => {
      const metadata = room.metadata || {};
      return {
        roomId: room.roomId,
        name: metadata.name || room.roomId,
        clients: room.clients?.length || 0,
        maxClients: room.maxClients,
        metadata: metadata,
      };
    }));
  } catch (error) {
    console.error('[Server] Error in /matchmake:', error);
    res.json([]);
  }
});

// ==================== 错误处理 ====================

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== 启动服务器 ====================

gameServer.listen(Number(PORT))
  .then(async () => {
    // 创建默认测试账户
    try {
      await userStore.register({
        username: 'admin',
        password: 'admin123',
        confirmPassword: 'admin123',
      });
      console.log('[Server] Default test account created: admin / admin123');
    } catch (e) {
      console.log('[Server] Default test account may already exist');
    }

    console.log('');
    console.log('=========================================================');
    console.log('                    STFCS Server Ready                   ');
    console.log('=========================================================');
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  Health:    http://localhost:${PORT}/health`);
    console.log(`  Monitor:   http://localhost:${PORT}/colyseus`);
    console.log(`  Auth API:  http://localhost:${PORT}/api/auth/login`);
    console.log('  Test Account: admin / admin123');
    console.log('=========================================================');
    console.log('');
  })
  .catch((error) => {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  });
