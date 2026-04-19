/**
 * 增量更新工具
 *
 * 支持路径式 JSON 更新和变更检测
 * 设计原则：类桌面游戏的自由编辑 + 智能变更通知
 */

/**
 * 数据变更类型
 */
export type ChangeType = "set" | "add" | "remove" | "replace";

/**
 * 单个数据变更
 */
export interface DataChange {
	/** 变更路径（如 "runtime.hull"、"ship.maxHitPoints"） */
	path: string;
	/** 变更类型 */
	type: ChangeType;
	/** 旧值 */
	oldValue?: unknown;
	/** 新值 */
	newValue?: unknown;
	/** 变更描述（用于日志） */
	description?: string;
}

/**
 * 增量更新结果
 */
export interface IncrementalUpdateResult {
	/** 是否成功 */
	success: boolean;
	/** 应用的变更列表 */
	changes: DataChange[];
	/** 错误信息 */
	error?: string;
}

/**
 * 根据路径获取对象值
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (Array.isArray(current)) {
			const idx = parseInt(part, 10);
			if (isNaN(idx)) return undefined;
			current = current[idx];
		} else if (typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * 根据路径设置对象值
 * 返回变更记录
 */
export function setValueByPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown
): DataChange {
	const parts = path.split(".");
	const oldValue = getValueByPath(obj, path);

	let current: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]!;
		if (!(part in current) || current[part] === null || typeof current[part] !== "object") {
			// 自动创建中间对象
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	const lastPart = parts[parts.length - 1]!;
	const changeType: ChangeType = oldValue === undefined ? "add" : "replace";
	current[lastPart] = value;

	return {
		path,
		type: changeType,
		oldValue,
		newValue: value,
	};
}

/**
 * 应用批量路径更新
 */
export function applyPathUpdates(
	target: Record<string, unknown>,
	updates: Record<string, unknown>
): DataChange[] {
	const changes: DataChange[] = [];

	for (const [path, value] of Object.entries(updates)) {
		const change = setValueByPath(target, path, value);
		changes.push(change);
	}

	return changes;
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== "object") return obj;
	if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
	if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
	const cloned = {} as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
	}
	return cloned as T;
}

/**
 * 比较两个对象，生成变更列表
 */
export function diffObjects(
	oldObj: Record<string, unknown>,
	newObj: Record<string, unknown>,
	basePath = ""
): DataChange[] {
	const changes: DataChange[] = [];
	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

	for (const key of allKeys) {
		const path = basePath ? `${basePath}.${key}` : key;
		const oldVal = oldObj[key];
		const newVal = newObj[key];

		if (!(key in oldObj)) {
			// 新增
			changes.push({
				path,
				type: "add",
				newValue: newVal,
			});
		} else if (!(key in newObj)) {
			// 删除
			changes.push({
				path,
				type: "remove",
				oldValue: oldVal,
			});
		} else if (typeof oldVal === "object" && oldVal !== null &&
			typeof newVal === "object" && newVal !== null &&
			!Array.isArray(newVal)) {
			// 递归比较对象
			changes.push(...diffObjects(
				oldVal as Record<string, unknown>,
				newVal as Record<string, unknown>,
				path
			));
		} else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
			// 值变更
			changes.push({
				path,
				type: "replace",
				oldValue: oldVal,
				newValue: newVal,
			});
		}
	}

	return changes;
}

/**
 * 生成变更的人类可读描述
 */
export function describeChange(change: DataChange): string {
	const { path, type, oldValue, newValue } = change;

	switch (type) {
		case "add":
			return `${path} = ${JSON.stringify(newValue)} (新增)`;
		case "remove":
			return `${path} 已删除 (原值: ${JSON.stringify(oldValue)})`;
		case "replace":
			return `${path}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`;
		case "set":
			return `${path} = ${JSON.stringify(newValue)}`;
		default:
			return `${path} 已变更`;
	}
}

/**
 * 批量生成变更描述
 */
export function describeChanges(changes: DataChange[]): string[] {
	return changes.map(describeChange);
}
