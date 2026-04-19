/**
 * 高度精简实用的日志系统
 * 无依赖，纯函数实现
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

/** 日志配置 */
export interface LoggerConfig {
  level?: LogLevel;
  enableColors?: boolean;
  showTimestamp?: boolean;
}

/** 默认配置 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  enableColors: true,
  showTimestamp: true,
};

/** 日志级别权重 */
const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 颜色代码 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

/** 级别颜色 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.gray,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

/** 级别标签 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

/** 全局日志器实例 */
class SimpleLogger {
  private config: LoggerConfig;
  private name?: string | undefined;

  constructor(name?: string, config: LoggerConfig = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 检查是否应该记录该级别 */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHTS[level] >= LEVEL_WEIGHTS[this.config.level!];
  }

  /** 格式化上下文 */
  private formatContext(context?: Record<string, any>): string {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }
    
    const parts = Object.entries(context)
      .map(([key, value]) => {
        if (value === undefined) return `${key}=undefined`;
        if (value === null) return `${key}=null`;
        if (typeof value === 'string') return `${key}="${value}"`;
        if (typeof value === 'number' || typeof value === 'boolean') return `${key}=${value}`;
        if (typeof value === 'object') return `${key}=${JSON.stringify(value)}`;
        return `${key}=${String(value)}`;
      })
      .join(' ');
    
    return ` ${parts}`;
  }

  /** 格式化时间戳 */
  private formatTimestamp(): string {
    if (!this.config.showTimestamp) return '';
    
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    return `[${time}]`;
  }

  /** 格式化日志行 */
  private formatLog(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = this.formatTimestamp();
    const levelLabel = LEVEL_LABELS[level];
    const contextStr = this.formatContext(context);
    const nameStr = this.name ? `[${this.name}]` : '';
    
    let line = '';
    
    if (this.config.enableColors) {
      const color = LEVEL_COLORS[level];
      line = `${timestamp ? `${COLORS.gray}${timestamp}${COLORS.reset} ` : ''}${color}${levelLabel.padEnd(5)}${COLORS.reset}${nameStr ? ` ${COLORS.cyan}${nameStr}${COLORS.reset}` : ''} ${message}${contextStr}`;
    } else {
      line = `${timestamp ? `${timestamp} ` : ''}${levelLabel.padEnd(5)}${nameStr ? ` ${nameStr}` : ''} ${message}${contextStr}`;
    }
    
    return line;
  }

  /** 记录日志 */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;
    
    const line = this.formatLog(level, message, context);
    const output = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    output(line);
  }

  /** 调试日志 */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /** 信息日志 */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /** 警告日志 */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /** 错误日志 */
  error(message: string, error?: Error | any, context?: Record<string, any>): void {
    const errorContext = error ? {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    } : context;
    
    this.log('error', message, errorContext);
  }

  /** 创建子日志器 */
  child(name: string): SimpleLogger {
    const childName = this.name ? `${this.name}:${name}` : name;
    return new SimpleLogger(childName, this.config);
  }
}

/** 创建日志器 */
export function createLogger(name?: string, config?: LoggerConfig): SimpleLogger {
  return new SimpleLogger(name, config);
}

/** 全局默认日志器 */
export const logger = createLogger('server');

/** 导出类型 */
export type { SimpleLogger };

/** 默认导出 */
export default logger;