/**
 * 共享 ID 生成器
 * 使用 Date.now() 基36编码 + 递增计数器，确保单进程内唯一
 *
 * @param prefix 前缀（如 "ship"、"weapon"、"save"）
 * @param extra  可选附加标识（如 userId）
 * @returns       格式: `prefix:extra_timestamp_counter` 或 `prefix:timestamp_counter`
 */
let _counter = 0;

export function generateId(prefix: string, extra?: string): string {
	_counter++;
	const time = Date.now().toString(36);
	return extra
		? `${prefix}:${extra}_${time}_${_counter.toString(36)}`
		: `${prefix}:${time}_${_counter.toString(36)}`;
}
