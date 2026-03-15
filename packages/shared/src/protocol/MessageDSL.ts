/**
 * 消息协议定义语言 (Message Protocol DSL)
 *
 * 目标：
 * 1. 统一消息类型定义，从 Zod schema 自动推导类型
 * 2. 支持事件消息和请求 - 响应消息
 * 3. 提供类型安全的消息处理
 */

import { z } from 'zod';

// ==================== 基础类型 ====================

/** 消息方向 */
export type MessageDirection = 'broadcast' | 'request' | 'response';

/** 消息配置 */
export interface MessageConfig<
  T extends string,
  Schema extends z.ZodType,
> {
  /** 消息类型 */
  type: T;
  /** 消息 schema */
  schema: Schema;
  /** 消息方向 */
  direction: MessageDirection;
  /** 是否广播 */
  broadcast?: boolean;
  /** 消息描述 */
  description?: string;
}

/** 请求消息配置 */
export interface RequestConfig<
  T extends string,
  RequestSchema extends z.ZodType,
  ResponseSchema extends z.ZodType,
> {
  /** 操作类型 */
  operation: T;
  /** 请求 schema */
  requestSchema: RequestSchema;
  /** 响应 schema */
  responseSchema: ResponseSchema;
  /** 描述 */
  description?: string;
}

// ==================== 消息定义器 ====================

/**
 * 定义广播消息
 */
export function defineMessage<
  T extends string,
  Schema extends z.ZodType,
>(
  type: T,
  schema: Schema,
  options: {
    broadcast?: boolean;
    description?: string;
  } = {}
): MessageConfig<T, Schema> {
  return {
    type,
    schema,
    direction: 'broadcast',
    broadcast: options.broadcast ?? true,
    description: options.description,
  };
}

/**
 * 定义请求 - 响应消息
 */
export function defineRequest<
  T extends string,
  RequestSchema extends z.ZodType,
  ResponseSchema extends z.ZodType,
>(
  operation: T,
  requestSchema: RequestSchema,
  responseSchema: ResponseSchema,
  options: {
    description?: string;
  } = {}
): RequestConfig<T, RequestSchema, ResponseSchema> {
  return {
    operation,
    requestSchema,
    responseSchema,
    description: options.description,
  };
}

// ==================== 消息目录构建器 ====================

/** 消息目录类型 */
export type MessageDirectory = Record<
  string,
  MessageConfig<string, z.ZodType> | RequestConfig<string, z.ZodType, z.ZodType>
>;

/**
 * 从消息配置推导消息类型
 */
export type InferMessageType<T extends MessageConfig<string, z.ZodType>> = {
  type: T['type'];
  payload: z.infer<T['schema']>;
};

/**
 * 从请求配置推导请求类型
 */
export type InferRequestType<T extends RequestConfig<string, z.ZodType, z.ZodType>> = {
  operation: T['operation'];
  data: z.infer<T['requestSchema']>;
};

/**
 * 从请求配置推导响应类型
 */
export type InferResponseType<T extends RequestConfig<string, z.ZodType, z.ZodType>> = {
  success: boolean;
  operation: T['operation'];
  data?: z.infer<T['responseSchema']>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: number;
};

/**
 * 从消息目录推导所有消息类型
 */
export type InferMessageMap<M extends MessageDirectory> = {
  [K in keyof M]: M[K] extends MessageConfig<infer _T, infer _S>
    ? InferMessageType<M[K]>
    : never;
}[keyof M];

/**
 * 从消息目录推导请求操作类型
 */
export type InferRequestOperations<M extends MessageDirectory> = {
  [K in keyof M]: M[K] extends RequestConfig<infer T, any, any> ? T : never;
}[keyof M];

/**
 * 从消息目录推导请求类型
 */
export type InferRequest<M extends MessageDirectory, Op extends string> = 
  Extract<
    {
      [K in keyof M]: M[K] extends RequestConfig<Op, any, any>
        ? InferRequestType<M[K]>
        : never;
    }[keyof M],
    { operation: Op }
  >;

/**
 * 从消息目录推导响应类型
 */
export type InferResponse<M extends MessageDirectory, Op extends string> = 
  InferResponseType<
    Extract<M[keyof M], RequestConfig<Op, z.ZodType, z.ZodType>>
  >;

// ==================== 消息验证器 ====================

