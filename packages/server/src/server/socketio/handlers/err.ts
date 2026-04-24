/**
 * 共享错误辅助函数
 */
export function err(message: string, code: string = "ERROR"): Error {
    return Object.assign(new Error(message), { code });
}
