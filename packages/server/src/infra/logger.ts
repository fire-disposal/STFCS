/**
 * 结构化日志系统
 */

import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

/** 创建日志器实例 */
export function createLogger(options: LoggerOptions = {}) {
  const { level = "info", pretty = false, name = "stfcs-server" } = options;

  const pinoOptions: pino.LoggerOptions = {
    level,
    name,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (pretty) {
    return pino({
      ...pinoOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino(pinoOptions);
}

/** 全局日志器实例 */
export const logger = createLogger({
  level: process.env['LOG_LEVEL'] as LogLevel || "info",
  pretty: process.env['NODE_ENV'] !== "production",
});

/** 上下文日志器 */
export class ContextLogger {
  private baseLogger: pino.Logger;
  private context: Record<string, any>;

  constructor(baseLogger: pino.Logger, context: Record<string, any> = {}) {
    this.baseLogger = baseLogger;
    this.context = context;
  }

  /** 添加上下文 */
  withContext(additionalContext: Record<string, any>): ContextLogger {
    return new ContextLogger(this.baseLogger, { ...this.context, ...additionalContext });
  }

  /** 记录跟踪日志 */
  trace(message: string, data?: Record<string, any>) {
    this.baseLogger.trace({ ...this.context, ...data }, message);
  }

  /** 记录调试日志 */
  debug(message: string, data?: Record<string, any>) {
    this.baseLogger.debug({ ...this.context, ...data }, message);
  }

  /** 记录信息日志 */
  info(message: string, data?: Record<string, any>) {
    this.baseLogger.info({ ...this.context, ...data }, message);
  }

  /** 记录警告日志 */
  warn(message: string, data?: Record<string, any>) {
    this.baseLogger.warn({ ...this.context, ...data }, message);
  }

  /** 记录错误日志 */
  error(message: string, error?: Error, data?: Record<string, any>) {
    const errorData = error ? { error: error.message, stack: error.stack } : {};
    this.baseLogger.error({ ...this.context, ...errorData, ...data }, message);
  }

  /** 记录致命错误日志 */
  fatal(message: string, error?: Error, data?: Record<string, any>) {
    const errorData = error ? { error: error.message, stack: error.stack } : {};
    this.baseLogger.fatal({ ...this.context, ...errorData, ...data }, message);
  }

  /** 创建子日志器 */
  child(childContext: Record<string, any>): ContextLogger {
    return new ContextLogger(this.baseLogger.child(childContext), this.context);
  }
}

/** 创建房间日志器 */
export function createRoomLogger(roomId: string): ContextLogger {
  return new ContextLogger(logger).withContext({ roomId });
}

/** 创建玩家日志器 */
export function createPlayerLogger(roomId: string, playerId: string): ContextLogger {
  return createRoomLogger(roomId).withContext({ playerId });
}

/** 创建舰船日志器 */
export function createShipLogger(roomId: string, shipId: string): ContextLogger {
  return createRoomLogger(roomId).withContext({ shipId });
}

// 导出默认日志器
export default logger;