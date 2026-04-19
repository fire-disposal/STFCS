/**
 * Application - 前端应用核心
 * 
 * 职责：
 * 1. 初始化所有核心模块
 * 2. 管理模块间通信
 * 3. 提供统一的应用接口
 * 4. 处理应用生命周期
 */

import { WebSocketEngine, type WebSocketEngineOptions } from './network/WebSocketEngine'
import { ImmutableStateStore, type ImmutableStateStoreOptions } from './state/ImmutableStateStore'
import type { AppState } from '@/types'
import { ENDPOINTS } from '@/config/endpoints'
import { NETWORK_CONFIG } from '@/config/constants'

export interface ApplicationOptions {
  // WebSocket配置
  websocket?: Partial<WebSocketEngineOptions>
  
  // 状态存储配置
  stateStore?: Partial<ImmutableStateStoreOptions>
  
  // 应用配置
  app?: {
    playerName?: string
    autoConnect?: boolean
    enableDebug?: boolean
  }
}

export class Application {
  // 核心模块
  private websocketEngine: WebSocketEngine
  private stateStore: ImmutableStateStore
  
  // 应用状态
  private initialized = false
  private destroyed = false
  
  constructor(options: ApplicationOptions = {}) {
    // 创建初始状态
    const initialState = this.createInitialState()
    
    // 初始化状态存储
    this.stateStore = new ImmutableStateStore({
      initialState,
      enableSnapshots: true,
      maxSnapshots: 50,
      enablePatches: true,
      autoNotify: true,
      ...options.stateStore,
    })
    
    // 初始化WebSocket引擎
    this.websocketEngine = new WebSocketEngine({
      url: ENDPOINTS.WEBSOCKET.GAME,
      maxReconnectAttempts: NETWORK_CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS,
      reconnectBaseDelay: NETWORK_CONFIG.WEBSOCKET.RECONNECT_BASE_DELAY,
      reconnectMaxDelay: NETWORK_CONFIG.WEBSOCKET.RECONNECT_MAX_DELAY,
      heartbeatInterval: NETWORK_CONFIG.WEBSOCKET.HEARTBEAT_INTERVAL,
      heartbeatTimeout: NETWORK_CONFIG.WEBSOCKET.HEARTBEAT_TIMEOUT,
      maxQueueSize: NETWORK_CONFIG.WEBSOCKET.MAX_QUEUE_SIZE,
      connectTimeout: NETWORK_CONFIG.WEBSOCKET.CONNECT_TIMEOUT,
      ...options.websocket,
    })
    
    // 设置事件监听
    this.setupEventListeners()
    
    this.initialized = true
    console.log('[Application] Initialized')
  }
  
  // ==================== 公共接口 ====================
  
  /**
   * 初始化应用
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    
    try {
      // 连接WebSocket
      await this.websocketEngine.connect()
      
      this.initialized = true
      console.log('[Application] Initialization complete')
    } catch (error) {
      console.error('[Application] Initialization failed:', error)
      throw error
    }
  }
  
  /**
   * 销毁应用
   */
  destroy(): void {
    if (this.destroyed) {
      return
    }
    
    this.websocketEngine.destroy()
    this.stateStore.destroy()
    
    this.destroyed = true
    console.log('[Application] Destroyed')
  }
  
  /**
   * 获取WebSocket引擎
   */
  getWebSocketEngine(): WebSocketEngine {
    return this.websocketEngine
  }
  
  /**
   * 获取状态存储
   */
  getStateStore(): ImmutableStateStore {
    return this.stateStore
  }
  
  /**
   * 获取应用状态
   */
  getState(): AppState {
    return this.stateStore.getState()
  }
  
  /**
   * 更新应用状态
   */
  updateState(updater: (draft: AppState) => void): void {
    this.stateStore.updateState(updater)
  }
  
