/**
 * 用户服务（简化版）
 *
 * 职责：
 * - localStorage 辅助（仅存储 username）
 * - shortId 和 profile 由后端 PlayerService 管理
 */

export class UserService {
	private static readonly USERNAME_KEY = "stfcs_username";

	/** 设置用户名 */
	setUsername(username: string): void {
		const trimmed = username.trim() || "Player";
		localStorage.setItem(UserService.USERNAME_KEY, trimmed);
	}

	/** 获取用户名 */
	getUsername(): string | null {
		return localStorage.getItem(UserService.USERNAME_KEY);
	}

	/** 恢复用户名 */
	restoreUsername(): string | null {
		return localStorage.getItem(UserService.USERNAME_KEY);
	}

	/** 登出 */
	logout(): void {
		localStorage.removeItem(UserService.USERNAME_KEY);
	}

	/** 是否有用户 */
	hasUsername(): boolean {
		return localStorage.getItem(UserService.USERNAME_KEY) !== null;
	}
}

export const userService = new UserService();