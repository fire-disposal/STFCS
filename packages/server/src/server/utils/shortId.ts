/**
 * 短数字 ID 生成
 *
 * @remarks
 * 生成格式为 `#001` ~ `#999` 的三位数字 ID。
 * 通过传入 existingIds 集合避免与已有 ID 冲突。
 * 整个 ID 空间最多 999 个，超出将抛出错误。
 */

const MIN_ID = 1;
const MAX_ID = 999;
let counter = MIN_ID;

/**
 * 生成一个不重复的短数字 ID
 * @param existingIds - 可选的已有 ID 集合，用于碰撞检测
 * @returns 格式为 `#xxx` 的 ID（xxx 为三位数字）
 * @throws 当所有 999 个 ID 都已使用时抛出错误
 */
export function generateShortId(existingIds?: Set<string>): string {
	const start = counter;
	do {
		counter = (counter % MAX_ID) + 1;
		const id = `#${counter.toString().padStart(3, "0")}`;
		if (!existingIds || !existingIds.has(id)) {
			return id;
		}
	} while (counter !== start);

	throw new Error("短数字 ID 空间已用尽（最多 999 个）");
}

export function isValidShortId(id: string): boolean {
	return /^#\d{3}$/.test(id);
}