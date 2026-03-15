/**
 * 依赖注入模块导出
 */

// 容器
export { DIContainer, createDIContainer } from './Container';
export type { AppContainer, DependencyToken } from './Container';

// 抽象接口
export type { IRoomManager } from './IRoomManager';
export type { IRoomStore } from './IStore';

// 存储实现
export { InMemoryRoomStore } from './IStore';
