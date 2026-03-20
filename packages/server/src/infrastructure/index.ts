/**
 * 基础设施层导出
 *
 * 提供：
 * 1. 依赖注入容器
 * 2. 基础设施抽象接口
 * 3. 事件驱动架构组件
 * 4. WS 通信实现
 * 5. 资源管理
 */

// 依赖注入
export * from './di';

// 事件驱动
export * from './events';

// WS 通信
export { WSServer } from './ws/WSServer';
export { RoomManager } from './ws/RoomManager';
export { MessageHandler } from './ws/MessageHandler';

// 资源管理
export * from './assets';
