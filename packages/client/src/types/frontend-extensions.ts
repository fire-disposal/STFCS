/**
 * 前端特有类型扩展
 * 
 * 这些类型扩展了 @vt/data 中的权威类型，用于前端特有的需求
 */

export { };

// 通用工具类型
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;
