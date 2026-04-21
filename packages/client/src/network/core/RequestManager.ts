/**
 * 请求/响应管理系统
 * 
 * 提供高级请求管理功能，包括：
 * - 类型安全的请求构建
 * - 自动重试机制
 * - 请求队列和优先级
 * - 请求取消
 * - 响应缓存
 */

import type { WsEventName, WsResponse } from "@vt/data";
import { WebSocketClient, RequestOptions } from "./WebSocketClient.js";

/**
 * 请求配置
 */
export interface EnhancedRequestOptions extends RequestOptions {
    priority?: number; // 优先级，数字越小优先级越高
    cacheKey?: string; // 缓存键
    cacheTTL?: number; // 缓存生存时间（毫秒）
    retryDelay?: number; // 重试延迟（毫秒）
    maxRetries?: number; // 最大重试次数
    shouldRetry?: (error: any) => boolean; // 是否应该重试
}

/**
 * 请求状态
 */
export enum RequestState {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
}

/**
 * 请求结果
 */
export interface RequestResult<T = any> {
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    state: RequestState;
    duration: number;
    retryCount: number;
}

/**
 * 缓存条目
 */
interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
}

/**
 * 待处理请求条目
 */
interface QueuedRequest<T = any> {
    event: WsEventName;
    payload: any;
    options: EnhancedRequestOptions;
    resolve: (value: T) => void;
    reject: (reason: any) => void;
    createdAt: number;
    priority: number;
}

/**
 * 请求管理器
 */
export class RequestManager {
    private client: WebSocketClient;
    private cache = new Map<string, CacheEntry>();
    private requestQueue: QueuedRequest[] = [];
    private activeRequests = new Map<string, QueuedRequest>();
    private maxConcurrentRequests = 5;
    private isProcessingQueue = false;

    constructor(client: WebSocketClient) {
        this.client = client;
    }

    /**
     * 发送请求（高级接口）
     */
    async send<T = any>(
        event: WsEventName,
        payload: any,
        options: EnhancedRequestOptions = {}
    ): Promise<T> {
        // 检查缓存
        if (options.cacheKey) {
            const cached = this.getFromCache<T>(options.cacheKey);
            if (cached !== undefined) {
                return cached;
            }
        }

        // 创建请求ID用于跟踪
        const requestId = crypto.randomUUID();
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = options.maxRetries ?? 0;
        const retryDelay = options.retryDelay ?? 1000;

        const executeRequest = async (): Promise<T> => {
            try {
                const result = await this.client.request<T>(event, payload, {
                    timeout: options.timeout,
                    retryCount: retryCount,
                });

                // 缓存结果
                if (options.cacheKey && options.cacheTTL) {
                    this.setCache(options.cacheKey, result, options.cacheTTL);
                }

                return result;
            } catch (error) {
                retryCount++;

                // 检查是否应该重试
                const shouldRetry = options.shouldRetry
                    ? options.shouldRetry(error)
                    : this.shouldRetryByDefault(error);

                if (retryCount <= maxRetries && shouldRetry) {
                    // 等待重试延迟
                    await this.delay(retryDelay * retryCount);
                    return executeRequest();
                }

                // 重试次数用尽或不应该重试，抛出错误
                throw error;
            }
        };

        return executeRequest();
    }