  /**
   * 发送消息
   */
  async sendMessage<T>(type: string, payload: T): Promise<void> {
    await this.websocketEngine.send(type, payload)
  }
  
  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    await this.websocketEngine.reconnect()
  }
  
  /**
   * 断开连接
   */
  disconnect(): void {
    this.websocketEngine.disconnect()
  }
  
  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.websocketEngine.isConnected()
  }
  
  /**
   * 获取连接状态
   */
  getConnectionState(): string {
    return this.websocketEngine.getConnectionState()
  }
  
  /**
   * 获取延迟
   */
  getLatency(): number {
    return this.websocketEngine.getLatency()
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      websocket: this.websocketEngine.getStats(),
      stateStore: this.stateStore.getStats(),
      initialized: this.initialized,
      destroyed: this.destroyed,
    }
  }
  
  // ==================== 私有方法 ====================
  
  private createInitialState(): AppState {
    return {
      connection: {
        status: 'disconnected',
        latency: 0,
        serverTimeOffset: 0,
        lastHeartbeat: 0,
        connectionId: null,
      },
      player: {
        id: null,
        sessionId: null,
        name: null,
        role: null,
        profile: null,
        ready: false,
        connected: false,
        connectionQuality: 'OFFLINE',
      },
      room: null,
      game: {
        ships: new Map(),
        weapons: new Map(),
        objects: new Map(),
        turn: 0,
        phase: 'DEPLOYMENT',
      },
      ui: {
        camera: {
          position: { x: 0, y: 0 },
          zoom: 1,
          rotation: 0,
        },
        selection: {
          shipId: null,
          weaponId: null,
          targetId: null,
        },
        panels: {
          leftPanel: true,
          rightPanel: true,
          bottomPanel: true,
          chatPanel: false,
        },
        display: {
          showGrid: true,
          showLabels: true,
          showEffects: true,
          showWeaponArcs: false,
          showMovementRange: false,
          showBackground: true,
        },
        tool: 'select',
      },
    }
  }
  
  private setupEventListeners(): void {
    // WebSocket事件
    this.websocketEngine.on('connect', () => {
      this.updateState(draft => {
        draft.connection.status = 'connected'
        draft.player.connected = true
        draft.player.connectionQuality = 'EXCELLENT'
      })
    })
    
    this.websocketEngine.on('disconnect', (reason) => {
      this.updateState(draft => {
        draft.connection.status = 'disconnected'
        draft.player.connected = false
        draft.player.connectionQuality = 'OFFLINE'
      })
      
      console.log(`[Application] Disconnected: ${reason}`)
    })
    
    this.websocketEngine.on('reconnect', (attempt) => {
      this.updateState(draft => {
        draft.connection.status = 'reconnecting'
      })
      
      console.log(`[Application] Reconnecting (attempt ${attempt})`)
    })
    
    this.websocketEngine.on('state_change', (state) => {
      this.updateState(draft => {
        draft.connection.status = state
      })
    })
    
    this.websocketEngine.on('latency_update', (latency) => {
      this.updateState(draft => {
        draft.connection.latency = latency
        
        // 根据延迟更新连接质量
        if (latency < 50) {
          draft.player.connectionQuality = 'EXCELLENT'
        } else if (latency < 100) {
          draft.player.connectionQuality = 'GOOD'
        } else if (latency < 200) {
          draft.player.connectionQuality = 'FAIR'
        } else {
          draft.player.connectionQuality = 'POOR'
        }
      })
    })
    
    this.websocketEngine.on('error', (error) => {
      console.error('[Application] WebSocket error:', error)
    })
    
    this.websocketEngine.on('message', (message) => {
      this.handleWebSocketMessage(message)
    })
    
    // 状态存储事件
    this.stateStore.on('state_changed', (state) => {
      // 状态变化时的处理
      this.handleStateChange(state)
    })
    
    this.stateStore.on('snapshot_created', (snapshot) => {
      console.log(`[Application] Snapshot created at ${new Date(snapshot.timestamp).toISOString()}`)
    })
  }
  
  private handleWebSocketMessage(message: any): void {
    // 根据消息类型处理
    switch (message.type) {
      case 'connected':
        this.handleConnectedMessage(message.payload)
        break
        
      case 'room:joined':
        this.handleRoomJoinedMessage(message.payload)
        break
        
      case 'state:full':
        this.handleStateFullMessage(message.payload)
        break
        
      case 'state:delta':
        this.handleStateDeltaMessage(message.payload)
        break
        
      case 'event':
        this.handleEventMessage(message.payload)
        break
        
      case 'error':
        this.handleErrorMessage(message.payload)
        break
        
      default:
        console.log(`[Application] Unhandled message type: ${message.type}`, message.payload)
    }
  }
  
  private handleConnectedMessage(payload: any): void {
    this.updateState(draft => {
      draft.player.sessionId = payload.sessionId
      draft.player.id = payload.playerId
      draft.connection.serverTimeOffset = Date.now() - payload.serverTime
    })
    
    console.log(`[Application] Connected as player ${payload.playerId}`)
  }
  
  private handleRoomJoinedMessage(payload: any): void {
    this.updateState(draft => {
      draft.room = {
        id: payload.roomId,
        name: payload.roomInfo.name,
        maxPlayers: payload.roomInfo.maxPlayers,
        phase: payload.roomInfo.phase,
        turn: 0,
        players: new Map(),
        ownerId: payload.roomInfo.ownerId,
        createdAt: payload.roomInfo.createdAt,
        isPrivate: false,
      }
      
      // 添加玩家
      for (const player of payload.players) {
        draft.room!.players.set(player.id, {
          id: player.id,
          sessionId: player.id,
          name: player.name,
          role: player.role,
          profile: null,
          ready: player.ready,
          connected: true,
          connectionQuality: 'EXCELLENT',
        })
      }
    })
    
    console.log(`[Application] Joined room ${payload.roomId}`)
  }
  
  private handleStateFullMessage(payload: any): void {
    // 处理完整状态同步
    console.log('[Application] Received full state sync')
    
    // 这里需要根据实际的数据结构更新状态
    // 暂时只记录日志
  }
  
  private handleStateDeltaMessage(payload: any): void {
    // 处理增量状态更新
    console.log('[Application] Received state delta', payload.changes.length, 'changes')
    
    // 这里需要根据实际的数据结构更新状态
    // 暂时只记录日志
  }
  
  private handleEventMessage(payload: any): void {
    // 处理游戏事件
    console.log(`[Application] Game event: ${payload.eventType}`, payload.data)
    
    // 这里需要根据事件类型更新状态或触发UI更新
  }
  
  private handleErrorMessage(payload: any): void {
    console.error(`[Application] Server error: ${payload.code} - ${payload.message}`)
    
    // 这里需要根据错误类型处理
    // 例如：显示错误提示，重试操作等
  }
  
  private handleStateChange(state: AppState): void {
    // 状态变化时的处理逻辑
    // 例如：触发UI更新，发送状态变化通知等
    
    // 这里可以添加状态变化时的业务逻辑
    // 例如：当房间状态变化时，更新相关UI
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 创建房间
   */
  async createRoom(options: {
    name: string
    maxPlayers?: number
    mapWidth?: number
    mapHeight?: number
    isPrivate?: boolean
  }): Promise<void> {
    await this.sendMessage('room:create', {
      name: options.name,
      maxPlayers: options.maxPlayers || 8,
      mapWidth: options.mapWidth || 10000,
      mapHeight: options.mapHeight || 10000,
      isPrivate: options.isPrivate || false,
    })
  }
  
  /**
   * 加入房间
   */
  async joinRoom(roomId: string, options?: {
    joinToken?: string
    faction?: string
  }): Promise<void> {
    await this.sendMessage('room:join', {
      roomId,
      joinToken: options?.joinToken,
      faction: options?.faction || 'PLAYER',
    })
  }
  
  /**
   * 离开房间
   */
  async leaveRoom(): Promise<void> {
    const roomId = this.getState().room?.id
    if (roomId) {
      await this.sendMessage('room:leave', { roomId })
      
      this.updateState(draft => {
        draft.room = null
      })
    }
  }
  
  /**
   * 发送游戏命令
   */
  async sendGameCommand(type: string, payload: any): Promise<void> {
    await this.sendMessage(`game:${type}`, payload)
  }
  
  /**
   * 更新玩家档案
   */
  async updateProfile(profile: {
    nickname?: string
    avatar?: string
    preferences?: Record<string, unknown>
  }): Promise<void> {
    await this.sendMessage('player:profile_update', profile)
  }
  
  /**
   * 设置玩家准备状态
   */
  async setReady(isReady: boolean): Promise<void> {
    await this.sendMessage('player:ready', { isReady })
    
    this.updateState(draft => {
      if (draft.player) {
        draft.player.ready = isReady
      }
    })
  }
}