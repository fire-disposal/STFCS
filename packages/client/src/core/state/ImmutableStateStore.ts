/**
 * ImmutableStateStore - 不可变状态存储
 * 
 * 特性：
 * 1. 基于Immer的不可变更新
 * 2. 细粒度状态订阅
 * 3. 状态快照（时间旅行调试）
 * 4. 状态合并（增量更新）
 * 5. 内存优化（共享引用）
 */

import { produce, Draft, enablePatches, applyPatches, Patch } from 'immer'
import EventEmitter from 'eventemitter3'
import type { AppState } from '@/types'

enablePatches()

export interface StateSubscription<T = unknown> {
  path: string
  callback: (value: T) => void
  lastValue?: T
}

export interface StateSnapshot<T> {
  state: T
  timestamp: number
  patches: Patch[]
  inversePatches: Patch[]
}

export interface ImmutableStateStoreOptions {
  /** 初始状态 */
  initialState: AppState
  /** 是否启用状态快照 */
  enableSnapshots?: boolean
  /** 最大快照数量 */
  maxSnapshots?: number
  /** 状态变化时是否记录补丁 */
  enablePatches?: boolean
  /** 状态变化时是否自动通知订阅者 */
  autoNotify?: boolean
}

export class ImmutableStateStore {
  private state: AppState
  private subscriptions: Map<string, Set<StateSubscription>> = new Map()
  private emitter = new EventEmitter()
  private snapshots: Array<StateSnapshot<AppState>> = []
  private options: Required<ImmutableStateStoreOptions>
  
  // 性能统计
  private stats = {
    updates: 0,
    patchesApplied: 0,
    snapshotsCreated: 0,
    subscriptionsTriggered: 0,
    lastUpdateTime: 0
  }
  
  constructor(options: ImmutableStateStoreOptions) {
    this.options = {
      enableSnapshots: true,
      maxSnapshots: 50,
      enablePatches: true,
      autoNotify: true,
      ...options
    }
    
    this.state = options.initialState
  }
  
  // ==================== 状态访问 ====================
  
  /**
   * 获取完整状态
   */
  getState(): AppState {
    return this.state
  }
  
