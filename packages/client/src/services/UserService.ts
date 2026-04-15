/**
 * 玩家档案服务
 *
 * 负责用户身份、shortId、profile 的管理
 * 所有档案数据持久化到 localStorage
 */

export interface UserProfile {
	nickname: string;
	avatar: string;
}

export class UserService {
	// localStorage 键名
	private static readonly STORAGE_KEYS = {
		USERNAME: "stfcs_username",
		SHORT_ID: "stfcs_short_id",
		NICKNAME: "stfcs_nickname",
		AVATAR: "stfcs_avatar",
	} as const;

	private userName: string | null = null;
	private shortId: number | null = null;
	private profile: UserProfile = { nickname: "", avatar: "👤" };

	/**
	 * 设置当前用户
	 */
	setUser(username: string): void {
		this.userName = username.trim() || "Player";
		localStorage.setItem(UserService.STORAGE_KEYS.USERNAME, this.userName);

		// 生成或恢复 shortId
		this.shortId = this.restoreOrCreateShortId();
		localStorage.setItem(UserService.STORAGE_KEYS.SHORT_ID, String(this.shortId));
		this.profile.nickname = localStorage.getItem(UserService.STORAGE_KEYS.NICKNAME) || "";
		this.profile.avatar = localStorage.getItem(UserService.STORAGE_KEYS.AVATAR) || "👤";

		console.log("[UserService] User set:", this.userName, "ShortId:", this.shortId);
	}

	/**
	 * 从本地存储恢复用户名
	 */
	restoreUser(): boolean {
		const username = localStorage.getItem(UserService.STORAGE_KEYS.USERNAME);
		if (username) {
			this.userName = username;
			this.shortId = this.restoreOrCreateShortId();
			this.profile.nickname = localStorage.getItem(UserService.STORAGE_KEYS.NICKNAME) || "";
			this.profile.avatar = localStorage.getItem(UserService.STORAGE_KEYS.AVATAR) || "👤";
			return true;
		}
		return false;
	}

	/**
	 * 登出 - 清除用户数据
	 */
	logout(): void {
		this.userName = null;
		localStorage.removeItem(UserService.STORAGE_KEYS.USERNAME);
	}

	/**
	 * 完全清除 - 清除所有本地数据
	 */
	clearAll(): void {
		this.userName = null;
		this.shortId = null;

		Object.values(UserService.STORAGE_KEYS).forEach((key) => {
			localStorage.removeItem(key);
		});
	}

	getUserName(): string | null {
		return this.userName;
	}

	getProfile(): UserProfile {
		return { ...this.profile };
	}

	setProfile(profile: { nickname?: string; avatar?: string }): void {
		this.profile = {
			nickname: String(profile.nickname || "")
				.trim()
				.slice(0, 24),
			avatar:
				String(profile.avatar || "👤")
					.trim()
					.slice(0, 4) || "👤",
		};
		localStorage.setItem(UserService.STORAGE_KEYS.NICKNAME, this.profile.nickname);
		localStorage.setItem(UserService.STORAGE_KEYS.AVATAR, this.profile.avatar);
	}

	getShortId(): number | null {
		return this.shortId;
	}

	hasUser(): boolean {
		return this.userName !== null && this.userName.length > 0;
	}

	// ==================== ShortId 管理 ====================

	private restoreOrCreateShortId(): number {
		const stored = localStorage.getItem(UserService.STORAGE_KEYS.SHORT_ID);
		const normalized = this.normalizeShortId(stored);
		if (normalized !== null) {
			return normalized;
		}
		return this.generateShortId();
	}

	private normalizeShortId(value: unknown): number | null {
		const num = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
		if (!Number.isInteger(num) || num < 100000 || num > 999999) {
			return null;
		}
		return num;
	}

	private generateShortId(): number {
		return Math.floor(100000 + Math.random() * 900000);
	}
}

// 导出单例
export const userService = new UserService();
