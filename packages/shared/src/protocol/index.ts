/**
 * 协议层导出
 *
 * 所有消息类型和 schema 从 ws 模块统一导出
 */

// 重新导出 ws 模块的所有内容
export * from '../ws';

// 重新导出 Zod 用于扩展
export { z } from 'zod';

// 协议版本
export { PROTOCOL_VERSION } from '../core-types';
