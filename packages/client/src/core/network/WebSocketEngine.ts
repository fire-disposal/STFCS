/**
 * WebSocketEngine - 高性能WebSocket客户端引擎
 * 
 * 特性：
 * 1. 自动重连（指数退避算法）
 * 2. 心跳检测（双向）
 * 3. 消息队列（离线缓冲）
 * 4. 连接状态管理
 * 5. 流量控制（防洪水）
 * 6. 延迟测量
 */

import EventEmitter from 'eventemitter3'
import type { WSMessage, HeartbeatPayload, HeartbeatAckPayload } from '@/types'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WebSocketEngineOptions {
  /** 服务器URL */
  url: string
  /** 自动重连尝试次数（0表示无限重试） */
  maxReconnectAttempts?: number
  /** 重连基础延迟（毫秒） */
  reconnectBaseDelay?: number
  /** 重连最大延迟（毫秒） */
  reconnectMaxDelay?: number
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number
  /** 心跳超时时间（毫秒） */
  heartbeatTimeout?: number
  /** 消息队列最大大小 */
  maxQueueSize?: number
  /** 连接超时时间（毫秒） */
  connectTimeout?: number
}

export interface WebSocketEngineEvents {
  // 连接事件
  connect: () => void
  disconnect: (reason: string) => void
  reconnect: (attempt: number) => void
  reconnect_failed: () => void
  
  // 消息事件
  message: (message: WSMessage) => void
  error: (error: Error) => void
  
  // 状态事件
  state_change: (state: ConnectionState) => void
  latency_update: (latency: number) => void
}

export class WebSocketEngine extends EventEmitter<WebSocketEngineEvents> {
  private url: string
  private socket: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  
  // 重连配置
  private maxReconnectAttempts: number
  private reconnectBaseDelay: number
  private reconnectMaxDelay: number
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  
  // 心跳配置
  private heartbeatInterval: number
  private heartbeatTimeout: number
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
  private heartbeatSequence = 0
  private lastHeartbeatTime = 0
  private lastHeartbeatAckTime = 0
  
  // 消息队列
  private messageQueue: Array<{ type: string; payload: unknown; timestamp: number }> = []
  private maxQueueSize: number
  
  // 连接超时
  private connectTimeout: number
  private connectTimeoutTimer: NodeJS.Timeout | null = null
  
  // 统计信息
  private latency = 0
  private messagesSent = 0
  private messagesReceived = 0
  private bytesSent = 0
  private bytesReceived = 0
  
  constructor(options: WebSocketEngineOptions) {
    super()
    
    this.url = options.url
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10
    this.reconnectBaseDelay = options.reconnectBaseDelay ?? 1000
    this.reconnectMaxDelay = options.reconnectMaxDelay ?? 30000
    this.heartbeatInterval = options.heartbeatInterval ?? 30000
    this.heartbeatTimeout = options.heartbeatTimeout ?? 10000
    this.maxQueueSize = options.maxQueueSize ?? 1000
    this.connectTimeout = options.connectTimeout ?? 10000
  }
  