  /**
   * 获取状态片段
   */
  getStateSlice<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key]
  }
  
  /**
   * 获取嵌套状态值
   */
  getIn<T>(path: string[]): T | undefined {
    let current: any = this.state
    
    for (const key of path) {
      if (current === undefined || current === null) {
        return undefined
      }
      current = current[key]
    }
    
    return current as T
  }
  
  // ==================== 状态更新 ====================
  
  /**
   * 更新状态（使用Immer producer）
   */
  updateState(updater: (draft: Draft<AppState>) => void): void {
    const startTime = performance.now()
    
    const result = produce(
      this.state,
      updater,
      this.options.enablePatches ? (patches, inversePatches) => {
        this.handlePatches(patches, inversePatches)
      } : undefined
    )
    
    this.state = result
    this.stats.updates++
    this.stats.lastUpdateTime = performance.now() - startTime
    
    if (this.options.autoNotify) {
      this.notifySubscribers()
    }
    
    this.emitter.emit('state_changed', this.state)
  }
  
  /**
   * 应用补丁更新
   */
  patchState(patches: Patch[]): void {
    if (patches.length === 0) {
      return
    }
    
    const startTime = performance.now()
    
    try {
      const result = applyPatches(this.state, patches)
      this.state = result
      this.stats.patchesApplied++
      this.stats.lastUpdateTime = performance.now() - startTime
      
      if (this.options.autoNotify) {
        this.notifySubscribers()
      }
      
      this.emitter.emit('state_patched', { patches, state: this.state })
    } catch (error) {
      console.error('[ImmutableStateStore] Failed to apply patches:', error)
      throw error
    }
  }
  
  /**
   * 替换完整状态
   */
  replaceState(newState: AppState): void {
    const oldState = this.state
    this.state = newState
    
    if (this.options.autoNotify) {
      this.notifySubscribers()
    }
    
    this.emitter.emit('state_replaced', { oldState, newState })
  }
  
  /**
   * 合并状态（浅合并）
   */
  mergeState(partialState: Partial<AppState>): void {
    this.updateState(draft => {
      Object.assign(draft, partialState)
    })
  }
  
  // ==================== 状态订阅 ====================
  
  /**
   * 订阅完整状态变化
   */
  subscribe(callback: (state: AppState) => void): () => void {
    const subscription: StateSubscription<AppState> = {
      path: '',
      callback,
      lastValue: this.state
    }
    
    this.addSubscription('', subscription)
    
    return () => {
      this.removeSubscription('', subscription)
    }
  }
  
  /**
   * 订阅状态路径变化
   */
  subscribeToPath<K extends keyof AppState>(
    path: K,
    callback: (value: AppState[K]) => void
  ): () => void {
    const subscription: StateSubscription<AppState[K]> = {
      path: path as string,
      callback: callback as (value: unknown) => void,
      lastValue: this.state[path]
    }
    
    this.addSubscription(path as string, subscription)
    
    return () => {
      this.removeSubscription(path as string, subscription)
    }
  }
  
  /**
   * 订阅嵌套路径变化
   */
  subscribeToNestedPath<T>(
    path: string,
    callback: (value: T) => void
  ): () => void {
    const currentValue = this.getIn<T>(path.split('.'))
    const subscription: StateSubscription<T> = {
      path,
      callback,
      lastValue: currentValue
    }
    
    this.addSubscription(path, subscription)
    
    return () => {
      this.removeSubscription(path, subscription)
    }
  }
  
  // ==================== 状态快照 ====================
  
  /**
   * 创建状态快照
   */
  createSnapshot(): StateSnapshot<AppState> {
    const snapshot: StateSnapshot<AppState> = {
      state: this.state,
      timestamp: Date.now(),
      patches: [],
      inversePatches: []
    }
    
    if (this.options.enableSnapshots) {
      this.snapshots.push(snapshot)
      
      // 限制快照数量
      if (this.snapshots.length > this.options.maxSnapshots) {
        this.snapshots.shift()
      }
      
      this.stats.snapshotsCreated++
    }
    
    this.emitter.emit('snapshot_created', snapshot)
    
    return snapshot
  }
  
  /**
   * 恢复状态快照
   */
  restoreSnapshot(snapshot: StateSnapshot<AppState>): void {
    if (snapshot.patches.length > 0 && snapshot.inversePatches.length > 0) {
      // 如果有补丁，使用补丁恢复
      this.patchState(snapshot.inversePatches)
    } else {
      // 否则直接替换状态
      this.replaceState(snapshot.state)
    }
    
    this.emitter.emit('snapshot_restored', snapshot)
  }
  
  /**
   * 获取所有快照
   */
  getSnapshots(): Array<StateSnapshot<AppState>> {
    return [...this.snapshots]
  }
  
  /**
   * 清除所有快照
   */
  clearSnapshots(): void {
    this.snapshots = []
  }
  
  // ==================== 事件监听 ====================
  
  /**
   * 监听状态变化事件
   */
  on(event: 'state_changed', listener: (state: AppState) => void): () => void
  on(event: 'state_patched', listener: (data: { patches: Patch[]; state: AppState }) => void): () => void
  on(event: 'state_replaced', listener: (data: { oldState: AppState; newState: AppState }) => void): () => void
  on(event: 'snapshot_created', listener: (snapshot: StateSnapshot<AppState>) => void): () => void
  on(event: 'snapshot_restored', listener: (snapshot: StateSnapshot<AppState>) => void): () => void
  on(event: string, listener: (...args: any[]) => void): () => void {
    this.emitter.on(event, listener)
    return () => {
      this.emitter.off(event, listener)
    }
  }
  
  // ==================== 性能统计 ====================
  
  /**
   * 获取性能统计
   */
  getStats() {
    return {
      ...this.stats,
      subscriptionCount: this.getSubscriptionCount(),
      snapshotCount: this.snapshots.length,
      stateSize: this.estimateStateSize()
    }
  }
  
  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.stats = {
      updates: 0,
      patchesApplied: 0,
      snapshotsCreated: 0,
      subscriptionsTriggered: 0,
      lastUpdateTime: 0
    }
  }
  
  // ==================== 私有方法 ====================
  
  private addSubscription(path: string, subscription: StateSubscription): void {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set())
    }
    
    this.subscriptions.get(path)!.add(subscription)
  }
  
  private removeSubscription(path: string, subscription: StateSubscription): void {
    const subscriptions = this.subscriptions.get(path)
    if (subscriptions) {
      subscriptions.delete(subscription)
      
      if (subscriptions.size === 0) {
        this.subscriptions.delete(path)
      }
    }
  }
  
  private notifySubscribers(): void {
    // 通知完整状态订阅者
    const rootSubscriptions = this.subscriptions.get('')
    if (rootSubscriptions) {
      for (const subscription of rootSubscriptions) {
        subscription.callback(this.state)
        subscription.lastValue = this.state
        this.stats.subscriptionsTriggered++
      }
    }
    
    // 通知路径订阅者
    for (const [path, subscriptions] of this.subscriptions.entries()) {
      if (path === '') continue
      
      const pathParts = path.split('.')
      const currentValue = this.getIn(pathParts)
      
      for (const subscription of subscriptions) {
        // 检查值是否变化
        if (!this.isEqual(subscription.lastValue, currentValue)) {
          subscription.callback(currentValue)
          subscription.lastValue = currentValue
          this.stats.subscriptionsTriggered++
        }
      }
    }
  }
  
  private handlePatches(patches: Patch[], inversePatches: Patch[]): void {
    if (this.options.enableSnapshots && patches.length > 0) {
      const snapshot: StateSnapshot<AppState> = {
        state: this.state,
        timestamp: Date.now(),
        patches,
        inversePatches
      }
      
      this.snapshots.push(snapshot)
      
      // 限制快照数量
      if (this.snapshots.length > this.options.maxSnapshots) {
        this.snapshots.shift()
      }
      
      this.stats.snapshotsCreated++
    }
    
    this.emitter.emit('patches_generated', { patches, inversePatches })
  }
  
  private getSubscriptionCount(): number {
    let count = 0
    for (const subscriptions of this.subscriptions.values()) {
      count += subscriptions.size
    }
    return count
  }
  
  private estimateStateSize(): number {
    try {
      const json = JSON.stringify(this.state)
      return new Blob([json]).size
    } catch {
      return 0
    }
  }
  
  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a === null || b === null) return a === b
    if (typeof a !== typeof b) return false
    
    if (typeof a === 'object' && typeof b === 'object') {
      try {
        return JSON.stringify(a) === JSON.stringify(b)
      } catch {
        return false
      }
    }
    
    return false
  }
  
  // ==================== 清理 ====================
  
  /**
   * 清理资源
   */
  destroy(): void {
    this.subscriptions.clear()
    this.snapshots = []
    this.emitter.removeAllListeners()
  }
}