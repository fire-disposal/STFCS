/**
 * 增量状态同步协议
 *
 * 用于优化WebSocket通信效率：
 * - 增量更新而非全量同步
 * - 状态差异计算
 * - 消息批量处理
 */

import { z } from 'zod';

// ==================== 增量更新 Schema ====================

/**
 * Token 增量更新
 */
export const TokenDeltaSchema = z.object({
	id: z.string(),
	changes: z.record(z.string(), z.unknown()),
});

/**
 * 舰船状态增量更新
 */
export const ShipStatusDeltaSchema = z.object({
	shipId: z.string(),
	changes: z.object({
		position: z.object({ x: z.number(), y: z.number() }).optional(),
		heading: z.number().optional(),
		hull: z.object({ current: z.number(), max: z.number() }).optional(),
		flux: z.object({
			current: z.number(),
			softFlux: z.number(),
			hardFlux: z.number(),
		}).optional(),
		fluxState: z.enum(['normal', 'venting', 'overloaded']).optional(),
		shield: z.object({
			active: z.boolean(),
			type: z.enum(['front', 'full']).optional(),
		}).optional(),
	}),
});

/**
 * 批量状态更新
 */
export const BatchStateUpdateSchema = z.object({
	tokens: z.array(TokenDeltaSchema).optional(),
	ships: z.array(ShipStatusDeltaSchema).optional(),
	timestamp: z.number(),
	sequenceNumber: z.number(),
});

/**
 * 状态同步请求
 */
export const StateSyncRequestSchema = z.object({
	lastSequenceNumber: z.number(),
});

/**
 * 状态同步响应
 */
export const StateSyncResponseSchema = z.object({
	currentSequenceNumber: z.number(),
	updates: z.array(BatchStateUpdateSchema),
	fullSync: z.boolean().optional(), // 是否需要全量同步
});

// ==================== 类型推导 ====================

export type TokenDelta = z.infer<typeof TokenDeltaSchema>;
export type ShipStatusDelta = z.infer<typeof ShipStatusDeltaSchema>;
export type BatchStateUpdate = z.infer<typeof BatchStateUpdateSchema>;
export type StateSyncRequest = z.infer<typeof StateSyncRequestSchema>;
export type StateSyncResponse = z.infer<typeof StateSyncResponseSchema>;

// ==================== 差异计算工具 ====================

/**
 * 计算对象差异
 */
export function computeDelta<T extends Record<string, unknown>>(
	previous: T,
	current: T,
	keys?: (keyof T)[]
): Partial<T> {
	const delta: Partial<T> = {};
	const compareKeys = keys || (Object.keys(current) as (keyof T)[]);

	for (const key of compareKeys) {
		if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
			delta[key] = current[key];
		}
	}

	return delta;
}

/**
 * 应用增量更新
 */
export function applyDelta<T extends Record<string, unknown>>(
	previous: T,
	delta: Partial<T>
): T {
	return { ...previous, ...delta };
}

/**
 * 批量合并更新
 */
export function mergeDeltas<T extends Record<string, unknown>>(
	deltas: Partial<T>[]
): Partial<T> {
	return deltas.reduce((acc, delta) => ({ ...acc, ...delta }), {});
}

// ==================== 消息批量处理 ====================

/**
 * 消息批处理器
 */
export class MessageBatcher<T> {
	private _queue: T[] = [];
	private _timer: ReturnType<typeof setTimeout> | null = null;
	private _batchSize: number;
	private _batchInterval: number;
	private _onFlush: (batch: T[]) => void;

	constructor(
		options: {
			batchSize?: number;
			batchInterval?: number;
			onFlush: (batch: T[]) => void;
		}
	) {
		this._batchSize = options.batchSize || 10;
		this._batchInterval = options.batchInterval || 50; // 50ms
		this._onFlush = options.onFlush;
	}

	/**
	 * 添加消息到队列
	 */
	add(message: T): void {
		this._queue.push(message);

		if (this._queue.length >= this._batchSize) {
			this.flush();
			return;
		}

		if (!this._timer) {
			this._timer = setTimeout(() => this.flush(), this._batchInterval);
		}
	}

	/**
	 * 立即刷新队列
	 */
	flush(): void {
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}

		if (this._queue.length > 0) {
			const batch = [...this._queue];
			this._queue = [];
			this._onFlush(batch);
		}
	}

	/**
	 * 清空队列
	 */
	clear(): void {
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}
		this._queue = [];
	}

	/**
	 * 获取队列长度
	 */
	get length(): number {
		return this._queue.length;
	}
}

// ==================== 状态快照管理 ====================

/**
 * 状态快照
 */
export interface StateSnapshot<T> {
	sequenceNumber: number;
	timestamp: number;
	state: T;
}

/**
 * 状态快照管理器
 */
export class StateSnapshotManager<T> {
	private _snapshots: Map<number, StateSnapshot<T>> = new Map();
	private _currentSequenceNumber: number = 0;
	private _maxSnapshots: number;

	constructor(maxSnapshots: number = 100) {
		this._maxSnapshots = maxSnapshots;
	}

	/**
	 * 创建新快照
	 */
	createSnapshot(state: T): StateSnapshot<T> {
		this._currentSequenceNumber++;
		const snapshot: StateSnapshot<T> = {
			sequenceNumber: this._currentSequenceNumber,
			timestamp: Date.now(),
			state,
		};

		this._snapshots.set(snapshot.sequenceNumber, snapshot);

		// 清理旧快照
		if (this._snapshots.size > this._maxSnapshots) {
			const oldestKey = Math.min(...this._snapshots.keys());
			this._snapshots.delete(oldestKey);
		}

		return snapshot;
	}

	/**
	 * 获取指定序列号的快照
	 */
	getSnapshot(sequenceNumber: number): StateSnapshot<T> | undefined {
		return this._snapshots.get(sequenceNumber);
	}

	/**
	 * 获取当前序列号
	 */
	get currentSequenceNumber(): number {
		return this._currentSequenceNumber;
	}

	/**
	 * 获取从指定序列号之后的所有更新
	 */
	getUpdatesSince(sequenceNumber: number): StateSnapshot<T>[] {
		const updates: StateSnapshot<T>[] = [];
		for (const [seq, snapshot] of this._snapshots) {
			if (seq > sequenceNumber) {
				updates.push(snapshot);
			}
		}
		return updates.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
	}
}

// ==================== 压缩配置 ====================

/**
 * WebSocket 压缩配置
 */
export const WS_COMPRESSION_OPTIONS = {
	// 启用 perMessageDeflate 压缩
	serverSide: {
		serverMaxWindowBits: 15,
		clientMaxWindowBits: 15,
		serverNoContextTakeover: true,
		clientNoContextTakeover: true,
		threshold: 1024, // 大于 1KB 的消息才压缩
	},
	// 客户端压缩配置
	clientSide: {
		clientMaxWindowBits: 15,
		serverMaxWindowBits: 15,
		clientNoContextTakeover: true,
		serverNoContextTakeover: true,
		threshold: 1024,
	},
};