  // ==================== 公共接口 ====================
  
  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }
    
    this.setState('connecting')
    
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url)
        
        // 设置连接超时
        this.connectTimeoutTimer = setTimeout(() => {
          this.handleConnectTimeout()
          reject(new Error('Connection timeout'))
        }, this.connectTimeout)
        
        this.socket.onopen = () => {
          this.handleOpen()
          clearTimeout(this.connectTimeoutTimer!)
          resolve()
        }
        
        this.socket.onclose = (event) => {
          this.handleClose(event)
          clearTimeout(this.connectTimeoutTimer!)
          reject(new Error(`Connection closed: ${event.reason}`))
        }
        
        this.socket.onerror = (error) => {
          this.handleError(error)
          clearTimeout(this.connectTimeoutTimer!)
          reject(new Error('Connection error'))
        }
        
        this.socket.onmessage = (event) => {
          this.handleMessage(event)
        }
      } catch (error) {
        this.handleError(error as Error)
        reject(error)
      }
    })
  }
  
  /**
   * 断开连接
   */
  disconnect(): void {
    this.cancelReconnect()
    this.stopHeartbeat()
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect')
      this.socket = null
    }
    
    this.setState('disconnected')
    this.clearMessageQueue()
  }
  
  /**
   * 发送消息
   */
  send<T>(type: string, payload: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        // 如果未连接，将消息加入队列
        this.queueMessage(type, payload)
        resolve()
        return
      }
      
      try {
        const message: WSMessage<T> = {
          type,
          payload,
          timestamp: Date.now()
        }
        
        const json = JSON.stringify(message)
        this.socket.send(json)
        
        this.messagesSent++
        this.bytesSent += json.length
        
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }
  
  /**
   * 手动重连
   */
  async reconnect(): Promise<void> {
    this.disconnect()
    await this.connect()
  }
  
  // ==================== 状态查询 ====================
  
  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.state
  }
  
  /**
   * 获取当前延迟
   */
  getLatency(): number {
    return this.latency
  }
  
  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      state: this.state,
      latency: this.latency,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      queueSize: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeatTime: this.lastHeartbeatTime,
      lastHeartbeatAckTime: this.lastHeartbeatAckTime
    }
  }
  
  // ==================== 私有方法 ====================
  
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const oldState = this.state
      this.state = newState
      this.emit('state_change', newState)
      
      console.log(`[WebSocketEngine] State changed: ${oldState} -> ${newState}`)
    }
  }
  
  private handleOpen(): void {
    console.log('[WebSocketEngine] Connected to server')
    
    this.setState('connected')
    this.reconnectAttempts = 0
    this.cancelReconnect()
    
    // 开始心跳
    this.startHeartbeat()
    
    // 发送队列中的消息
    this.flushMessageQueue()
    
    this.emit('connect')
  }
  
  private handleClose(event: CloseEvent): void {
    console.log(`[WebSocketEngine] Connection closed: ${event.code} ${event.reason}`)
    
    this.stopHeartbeat()
    this.socket = null
    
    if (event.code !== 1000) { // 1000 = normal closure
      this.scheduleReconnect()
    }
    
    this.setState('disconnected')
    this.emit('disconnect', event.reason || 'Connection closed')
  }
  
  private handleError(error: Event | Error): void {
    console.error('[WebSocketEngine] Error:', error)
    this.emit('error', error instanceof Error ? error : new Error('WebSocket error'))
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WSMessage
      this.messagesReceived++
      this.bytesReceived += event.data.length
      
      // 处理心跳响应
      if (message.type === 'heartbeat_ack') {
        this.handleHeartbeatAck(message.payload as HeartbeatAckPayload)
        return
      }
      
      // 处理其他消息
      this.emit('message', message)
    } catch (error) {
      console.error('[WebSocketEngine] Failed to parse message:', error)
    }
  }
  
  private handleConnectTimeout(): void {
    console.error('[WebSocketEngine] Connection timeout')
    this.scheduleReconnect()
  }
  
  // ==================== 重连逻辑 ====================
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.state === 'disconnected') {
      return
    }
    
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketEngine] Max reconnect attempts reached')
      this.emit('reconnect_failed')
      return
    }
    
    this.reconnectAttempts++
    
    // 指数退避算法
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectMaxDelay
    )
    
    console.log(`[WebSocketEngine] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.performReconnect()
    }, delay)
    
    this.setState('reconnecting')
    this.emit('reconnect', this.reconnectAttempts)
  }
  
  private async performReconnect(): Promise<void> {
    try {
      await this.connect()
    } catch (error) {
      console.error('[WebSocketEngine] Reconnect failed:', error)
      this.scheduleReconnect()
    }
  }
  
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
  
  // ==================== 心跳逻辑 ====================
  
  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.heartbeatInterval)
    
    // 立即发送第一个心跳
    this.sendHeartbeat()
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }
  
  private sendHeartbeat(): void {
    if (!this.isConnected()) {
      return
    }
    
    this.heartbeatSequence++
    const clientTime = Date.now()
    
    const payload: HeartbeatPayload = {
      clientTime,
      sequence: this.heartbeatSequence
    }
    
    this.send('heartbeat', payload).catch(error => {
      console.error('[WebSocketEngine] Failed to send heartbeat:', error)
    })
    
    this.lastHeartbeatTime = clientTime
    
    // 设置心跳超时
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
    }
    
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.handleHeartbeatTimeout()
    }, this.heartbeatTimeout)
  }
  
  private handleHeartbeatAck(payload: HeartbeatAckPayload): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
    
    this.lastHeartbeatAckTime = Date.now()
    this.latency = payload.latency
    
    this.emit('latency_update', this.latency)
  }
  
  private handleHeartbeatTimeout(): void {
    console.error('[WebSocketEngine] Heartbeat timeout')
    
    if (this.socket) {
      this.socket.close(1006, 'Heartbeat timeout')
    }
    
    this.scheduleReconnect()
  }
  
  // ==================== 消息队列 ====================
  
  private queueMessage<T>(type: string, payload: T): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // 队列已满，移除最旧的消息
      this.messageQueue.shift()
    }
    
    this.messageQueue.push({
      type,
      payload,
      timestamp: Date.now()
    })
    
    console.log(`[WebSocketEngine] Queued message: ${type} (queue size: ${this.messageQueue.length})`)
  }
  
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return
    }
    
    console.log(`[WebSocketEngine] Flushing message queue (${this.messageQueue.length} messages)`)
    
    const queue = [...this.messageQueue]
    this.clearMessageQueue()
    
    for (const item of queue) {
      this.send(item.type, item.payload).catch(error => {
        console.error('[WebSocketEngine] Failed to send queued message:', error)
      })
    }
  }
  
  private clearMessageQueue(): void {
    this.messageQueue = []
  }
  
  // ==================== 清理 ====================
  
  destroy(): void {
    this.disconnect()
    this.removeAllListeners()
    this.clearMessageQueue()
  }
}