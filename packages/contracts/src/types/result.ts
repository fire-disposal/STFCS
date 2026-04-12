/**
 * 通用结果类型定义
 * 用于统一 Service 层的返回类型
 */

/** 成功结果 */
export type Success<T> = {
	success: true;
	data: T;
};

/** 错误结果 */
export type Failure<E = string> = {
	success: false;
	error: E;
};

/** 通用结果类型 */
export type Result<T, E = string> = Success<T> | Failure<E>;

/** 创建成功结果 */
export function ok<T>(data: T): Success<T> {
	return { success: true, data };
}

/** 创建失败结果 */
export function fail<E = string>(error: E): Failure<E> {
	return { success: false, error };
}

/** 可选结果类型（某些场景下成功时可能没有数据） */
export type OptionalResult<T, E = string> =
	| { success: true; data?: T }
	| { success: false; error: E };
