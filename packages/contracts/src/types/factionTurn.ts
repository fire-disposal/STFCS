/**
 * 阵营回合状态类型定义
 * 
 * 定义阵营回合制系统的状态管理类型
 */

// 从 core-types.ts 重新导出阵营回合相关类型
export type {
	FactionTurnPhase,
	TurnHistoryEntry,
	FactionTurnState,
	FactionTurnInitParams,
} from '../core-types.js';

// 重新导出 Schema 供验证使用
export {
	FactionTurnPhaseSchema,
	TurnHistoryEntrySchema,
	FactionTurnStateSchema,
	FactionTurnInitParamsSchema,
} from '../core-types.js';

// 重新导出阵营基础类型（方便统一导入）
export type {
	FactionId,
	FactionDefinition,
	PlayerFactionInfo,
} from '../core-types.js';

export {
	FactionIdSchema,
	FactionDefinitionSchema,
	PlayerFactionInfoSchema,
} from '../core-types.js';