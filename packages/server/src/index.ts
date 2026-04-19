/**
 * 100% WebSocket服务器入口
 */

import { createLogger } from "./infra/simple-logger.js";
import { WSServer } from "./server/ws/server.js";

const logger = createLogger("server");

/** 服务器配置 */
interface ServerConfig {
  wsPort: number;
  pingInterval?: number;
  pingTimeout?: number;
  maxPayload?: number;
}

const DEFAULT_CONFIG: ServerConfig = {
  wsPort: 3001,
  pingInterval: 30000,
  pingTimeout: 10000,
  maxPayload: 10 * 1024 * 1024, // 10MB
};

/** 纯WebSocket服务器 */
export class STFCServer {
  private config: ServerConfig;
  private wsServer: WSServer | null = null;
  private isShuttingDown = false;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 启动服务器 */
  async start(): Promise<void> {
    try {
      // 启动纯WebSocket服务器
      const wsOptions: any = {
        port: this.config.wsPort,
      };
      if (this.config.pingInterval !== undefined) {
        wsOptions.pingInterval = this.config.pingInterval;
      }
      if (this.config.pingTimeout !== undefined) {
        wsOptions.pingTimeout = this.config.pingTimeout;
      }
      if (this.config.maxPayload !== undefined) {
        wsOptions.maxPayload = this.config.maxPayload;
      }
      this.wsServer = new WSServer(wsOptions);

      // 设置优雅关闭
      this.setupGracefulShutdown();

      logger.info("STFCS WebSocket server started successfully", {
        wsPort: this.config.wsPort,
        environment: process.env['NODE_ENV'] || "development",
      });

    } catch (error) {
      logger.error("Failed to start server", error);
      throw error;
    }
  }

  /** 设置优雅关闭 */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // 关闭WebSocket服务器
        if (this.wsServer) {
          await this.wsServer.close();
          logger.info("WebSocket server closed");
        }

        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown", error);
        process.exit(1);
      }
    };

    // 注册信号处理器
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // 未捕获异常处理
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", error);
      shutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled rejection", { reason, promise });
      shutdown("UNHANDLED_REJECTION");
    });
  }

  /** 获取WebSocket服务器（用于测试） */
  getWSServer(): WSServer | null {
    return this.wsServer;
  }

  /** 获取服务器统计 */
  getStats(): any {
    return this.wsServer ? this.wsServer.getStats() : null;
  }
}

// 如果直接运行此文件，启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new STFCServer();
  
  server.start().catch((error) => {
    logger.error("Failed to start server", error);
    process.exit(1);
  });
}

// 导出主要组件
export { createLogger } from "./infra/simple-logger.js";
export { WSServer } from "./server/ws/server.js";
export { ConnectionManager } from "./server/ws/connection.js";
export { RoomManager } from "./server/rooms/RoomManager.js";
export { Room } from "./server/rooms/Room.js";
export { GameStateManager } from "./core/state/GameStateManager.js";

// 导出新创建的模块
export { gameRuntime, GameRuntime } from "./runtime/index.js";
export { Match } from "./runtime/index.js";
export { TurnManager } from "./runtime/index.js";

export { shipDataManager, weaponDataManager, componentDataManager, modifierSystem } from "./data/index.js";
export { actionHandler, createJoinHandler } from "./server/handlers/index.js";
export { broadcaster } from "./server/broadcast/index.js";