    /**
     * 发送请求（队列接口）
     */
    async sendQueued<T = any>(
        event: WsEventName,
        payload: any,
        options: EnhancedRequestOptions = {}
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const queuedRequest: QueuedRequest<T> = {
                event,
                payload,
                options,
                resolve,
                reject,
                createdAt: Date.now(),
                priority: options.priority ?? 10,
            };

            // 添加到队列
            this.requestQueue.push(queuedRequest);
            this.requestQueue.sort((a, b) => a.priority - b.priority);

            // 处理队列
            this.processQueue();
        });
    }

    /**
     * 批量发送请求
     */
    async sendBatch<T = any>(
        requests: Array<{
            event: WsEventName;
            payload: any;
            options?: EnhancedRequestOptions;
        }>
    ): Promise<T[]> {
        const results = await Promise.allSettled(
            requests.map((req) => this.send<T>(req.event, req.payload, req.options))
        );

        return results.map((result) => {
            if (result.status === "fulfilled") {
                return result.value;
            } else {
                throw result.reason;
            }
        });
    }

    /**
     * 取消所有待处理请求
     */
    cancelAll(reason: string = "Cancelled by user"): void {
        // 取消队列中的请求
        for (const request of this.requestQueue) {
            request.reject(new Error(reason));
        }
        this.requestQueue = [];

        // 取消活动请求（注意：WebSocket 请求无法取消，但我们可以拒绝 Promise）
        for (const [requestId, request] of this.activeRequests) {
            request.reject(new Error(reason));
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * 清除缓存
     */
    clearCache(cacheKey?: string): void {
        if (cacheKey) {
            this.cache.delete(cacheKey);
        } else {
            this.cache.clear();
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): {
        size: number;
        keys: string[];
        hitRate: number;
    } {
        const keys = Array.from(this.cache.keys());
        const now = Date.now();

        // 清理过期缓存
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }

        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            hitRate: 0, // 需要更复杂的跟踪来实现命中率
        };
    }

    /**
     * 设置最大并发请求数
     */
    setMaxConcurrentRequests(max: number): void {
        this.maxConcurrentRequests = Math.max(1, max);
        this.processQueue();
    }

    /**
     * 私有方法：处理请求队列
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return;
        if (this.requestQueue.length === 0) return;

        this.isProcessingQueue = true;

        try {
            while (
                this.requestQueue.length > 0 &&
                this.activeRequests.size < this.maxConcurrentRequests
            ) {
                const request = this.requestQueue.shift()!;
                const requestId = crypto.randomUUID();

                this.activeRequests.set(requestId, request);

                // 执行请求
                this.send(request.event, request.payload, request.options)
                    .then((result) => {
                        request.resolve(result);
                        this.activeRequests.delete(requestId);
                        this.processQueue(); // 处理下一个请求
                    })
                    .catch((error) => {
                        request.reject(error);
                        this.activeRequests.delete(requestId);
                        this.processQueue(); // 处理下一个请求
                    });
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * 私有方法：从缓存获取数据
     */
    private getFromCache<T = any>(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * 私有方法：设置缓存
     */
    private setCache<T = any>(key: string, data: T, ttl: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * 私有方法：默认重试策略
     */
    private shouldRetryByDefault(error: any): boolean {
        // 网络错误、超时错误应该重试
        if (error.message?.includes("timeout")) return true;
        if (error.message?.includes("network")) return true;
        if (error.message?.includes("connection")) return true;

        // 服务器错误（5xx）应该重试
        if (error.code?.startsWith("5")) return true;

        // 客户端错误（4xx）通常不应该重试，除非是特定的错误
        if (error.code === "RATE_LIMITED") return true;
        if (error.code === "TOO_MANY_REQUESTS") return true;

        return false;
    }

    /**
     * 私有方法：延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * 请求构建器（流畅接口）
 */
export class RequestBuilder {
    private event: WsEventName;
    private payload: any = {};
    private options: EnhancedRequestOptions = {};

    constructor(event: WsEventName) {
        this.event = event;
    }

    /**
     * 设置请求负载
     */
    withPayload(payload: any): this {
        this.payload = payload;
        return this;
    }

    /**
     * 设置超时时间
     */
    withTimeout(timeout: number): this {
        this.options.timeout = timeout;
        return this;
    }

    /**
     * 设置优先级
     */
    withPriority(priority: number): this {
        this.options.priority = priority;
        return this;
    }

    /**
     * 启用缓存
     */
    withCache(key: string, ttl: number = 60000): this {
        this.options.cacheKey = key;
        this.options.cacheTTL = ttl;
        return this;
    }

    /**
     * 设置重试配置
     */
    withRetry(maxRetries: number, retryDelay: number = 1000): this {
        this.options.maxRetries = maxRetries;
        this.options.retryDelay = retryDelay;
        return this;
    }

    /**
     * 设置自定义重试策略
     */
    withRetryPolicy(shouldRetry: (error: any) => boolean): this {
        this.options.shouldRetry = shouldRetry;
        return this;
    }

    /**
     * 发送请求
     */
    async send<T = any>(manager: RequestManager): Promise<T> {
        return manager.send<T>(this.event, this.payload, this.options);
    }

    /**
     * 发送队列请求
     */
    async sendQueued<T = any>(manager: RequestManager): Promise<T> {
        return manager.sendQueued<T>(this.event, this.payload, this.options);
    }
}

/**
 * 工具函数：创建请求构建器
 */
export function request(event: WsEventName): RequestBuilder {
    return new RequestBuilder(event);
}