/**
 * 阵营类型定义
 * 
 * 定义阵营相关的基础类型，支持多阵营扩展
 */

// 从 core-types.ts 重新导出阵营相关类型
export type {
	FactionId,
	FactionDefinition,
	PlayerFactionInfo,
} from '../core-types.js';

// 重新导出 Schema 供验证使用
export {
	FactionIdSchema,
	FactionDefinitionSchema,
	PlayerFactionInfoSchema,
} from '../core-types.js';