/**
 * 消息验证器
 */
export class MessageValidator<M extends MessageDirectory> {
  private messageSchemas: Map<string, z.ZodType> = new Map();
  private requestSchemas: Map<string, { request: z.ZodType; response: z.ZodType }> = new Map();

  constructor(messageDirectory: M) {
    Object.entries(messageDirectory).forEach(([, config]) => {
      if ('schema' in config) {
        // 广播消息
        this.messageSchemas.set(config.type, config.schema);
      } else {
        // 请求 - 响应消息
        this.requestSchemas.set(config.operation, {
          request: config.requestSchema,
          response: config.responseSchema,
        });
      }
    });
  }

  /**
   * 验证消息 payload
   */
  validateMessage<T extends string>(type: T, payload: unknown): z.infer<any> | null {
    const schema = this.messageSchemas.get(type);
    if (!schema) {
      console.warn(`Unknown message type: ${type}`);
      return null;
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      console.warn(`Message validation failed for ${type}:`, result.error);
      return null;
    }

    return result.data;
  }

  /**
   * 验证请求数据
   */
  validateRequest<Op extends string>(
    operation: Op,
    data: unknown
  ): z.infer<any> | null {
    const schemas = this.requestSchemas.get(operation);
    if (!schemas) {
      console.warn(`Unknown operation: ${operation}`);
      return null;
    }

    const result = schemas.request.safeParse(data);
    if (!result.success) {
      console.warn(`Request validation failed for ${operation}:`, result.error);
      return null;
    }

    return result.data;
  }

  /**
   * 验证响应数据
   */
  validateResponse<Op extends string>(
    operation: Op,
    data: unknown
  ): z.infer<any> | null {
    const schemas = this.requestSchemas.get(operation);
    if (!schemas) {
      console.warn(`Unknown operation: ${operation}`);
      return null;
    }

    const result = schemas.response.safeParse(data);
    if (!result.success) {
      console.warn(`Response validation failed for ${operation}:`, result.error);
      return null;
    }

    return result.data;
  }
}

// ==================== 消息处理器 ====================

/** 消息处理器 */
export type MessageHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * 消息分发器
 */
export class MessageDispatcher<M extends MessageDirectory> {
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private validator: MessageValidator<M>;

  constructor(
    messageDirectory: M
  ) {
    this.validator = new MessageValidator(messageDirectory);
  }

  /**
   * 注册消息处理器
   */
  on<T extends string>(
    type: T,
    handler: MessageHandler<z.infer<any>>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * 注销消息处理器
   */
  off<T extends string>(
    type: T,
    handler?: MessageHandler
  ): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    if (!handler) {
      this.handlers.delete(type);
      return;
    }

    handlers.delete(handler);
  }

  /**
   * 处理接收到的消息
   */
  dispatch(type: string, rawPayload: unknown): void {
    const payload = this.validator.validateMessage(type, rawPayload);
    if (!payload) return;

    const handlers = this.handlers.get(type);
    if (!handlers) return;

    handlers.forEach(handler => {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch(err => {
            console.error(`Error in message handler for ${type}:`, err);
          });
        }
      } catch (err) {
        console.error(`Error in message handler for ${type}:`, err);
      }
    });
  }

  /**
   * 发送请求
   */
  async request<Op extends InferRequestOperations<M>>(
    operation: Op,
    data: unknown
  ): Promise<InferResponse<M, Op>> {
    const validatedData = this.validator.validateRequest(operation, data);
    if (!validatedData) {
      throw new Error(`Invalid request data for operation: ${operation}`);
    }

    return new Promise((_resolve, reject) => {
      // 这里需要与 WebSocket 服务的请求 - 响应机制集成
      // 暂时返回一个占位实现
      reject(new Error('Request not implemented'));
    });
  }
}

// ==================== 工具类型 ====================

/**
 * 从消息目录推导 WS 消息联合类型
 */
export type WSMessageFromDirectory<M extends MessageDirectory> = 
  InferMessageMap<M>;

/**
 * 从消息目录推导消息 Payload 映射
 */
export type WSMessagePayloadMap<M extends MessageDirectory> = {
  [K in keyof M as M[K] extends MessageConfig<infer T, any> ? T : never]: 
    M[K] extends MessageConfig<any, infer S> ? z.infer<S> : never;
};
