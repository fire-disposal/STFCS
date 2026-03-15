/**
 * 依赖注入容器
 *
 * 目标：
 * 1. 清晰的依赖注入，服务不再直接依赖基础设施实现
 * 2. 依赖抽象接口而不是具体类
 * 3. 支持测试时的 Mock 替换
 */

import type { IEventBus } from '@vt/shared/events';
import type { IWSServer } from '@vt/shared/ws';

// 基础设施抽象接口
import type { IRoomManager } from './IRoomManager';
import type { IRoomStore } from './IStore';

/**
 * 应用容器接口
 * 
 * 定义所有服务的依赖注入点
 */
export interface AppContainer {
  // ===== Domain 层 (无依赖) =====
  // Domain 层对象通过工厂函数创建，不存储在容器中
  
  // ===== Application 层 (依赖 Domain 和抽象接口) =====
  // 服务在容器中注册，依赖通过构造函数注入
  
  // ===== Infrastructure 层 (抽象接口) =====
  /** 事件总线 */
  eventBus: IEventBus;
  
  /** WS 服务器 */
  wsServer: IWSServer;
  
  /** 房间管理器 */
  roomManager: IRoomManager;
  
  /** 房间存储 */
  roomStore: IRoomStore;
}

/**
 * 依赖注入令牌
 */
export type DependencyToken = 
  | 'eventBus'
  | 'wsServer'
  | 'roomManager'
  | 'roomStore';

/**
 * 依赖注入容器实现
 */
export class DIContainer implements AppContainer {
  private dependencies: Map<DependencyToken, unknown> = new Map();
  private services: Map<string, unknown> = new Map();
  
  // 基础设施依赖
  eventBus!: IEventBus;
  wsServer!: IWSServer;
  roomManager!: IRoomManager;
  roomStore!: IRoomStore;
  
  /**
   * 注册基础设施依赖
   */
  registerInfrastructure(dependencies: Partial<AppContainer>): void {
    if (dependencies.eventBus) {
      this.eventBus = dependencies.eventBus;
      this.dependencies.set('eventBus', dependencies.eventBus);
    }
    if (dependencies.wsServer) {
      this.wsServer = dependencies.wsServer;
      this.dependencies.set('wsServer', dependencies.wsServer);
    }
    if (dependencies.roomManager) {
      this.roomManager = dependencies.roomManager;
      this.dependencies.set('roomManager', dependencies.roomManager);
    }
    if (dependencies.roomStore) {
      this.roomStore = dependencies.roomStore;
      this.dependencies.set('roomStore', dependencies.roomStore);
    }
  }
  
  /**
   * 注册服务
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  /**
   * 获取服务
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }
  
  /**
   * 获取依赖
   */
  getDependency<T>(token: DependencyToken): T {
    const dependency = this.dependencies.get(token);
    if (!dependency) {
      throw new Error(`Dependency not registered: ${token}`);
    }
    return dependency as T;
  }
  
  /**
   * 检查依赖是否已注册
   */
  hasDependency(token: DependencyToken): boolean {
    return this.dependencies.has(token);
  }
  
  /**
   * 构建容器（链式调用）
   */
  build(): this {
    return this;
  }
}

/**
 * 创建依赖注入容器
 */
export function createDIContainer(): DIContainer {
  return new DIContainer();
}
